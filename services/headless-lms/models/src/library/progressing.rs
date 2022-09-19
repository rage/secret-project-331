use std::collections::HashMap;

use crate::{
    course_instance_enrollments,
    course_instances::{self, CourseInstance},
    course_module_completions::{self, CourseModuleCompletion, NewCourseModuleCompletion},
    course_modules::{self, CourseModule},
    courses, open_university_registration_links,
    prelude::*,
    user_course_settings,
    user_exercise_states::{self, UserCourseInstanceMetrics},
    users::{self, User},
};

/// Checks whether the course module can be completed automatically and creates an entry for completion
/// if the user meets the criteria. Also re-checks module completion prerequisites if the module is
/// completed.
pub async fn update_automatic_completion_status_and_grant_if_eligible(
    conn: &mut PgConnection,
    course_module: &CourseModule,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let completion_exists = create_course_module_completion_if_eligible(
        conn,
        course_module,
        course_instance_id,
        user_id,
    )
    .await?;
    if completion_exists {
        let course = courses::get_course(conn, course_module.course_id).await?;
        let submodule_completions_required = course
            .base_module_completion_requires_n_submodule_completions
            .try_into()?;
        update_module_completion_prerequisite_statuses(
            conn,
            user_id,
            course_instance_id,
            submodule_completions_required,
        )
        .await?;
    }
    Ok(())
}

/// Creates completion for the user if eligible and previous one doesn't exist. Returns a boolean indicating
/// whether a completion exists after calling this function.
#[instrument(skip(conn))]
async fn create_course_module_completion_if_eligible(
    conn: &mut PgConnection,
    course_module: &CourseModule,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<bool> {
    if user_has_completed_course_module(conn, course_module.id, course_instance_id, user_id).await?
    {
        // If user already has a completion, do not attempt to create a new one.
        Ok(true)
    } else {
        let user_metrics = user_exercise_states::get_single_module_course_instance_metrics(
            conn,
            course_instance_id,
            course_module.id,
            user_id,
        )
        .await?;
        if user_is_eligible_for_automatic_completion(course_module, &user_metrics) {
            let course = courses::get_course(conn, course_module.course_id).await?;
            let user = users::get_by_id(conn, user_id).await?;
            let _completion_id = course_module_completions::insert(
                conn,
                &NewCourseModuleCompletion {
                    course_id: course_module.course_id,
                    course_instance_id,
                    course_module_id: course_module.id,
                    user_id,
                    completion_date: Utc::now(),
                    completion_registration_attempt_date: None,
                    completion_language: course.language_code,
                    eligible_for_ects: true,
                    email: user.email,
                    grade: None,
                    passed: true,
                },
                None,
            )
            .await?;
            info!("Created a completion");
            Ok(true)
        } else {
            // Can't grant automatic completion; no-op.
            Ok(false)
        }
    }
}

async fn user_has_completed_course_module(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<bool> {
    let completion = course_module_completions::get_by_course_module_instance_and_user_ids(
        conn,
        course_module_id,
        course_instance_id,
        user_id,
    )
    .await
    .optional()?;
    Ok(completion.is_some())
}

fn user_is_eligible_for_automatic_completion(
    course_module: &CourseModule,
    user_course_instance_metrics: &UserCourseInstanceMetrics,
) -> bool {
    // Count passes to make sure that at least one requirement exists.
    let mut flags = 0;
    if !course_module.automatic_completion {
        return false;
    }
    if let Some(attepted_treshold) =
        course_module.automatic_completion_number_of_exercises_attempted_treshold
    {
        if user_course_instance_metrics
            .attempted_exercises
            .unwrap_or(0)
            >= attepted_treshold.into()
        {
            flags += 1;
        } else {
            return false;
        }
    }
    if let Some(points_treshold) = course_module.automatic_completion_number_of_points_treshold {
        if user_course_instance_metrics.score_given.unwrap_or(0.0) >= points_treshold as f32 {
            flags += 1;
        } else {
            return false;
        }
    }
    flags > 0
}

#[instrument(skip(conn))]
async fn update_module_completion_prerequisite_statuses(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
    base_module_completion_requires_n_submodule_completions: u32,
) -> ModelResult<()> {
    let statuses =
        get_user_module_completion_statuses_for_course_instance(conn, user_id, course_instance_id)
            .await?;
    for status in statuses.iter() {
        let need_to_update = !status.prerequisite_modules_completed
            && prerequisite_modules_are_completed(
                status.module_id,
                base_module_completion_requires_n_submodule_completions,
                &statuses,
            )?;
        if need_to_update {
            info!(module_id = ?status.module_id, "Updating module completion prerequisite status");
            let completion = course_module_completions::get_by_course_module_instance_and_user_ids(
                conn,
                status.module_id,
                course_instance_id,
                user_id,
            )
            .await?;
            // Completion conditions are met, but the status needs to be updated to database.
            course_module_completions::update_prerequisite_modules_completed(
                conn,
                completion.id,
                true,
            )
            .await?;
        }
    }
    Ok(())
}

fn prerequisite_modules_are_completed(
    module_id: Uuid,
    submodule_completions_required: u32,
    modules: &[UserModuleCompletionStatus],
) -> ModelResult<bool> {
    let module = modules
        .iter()
        .find(|x| x.module_id == module_id)
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::Generic,
                "Module missing from vec.".to_string(),
                None,
            )
        })?;
    if module.default {
        let submodule_completions: u32 = modules
            .iter()
            .filter(|x| !x.default && x.completed)
            .count()
            .try_into()?;
        Ok(module.completed && submodule_completions >= submodule_completions_required)
    } else {
        let default_completed = modules
            .iter()
            .find(|x| x.default)
            .map(|x| x.completed)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::Generic,
                    "Default module missing".to_string(),
                    None,
                )
            })?;
        Ok(default_completed && module.completed)
    }
}

#[instrument(skip(conn))]
pub async fn process_all_course_instance_completions(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<()> {
    info!("Reprocessing course module completions");
    let course_instance = course_instances::get_course_instance(conn, course_instance_id).await?;
    let course = courses::get_course(conn, course_instance.course_id).await?;
    let submodule_completions_required = course
        .base_module_completion_requires_n_submodule_completions
        .try_into()?;
    let course_modules = course_modules::get_by_course_id(conn, course_instance.course_id).await?;
    // If user has an user exercise state, they might have returned an exercise so we need to check whether they have completed modules.
    let users = crate::users::get_all_user_ids_with_user_exercise_states_on_course_instance(
        conn,
        course_instance_id,
    )
    .await?;
    info!(users = ?users.len(), course_modules = ?course_modules.len(), ?submodule_completions_required, "Completion reprocessing info");
    for course_module in course_modules.iter() {
        info!(?course_module, "Course module information");
    }
    let mut tx = conn.begin().await?;
    for user_id in users {
        let mut num_completions = 0;
        for course_module in course_modules.iter() {
            let completion_exists = create_course_module_completion_if_eligible(
                &mut tx,
                course_module,
                course_instance_id,
                user_id,
            )
            .await?;
            if completion_exists {
                num_completions += 1;
            }
        }
        if num_completions > 0 {
            update_module_completion_prerequisite_statuses(
                &mut tx,
                user_id,
                course_instance_id,
                submodule_completions_required,
            )
            .await?;
        }
    }
    tx.commit().await?;
    info!("Reprocessing course module completions complete");
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseInstanceCompletionSummary {
    pub course_modules: Vec<CourseModule>,
    pub users_with_course_module_completions: Vec<UserWithModuleCompletions>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserWithModuleCompletions {
    pub completed_modules: Vec<UserCourseModuleCompletion>,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCourseModuleCompletion {
    pub course_module_id: Uuid,
    pub grade: Option<i32>,
    pub passed: bool,
}

impl From<CourseModuleCompletion> for UserCourseModuleCompletion {
    fn from(course_module_completion: CourseModuleCompletion) -> Self {
        Self {
            course_module_id: course_module_completion.course_module_id,
            grade: course_module_completion.grade,
            passed: course_module_completion.passed,
        }
    }
}

impl From<User> for UserWithModuleCompletions {
    fn from(user: User) -> Self {
        Self {
            user_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            completed_modules: vec![],
        }
    }
}

pub async fn get_course_instance_completion_summary(
    conn: &mut PgConnection,
    course_instance: &CourseInstance,
) -> ModelResult<CourseInstanceCompletionSummary> {
    let course_modules = course_modules::get_by_course_id(conn, course_instance.course_id).await?;
    let mut users_with_course_module_completions: HashMap<Uuid, UserWithModuleCompletions> =
        users::get_users_by_course_instance_enrollment(conn, course_instance.id)
            .await?
            .into_iter()
            .map(|u| (u.id, u.into()))
            .collect();
    let completions =
        course_module_completions::get_all_by_course_instance_id(conn, course_instance.id).await?;
    completions.into_iter().for_each(|x| {
        let user_with_completions = users_with_course_module_completions.get_mut(&x.user_id);
        if let Some(completion) = user_with_completions {
            completion.completed_modules.push(x.into());
        }
    });
    Ok(CourseInstanceCompletionSummary {
        course_modules,
        users_with_course_module_completions: users_with_course_module_completions
            .into_values()
            .collect(),
    })
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct TeacherManualCompletionRequest {
    pub course_module_id: Uuid,
    pub new_completions: Vec<TeacherManualCompletion>,
    pub skip_duplicate_completions: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct TeacherManualCompletion {
    pub user_id: Uuid,
    pub grade: Option<i32>,
    pub completion_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ManualCompletionPreview {
    pub already_completed_users: Vec<ManualCompletionPreviewUser>,
    pub first_time_completing_users: Vec<ManualCompletionPreviewUser>,
    pub non_enrolled_users: Vec<ManualCompletionPreviewUser>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ManualCompletionPreviewUser {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub grade: Option<i32>,
    pub passed: bool,
}

/// Gets a preview of changes that will occur to completions with the given manual completion data.
pub async fn get_manual_completion_result_preview(
    conn: &mut PgConnection,
    course_instance: &CourseInstance,
    manual_completion_request: &TeacherManualCompletionRequest,
) -> ModelResult<ManualCompletionPreview> {
    let course_module =
        course_modules::get_by_id(conn, manual_completion_request.course_module_id).await?;
    if course_module.course_id != course_instance.course_id {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Course module not part of the course.".to_string(),
            None,
        ));
    }
    let mut already_completed_users = vec![];
    let mut first_time_completing_users = vec![];
    let mut non_enrolled_users = vec![];
    for completion in manual_completion_request.new_completions.iter() {
        let user = users::get_by_id(conn, completion.user_id).await?;
        let user = ManualCompletionPreviewUser {
            user_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            grade: completion.grade,
            passed: true,
        };
        let enrollment = course_instance_enrollments::get_by_user_and_course_instance_id(
            conn,
            completion.user_id,
            course_instance.id,
        )
        .await
        .optional()?;
        if enrollment.is_none() {
            non_enrolled_users.push(user.clone());
        }
        let course_module_completion =
            course_module_completions::get_by_course_module_instance_and_user_ids(
                conn,
                manual_completion_request.course_module_id,
                course_instance.id,
                completion.user_id,
            )
            .await
            .optional()?;
        if course_module_completion.is_some() {
            already_completed_users.push(user);
        } else {
            first_time_completing_users.push(user);
        }
    }
    Ok(ManualCompletionPreview {
        already_completed_users,
        first_time_completing_users,
        non_enrolled_users,
    })
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCompletionInformation {
    pub course_module_completion_id: Uuid,
    pub course_name: String,
    pub uh_course_code: String,
    pub email: String,
    pub ects_credits: Option<i32>,
}

pub async fn get_user_completion_information(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_module: &CourseModule,
) -> ModelResult<UserCompletionInformation> {
    let user = users::get_by_id(conn, user_id).await?;
    let course = courses::get_course(conn, course_module.course_id).await?;
    let user_settings =
        user_course_settings::get_user_course_settings_by_course_id(conn, user.id, course.id)
            .await?
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::Generic,
                    "Missing settings".to_string(),
                    None,
                )
            })?;
    let course_module_completion =
        course_module_completions::get_by_course_module_instance_and_user_ids(
            conn,
            course_module.id,
            user_settings.current_course_instance_id,
            user.id,
        )
        .await?;
    // Course code is required only so that fetching the link later works.
    let uh_course_code = course_module.uh_course_code.clone().ok_or_else(|| {
        ModelError::new(
            ModelErrorType::InvalidRequest,
            "Course module is missing uh_course_code.".to_string(),
            None,
        )
    })?;
    Ok(UserCompletionInformation {
        course_module_completion_id: course_module_completion.id,
        course_name: course_module
            .name
            .clone()
            .unwrap_or_else(|| course.name.clone()),
        uh_course_code,
        ects_credits: course_module.ects_credits,
        email: course_module_completion.email,
    })
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserModuleCompletionStatus {
    pub completed: bool,
    pub default: bool,
    pub module_id: Uuid,
    pub name: String,
    pub order_number: i32,
    pub prerequisite_modules_completed: bool,
}

/// Gets course modules with user's completion status for the given instance.
pub async fn get_user_module_completion_statuses_for_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Vec<UserModuleCompletionStatus>> {
    let course_id = course_instances::get_course_id(conn, course_instance_id).await?;
    let course = courses::get_course(conn, course_id).await?;
    let course_modules = course_modules::get_by_course_id(conn, course_id).await?;
    let course_module_completions: HashMap<Uuid, CourseModuleCompletion> =
        course_module_completions::get_by_course_instance_and_user_ids(
            conn,
            course_instance_id,
            user_id,
        )
        .await?
        .into_iter()
        .map(|x| (x.course_module_id, x))
        .collect();
    let course_module_completion_statuses = course_modules
        .into_iter()
        .map(|module| {
            let completion = course_module_completions.get(&module.id);
            UserModuleCompletionStatus {
                completed: completion.is_some(),
                default: module.is_default_module(),
                module_id: module.id,
                name: module.name.unwrap_or_else(|| course.name.clone()),
                order_number: module.order_number,
                prerequisite_modules_completed: completion
                    .map_or(false, |x| x.prerequisite_modules_completed),
            }
        })
        .collect();
    Ok(course_module_completion_statuses)
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CompletionRegistrationLink {
    pub url: String,
}

pub async fn get_completion_registration_link_and_save_attempt(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_module: &CourseModule,
) -> ModelResult<CompletionRegistrationLink> {
    let user = users::get_by_id(conn, user_id).await?;
    let course = courses::get_course(conn, course_module.course_id).await?;
    let user_settings =
        user_course_settings::get_user_course_settings_by_course_id(conn, user.id, course.id)
            .await?
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::Generic,
                    "Missing settings".to_string(),
                    None,
                )
            })?;
    let course_module_completion =
        course_module_completions::get_by_course_module_instance_and_user_ids(
            conn,
            course_module.id,
            user_settings.current_course_instance_id,
            user.id,
        )
        .await?;
    course_module_completions::update_completion_registration_attempt_date(
        conn,
        course_module_completion.id,
        Utc::now(),
    )
    .await?;
    let uh_course_code = course_module.uh_course_code.clone().ok_or_else(|| {
        ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Course module doesn't have an assossiated University of Helsinki course code."
                .to_string(),
            None,
        )
    })?;
    let registration_link =
        open_university_registration_links::get_link_by_course_code(conn, &uh_course_code).await?;
    Ok(CompletionRegistrationLink {
        url: registration_link,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::test_helper::*;

    mod grant_automatic_completion_if_eligible {
        use crate::{
            chapters::{self, NewChapter},
            course_modules::{self, AutomaticCompletionCriteria, AutomaticCompletionPolicy},
            exercises::{self, ActivityProgress, GradingProgress},
            user_exercise_states::{self, ReviewingStage, UserExerciseStateUpdate},
        };

        use super::*;

        #[tokio::test]
        async fn grants_automatic_completion_but_no_prerequisite_for_default_module() {
            insert_data!(:tx);
            let (mut tx, user, instance, default_module, _submodule_1, _submodule_2) =
                create_test_data(tx).await;
            update_automatic_completion_status_and_grant_if_eligible(
                tx.as_mut(),
                &default_module,
                instance,
                user,
            )
            .await
            .unwrap();
            let statuses = get_user_module_completion_statuses_for_course_instance(
                tx.as_mut(),
                user,
                instance,
            )
            .await
            .unwrap();
            let status = statuses
                .iter()
                .find(|x| x.module_id == default_module.id)
                .unwrap();
            assert!(status.completed);
            assert!(!status.prerequisite_modules_completed);
        }

        #[tokio::test]
        async fn grants_automatic_completion_but_no_prerequisite_for_submodule() {
            insert_data!(:tx);
            let (mut tx, user, instance, _default_module, submodule_1, _submodule_2) =
                create_test_data(tx).await;
            update_automatic_completion_status_and_grant_if_eligible(
                tx.as_mut(),
                &submodule_1,
                instance,
                user,
            )
            .await
            .unwrap();
            let statuses = get_user_module_completion_statuses_for_course_instance(
                tx.as_mut(),
                user,
                instance,
            )
            .await
            .unwrap();
            let status = statuses
                .iter()
                .find(|x| x.module_id == submodule_1.id)
                .unwrap();
            assert!(status.completed);
            assert!(!status.prerequisite_modules_completed);
        }

        #[tokio::test]
        async fn grants_automatic_completion_for_eligible_submodule_when_completing_default_module()
        {
            insert_data!(:tx);
            let (mut tx, user, instance, default_module, submodule_1, submodule_2) =
                create_test_data(tx).await;
            update_automatic_completion_status_and_grant_if_eligible(
                tx.as_mut(),
                &default_module,
                instance,
                user,
            )
            .await
            .unwrap();
            update_automatic_completion_status_and_grant_if_eligible(
                tx.as_mut(),
                &submodule_1,
                instance,
                user,
            )
            .await
            .unwrap();
            update_automatic_completion_status_and_grant_if_eligible(
                tx.as_mut(),
                &submodule_2,
                instance,
                user,
            )
            .await
            .unwrap();
            let statuses = get_user_module_completion_statuses_for_course_instance(
                tx.as_mut(),
                user,
                instance,
            )
            .await
            .unwrap();
            statuses.iter().for_each(|x| {
                assert!(x.completed);
                assert!(x.prerequisite_modules_completed);
            });
        }

        async fn create_test_data(
            mut tx: Tx<'_>,
        ) -> (Tx<'_>, Uuid, Uuid, CourseModule, CourseModule, CourseModule) {
            let automatic_completion_policy =
                AutomaticCompletionPolicy::AutomaticCompletion(AutomaticCompletionCriteria {
                    number_of_exercises_attempted_treshold: Some(0),
                    number_of_points_treshold: Some(0),
                });
            insert_data!(tx: tx; :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise);
            courses::update_course_base_module_completion_count_requirement(tx.as_mut(), course, 1)
                .await
                .unwrap();
            let course_module_2 = course_modules::insert(tx.as_mut(), course, Some("Module 2"), 1)
                .await
                .unwrap();
            let (chapter_2, page2) = chapters::insert_chapter(
                tx.as_mut(),
                NewChapter {
                    name: "chapter 2".to_string(),
                    course_id: course,
                    chapter_number: 2,
                    front_page_id: None,
                    opens_at: None,
                    deadline: None,
                    course_module_id: Some(course_module_2.id),
                },
                user,
            )
            .await
            .unwrap();
            let exercise_2 = exercises::insert(tx.as_mut(), course, "", page2.id, chapter_2.id, 0)
                .await
                .unwrap();
            let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
                tx.as_mut(),
                user,
                exercise,
                Some(instance.id),
                None,
            )
            .await
            .unwrap();
            user_exercise_states::update(
                tx.as_mut(),
                UserExerciseStateUpdate {
                    id: user_exercise_state.id,
                    score_given: Some(0.0),
                    activity_progress: ActivityProgress::Completed,
                    reviewing_stage: ReviewingStage::NotStarted,
                    grading_progress: GradingProgress::FullyGraded,
                },
            )
            .await
            .unwrap();
            let user_exercise_state_2 = user_exercise_states::get_or_create_user_exercise_state(
                tx.as_mut(),
                user,
                exercise_2,
                Some(instance.id),
                None,
            )
            .await
            .unwrap();
            user_exercise_states::update(
                tx.as_mut(),
                UserExerciseStateUpdate {
                    id: user_exercise_state_2.id,
                    score_given: Some(0.0),
                    activity_progress: ActivityProgress::Completed,
                    reviewing_stage: ReviewingStage::NotStarted,
                    grading_progress: GradingProgress::FullyGraded,
                },
            )
            .await
            .unwrap();
            let default_module = course_modules::get_default_by_course_id(tx.as_mut(), course)
                .await
                .unwrap();
            let default_module = course_modules::update_automatic_completion_status(
                tx.as_mut(),
                default_module.id,
                &automatic_completion_policy,
            )
            .await
            .unwrap();
            let course_module = course_modules::update_automatic_completion_status(
                tx.as_mut(),
                course_module.id,
                &automatic_completion_policy,
            )
            .await
            .unwrap();
            let course_module_2 = course_modules::update_automatic_completion_status(
                tx.as_mut(),
                course_module_2.id,
                &automatic_completion_policy,
            )
            .await
            .unwrap();
            (
                tx,
                user,
                instance.id,
                default_module,
                course_module,
                course_module_2,
            )
        }
    }

    mod automatic_completion_validation {
        use chrono::TimeZone;

        use super::*;

        #[test]
        fn doesnt_give_completion_if_automatic_completions_are_not_enabled() {
            let course_module = create_course_module(false, Some(0), Some(0));
            let user_metrics = create_user_course_instance_metrics(Some(1.0), Some(1));
            assert!(!user_is_eligible_for_automatic_completion(
                &course_module,
                &user_metrics
            ));
        }

        #[test]
        fn doesnt_give_completion_if_no_tresholds_are_defined() {
            let course_module = create_course_module(true, None, None);
            let user_metrics = create_user_course_instance_metrics(Some(1.0), Some(1));
            assert!(!user_is_eligible_for_automatic_completion(
                &course_module,
                &user_metrics
            ));
        }

        #[test]
        fn gives_completion_if_exercises_attempted_treshold_is_met() {
            let course_module = create_course_module(true, Some(1), None);
            let user_metrics = create_user_course_instance_metrics(Some(1.0), Some(1));
            assert!(user_is_eligible_for_automatic_completion(
                &course_module,
                &user_metrics
            ));
        }

        #[test]
        fn gives_completion_if_points_treshold_is_met() {
            let course_module = create_course_module(true, None, Some(1));
            let user_metrics = create_user_course_instance_metrics(Some(1.0), Some(1));
            assert!(user_is_eligible_for_automatic_completion(
                &course_module,
                &user_metrics
            ));
        }

        fn create_course_module(
            automatic_completion: bool,
            automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
            automatic_completion_number_of_points_treshold: Option<i32>,
        ) -> CourseModule {
            let id = Uuid::parse_str("f2cd5971-444f-4b1b-9ef9-4d283fecf6f8").unwrap();
            CourseModule {
                id,
                created_at: Utc.ymd(2022, 6, 27).and_hms(0, 0, 0),
                updated_at: Utc.ymd(2022, 6, 27).and_hms(0, 0, 0),
                deleted_at: None,
                name: None,
                course_id: id,
                order_number: 0,
                copied_from: None,
                uh_course_code: None,
                ects_credits: None,
                automatic_completion,
                automatic_completion_number_of_exercises_attempted_treshold,
                automatic_completion_number_of_points_treshold,
            }
        }

        fn create_user_course_instance_metrics(
            score_given: Option<f32>,
            attempted_exercises: Option<i64>,
        ) -> UserCourseInstanceMetrics {
            UserCourseInstanceMetrics {
                course_module_id: Uuid::parse_str("f2cd5971-444f-4b1b-9ef9-4d283fecf6f8").unwrap(),
                score_given,
                attempted_exercises,
            }
        }
    }

    mod prerequisite_completion_checking {
        use super::*;

        const DEFAULT_ID: &str = "274c0dfd-e491-4786-ad5b-b4e20d0de7ed";
        const SUBMODULE_ID_1: &str = "562901cc-405b-4b7e-ae02-8c7c0055ba9f";

        #[test]
        fn is_false_for_course_with_just_uncompleted_default_module() {
            let default_id = Uuid::parse_str(DEFAULT_ID).unwrap();
            let module_statuses = vec![UserModuleCompletionStatus {
                completed: false,
                default: true,
                module_id: default_id,
                name: "Course".to_string(),
                order_number: 0,
                prerequisite_modules_completed: false,
            }];
            assert!(!prerequisite_modules_are_completed(default_id, 0, &module_statuses).unwrap());
        }

        #[test]
        fn is_true_for_course_with_just_completed_default_module() {
            let default_id = Uuid::parse_str(DEFAULT_ID).unwrap();
            let module_statuses = vec![UserModuleCompletionStatus {
                completed: true,
                default: true,
                module_id: default_id,
                name: "Course".to_string(),
                order_number: 0,
                prerequisite_modules_completed: false,
            }];
            assert!(prerequisite_modules_are_completed(default_id, 0, &module_statuses).unwrap());
        }

        #[test]
        fn is_false_for_default_with_not_enough_submodule_completions() {
            let default_id = Uuid::parse_str(DEFAULT_ID).unwrap();
            let submodule_id_1 = Uuid::parse_str(SUBMODULE_ID_1).unwrap();
            let module_statuses = vec![
                UserModuleCompletionStatus {
                    completed: true,
                    default: true,
                    module_id: default_id,
                    name: "Course".to_string(),
                    order_number: 0,
                    prerequisite_modules_completed: false,
                },
                UserModuleCompletionStatus {
                    completed: false,
                    default: false,
                    module_id: submodule_id_1,
                    name: "Submodule".to_string(),
                    order_number: 1,
                    prerequisite_modules_completed: false,
                },
            ];
            assert!(!prerequisite_modules_are_completed(default_id, 1, &module_statuses).unwrap());
        }

        #[test]
        fn is_true_for_default_with_enough_submodule_completions() {
            let default_id = Uuid::parse_str(DEFAULT_ID).unwrap();
            let submodule_id_1 = Uuid::parse_str(SUBMODULE_ID_1).unwrap();
            let module_statuses = vec![
                UserModuleCompletionStatus {
                    completed: true,
                    default: true,
                    module_id: default_id,
                    name: "Course".to_string(),
                    order_number: 0,
                    prerequisite_modules_completed: false,
                },
                UserModuleCompletionStatus {
                    completed: true,
                    default: false,
                    module_id: submodule_id_1,
                    name: "Submodule".to_string(),
                    order_number: 1,
                    prerequisite_modules_completed: false,
                },
            ];
            assert!(prerequisite_modules_are_completed(default_id, 1, &module_statuses).unwrap());
        }

        #[test]
        fn is_false_for_submodule_with_no_default_completion() {
            let default_id = Uuid::parse_str(DEFAULT_ID).unwrap();
            let submodule_id_1 = Uuid::parse_str(SUBMODULE_ID_1).unwrap();
            let module_statuses = vec![
                UserModuleCompletionStatus {
                    completed: false,
                    default: true,
                    module_id: default_id,
                    name: "Course".to_string(),
                    order_number: 0,
                    prerequisite_modules_completed: false,
                },
                UserModuleCompletionStatus {
                    completed: true,
                    default: false,
                    module_id: submodule_id_1,
                    name: "Submodule".to_string(),
                    order_number: 1,
                    prerequisite_modules_completed: false,
                },
            ];
            assert!(
                !prerequisite_modules_are_completed(submodule_id_1, 1, &module_statuses).unwrap()
            );
        }

        #[test]
        fn is_true_for_submodule_with_default_completion() {
            let default_id = Uuid::parse_str(DEFAULT_ID).unwrap();
            let submodule_id_1 = Uuid::parse_str(SUBMODULE_ID_1).unwrap();
            let module_statuses = vec![
                UserModuleCompletionStatus {
                    completed: true,
                    default: true,
                    module_id: default_id,
                    name: "Course".to_string(),
                    order_number: 0,
                    prerequisite_modules_completed: false,
                },
                UserModuleCompletionStatus {
                    completed: true,
                    default: false,
                    module_id: submodule_id_1,
                    name: "Submodule".to_string(),
                    order_number: 1,
                    prerequisite_modules_completed: false,
                },
            ];
            assert!(
                prerequisite_modules_are_completed(submodule_id_1, 1, &module_statuses).unwrap()
            );
        }
    }
}
