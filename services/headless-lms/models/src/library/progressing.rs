use itertools::Itertools;
use std::collections::HashMap;

use crate::{
    course_exams,
    course_instance_enrollments::{self, NewCourseInstanceEnrollment},
    course_instances::{self, CourseInstance},
    course_module_completions::{
        self, CourseModuleCompletion, CourseModuleCompletionGranter,
        CourseModuleCompletionWithRegistrationInfo, NewCourseModuleCompletion,
    },
    course_modules::{self, AutomaticCompletionRequirements, CompletionPolicy, CourseModule},
    courses, exams, open_university_registration_links,
    prelude::*,
    user_course_settings,
    user_details::UserDetail,
    user_exercise_states,
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
    let completion_exists = create_automatic_course_module_completion_if_eligible(
        conn,
        course_module,
        course_instance_id,
        user_id,
    )
    .await?;
    if completion_exists {
        let course = courses::get_course(conn, course_module.course_id).await?;
        let course_instance =
            course_instances::get_course_instance(conn, course_instance_id).await?;
        let submodule_completions_required = course
            .base_module_completion_requires_n_submodule_completions
            .try_into()?;
        update_module_completion_prerequisite_statuses_for_user(
            conn,
            user_id,
            &course_instance,
            submodule_completions_required,
        )
        .await?;
    }
    Ok(())
}

/// Creates completion for the user if eligible and previous one doesn't exist. Returns a boolean indicating
/// whether a completion exists after calling this function.
#[instrument(skip(conn))]
async fn create_automatic_course_module_completion_if_eligible(
    conn: &mut PgConnection,
    course_module: &CourseModule,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<bool> {
    let existing_completion =
        course_module_completions::get_automatic_completion_by_course_module_instance_and_user_ids(
            conn,
            course_module.id,
            course_instance_id,
            user_id,
        )
        .await
        .optional()?;
    if existing_completion.is_some() {
        // If user already has a completion, do not attempt to create a new one.
        Ok(true)
    } else {
        let eligible = user_is_eligible_for_automatic_completion(
            conn,
            course_module,
            course_instance_id,
            user_id,
        )
        .await?;
        if eligible {
            let course = courses::get_course(conn, course_module.course_id).await?;
            let user = users::get_by_id(conn, user_id).await?;
            let user_details =
                crate::user_details::get_user_details_by_user_id(conn, user.id).await?;
            let _completion_id = course_module_completions::insert(
                conn,
                PKeyPolicy::Generate,
                &NewCourseModuleCompletion {
                    course_id: course_module.course_id,
                    course_instance_id,
                    course_module_id: course_module.id,
                    user_id,
                    completion_date: Utc::now(),
                    completion_registration_attempt_date: None,
                    completion_language: course.language_code,
                    eligible_for_ects: true,
                    email: user_details.email,
                    grade: None,
                    passed: true,
                },
                CourseModuleCompletionGranter::Automatic,
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

#[instrument(skip(conn))]
async fn user_is_eligible_for_automatic_completion(
    conn: &mut PgConnection,
    course_module: &CourseModule,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<bool> {
    match &course_module.completion_policy {
        CompletionPolicy::Automatic(requirements) => {
            let eligible = user_passes_automatic_completion_exercise_tresholds(
                conn,
                user_id,
                requirements,
                course_instance_id,
            )
            .await?;
            if eligible {
                if requirements.requires_exam {
                    info!("To complete this module automatically, the user must pass an exam.");
                    user_has_passed_exam_for_the_course(conn, user_id, course_module.course_id)
                        .await
                } else {
                    Ok(true)
                }
            } else {
                Ok(false)
            }
        }
        CompletionPolicy::Manual => Ok(false),
    }
}

/// Checks whether the student can partake in an exam.
///
/// The result of this process depends on the configuration for the exam. If the exam is not linked
/// to any course, the user will always be able to take it by default. Otherwise the student
/// progress in their current selected instances is compared against any of the linked courses, and
/// checked whether any pass the exercise completion tresholds. Finally, if none of the courses have
/// automatic completion configuration, the exam is once again allowed to be taken by default.
#[instrument(skip(conn))]
pub async fn user_can_take_exam(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> ModelResult<bool> {
    let course_ids = course_exams::get_course_ids_by_exam_id(conn, exam_id).await?;
    let settings = user_course_settings::get_all_by_user_and_multiple_current_courses(
        conn,
        &course_ids,
        user_id,
    )
    .await?;
    // User can take the exam by default if course_ids is an empty array.
    let mut can_take_exam = true;
    for course_id in course_ids {
        let default_module = course_modules::get_default_by_course_id(conn, course_id).await?;
        if let CompletionPolicy::Automatic(requirements) = &default_module.completion_policy {
            if let Some(s) = settings.iter().find(|x| x.current_course_id == course_id) {
                let eligible = user_passes_automatic_completion_exercise_tresholds(
                    conn,
                    s.user_id,
                    requirements,
                    s.current_course_instance_id,
                )
                .await?;
                if eligible {
                    // Only one current instance needs to pass the tresholds.
                    can_take_exam = true;
                    break;
                }
            }
            // If there is at least one associated course with requirements, make sure that the user
            // passes one of them.
            can_take_exam = false;
        }
    }
    Ok(can_take_exam)
}

/// Returns true if there is at least one exam associated with the course, that has ended and the
/// user has received enough points from it.
async fn user_has_passed_exam_for_the_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<bool> {
    let now = Utc::now();
    let exam_ids = course_exams::get_exam_ids_by_course_id(conn, course_id).await?;
    for exam_id in exam_ids {
        let exam = exams::get(conn, exam_id).await?;
        if exam.ended_at_or(now, false) {
            let points =
                user_exercise_states::get_user_total_exam_points(conn, user_id, exam_id).await?;
            if let Some(points) = points {
                if points >= exam.minimum_points_treshold as f32 {
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}

async fn user_passes_automatic_completion_exercise_tresholds(
    conn: &mut PgConnection,
    user_id: Uuid,
    requirements: &AutomaticCompletionRequirements,
    course_instance_id: Uuid,
) -> ModelResult<bool> {
    let user_metrics = user_exercise_states::get_single_module_course_instance_metrics(
        conn,
        course_instance_id,
        requirements.course_module_id,
        user_id,
    )
    .await?;
    let attempted_exercises: i32 = user_metrics.attempted_exercises.unwrap_or(0) as i32;
    let exercise_points = user_metrics.score_given.unwrap_or(0.0) as i32;
    let eligible = requirements.passes_exercise_tresholds(attempted_exercises, exercise_points);
    Ok(eligible)
}

/// Fetches all course module completions for the given user on the given course and updates the
/// prerequisite module completion statuses for any completions that are missing them.
#[instrument(skip(conn))]
async fn update_module_completion_prerequisite_statuses_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance: &CourseInstance,
    base_module_completion_requires_n_submodule_completions: u32,
) -> ModelResult<()> {
    let default_course_module =
        course_modules::get_default_by_course_id(conn, course_instance.course_id).await?;
    let course_module_completions =
        course_module_completions::get_all_by_course_instance_and_user_id(
            conn,
            course_instance.id,
            user_id,
        )
        .await?;
    let default_module_is_completed = course_module_completions
        .iter()
        .any(|x| x.course_module_id == default_course_module.id);
    let submodule_completions = course_module_completions
        .iter()
        .filter(|x| x.course_module_id != default_course_module.id)
        .unique_by(|x| x.course_module_id)
        .count();
    let enough_submodule_completions = submodule_completions
        >= base_module_completion_requires_n_submodule_completions.try_into()?;
    let completions_needing_processing: Vec<_> = course_module_completions
        .into_iter()
        .filter(|x| !x.prerequisite_modules_completed)
        .collect();
    for completion in completions_needing_processing {
        if completion.course_module_id == default_course_module.id {
            if enough_submodule_completions {
                course_module_completions::update_prerequisite_modules_completed(
                    conn,
                    completion.id,
                    true,
                )
                .await?;
            }
        } else if default_module_is_completed {
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

/// Goes through all course instances on a course and grants completions to users on those courses
/// where eligible.
#[instrument(skip(conn))]
pub async fn process_all_course_completions(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<()> {
    let course_instances =
        course_instances::get_course_instances_for_course(conn, course_id).await?;
    for course_instance in course_instances {
        process_all_course_instance_completions(conn, course_instance.id).await?;
    }
    Ok(())
}

/// Goes through all users on the course instance and grants them completions where eligible.
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
            let completion_exists = create_automatic_course_module_completion_if_eligible(
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
            update_module_completion_prerequisite_statuses_for_user(
                &mut tx,
                user_id,
                &course_instance,
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
    pub completed_modules: Vec<CourseModuleCompletionWithRegistrationInfo>,
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

impl UserWithModuleCompletions {
    fn from_user_and_details(user: User, user_details: UserDetail) -> Self {
        Self {
            user_id: user.id,
            first_name: user_details.first_name,
            last_name: user_details.last_name,
            email: user_details.email,
            completed_modules: vec![],
        }
    }
}

pub async fn get_course_instance_completion_summary(
    conn: &mut PgConnection,
    course_instance: &CourseInstance,
) -> ModelResult<CourseInstanceCompletionSummary> {
    let course_modules = course_modules::get_by_course_id(conn, course_instance.course_id).await?;
    let users_with_course_module_completions_list =
        users::get_users_by_course_instance_enrollment(conn, course_instance.id).await?;
    let user_id_to_details_map = crate::user_details::get_users_details_by_user_id_map(
        conn,
        &users_with_course_module_completions_list,
    )
    .await?;
    let mut users_with_course_module_completions: HashMap<Uuid, UserWithModuleCompletions> =
        users_with_course_module_completions_list
            .into_iter()
            .filter_map(|o| {
                let details = user_id_to_details_map.get(&o.id);
                details.map(|details| (o, details))
            })
            .map(|u| {
                (
                    u.0.id,
                    UserWithModuleCompletions::from_user_and_details(u.0, u.1.clone()),
                )
            })
            .collect();
    let completions =
        course_module_completions::get_all_with_registration_information_by_course_instance_id(
            conn,
            course_instance.id,
        )
        .await?;
    completions.into_iter().for_each(|x| {
        let user_with_completions = users_with_course_module_completions.get_mut(&x.user_id);
        if let Some(completion) = user_with_completions {
            completion.completed_modules.push(x);
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

pub async fn add_manual_completions(
    conn: &mut PgConnection,
    completion_giver_user_id: Uuid,
    course_instance: &CourseInstance,
    manual_completion_request: &TeacherManualCompletionRequest,
) -> ModelResult<()> {
    let course_module =
        course_modules::get_by_id(conn, manual_completion_request.course_module_id).await?;
    if course_module.course_id != course_instance.course_id {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Course module not part of the course.".to_string(),
            None,
        ));
    }
    let course = courses::get_course(conn, course_instance.course_id).await?;
    let mut tx = conn.begin().await?;
    for completion in manual_completion_request.new_completions.iter() {
        let completion_receiver = users::get_by_id(&mut tx, completion.user_id).await?;
        let completion_receiver_user_details =
            crate::user_details::get_user_details_by_user_id(&mut tx, completion_receiver.id)
                .await?;
        let module_completed =
            course_module_completions::user_has_completed_course_module_on_instance(
                &mut tx,
                completion.user_id,
                manual_completion_request.course_module_id,
                course_instance.id,
            )
            .await?;
        if !module_completed || !manual_completion_request.skip_duplicate_completions {
            course_instance_enrollments::insert_enrollment_if_it_doesnt_exist(
                &mut tx,
                NewCourseInstanceEnrollment {
                    user_id: completion_receiver.id,
                    course_id: course.id,
                    course_instance_id: course_instance.id,
                },
            )
            .await?;
            course_module_completions::insert(
                &mut tx,
                PKeyPolicy::Generate,
                &NewCourseModuleCompletion {
                    course_id: course_instance.course_id,
                    course_instance_id: course_instance.id,
                    course_module_id: manual_completion_request.course_module_id,
                    user_id: completion.user_id,
                    completion_date: completion.completion_date.unwrap_or_else(Utc::now),
                    completion_registration_attempt_date: None,
                    completion_language: course.language_code.clone(),
                    eligible_for_ects: true,
                    email: completion_receiver_user_details.email,
                    grade: completion.grade,
                    // Should passed be false if grade == Some(0)?
                    passed: true,
                },
                CourseModuleCompletionGranter::User(completion_giver_user_id),
            )
            .await?;
            update_module_completion_prerequisite_statuses_for_user(
                &mut tx,
                completion_receiver.id,
                course_instance,
                course
                    .base_module_completion_requires_n_submodule_completions
                    .try_into()?,
            )
            .await?;
        }
    }
    tx.commit().await?;
    Ok(())
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
        let user_details = crate::user_details::get_user_details_by_user_id(conn, user.id).await?;
        let user = ManualCompletionPreviewUser {
            user_id: user.id,
            first_name: user_details.first_name,
            last_name: user_details.last_name,
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
        let module_completed =
            course_module_completions::user_has_completed_course_module_on_instance(
                conn,
                completion.user_id,
                manual_completion_request.course_module_id,
                course_instance.id,
            )
            .await?;
        if module_completed {
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
    pub enable_registering_completion_to_uh_open_university: bool,
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
        course_module_completions::get_latest_by_course_module_instance_and_user_ids(
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
        enable_registering_completion_to_uh_open_university: course_module
            .enable_registering_completion_to_uh_open_university,
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
    pub grade: Option<i32>,
    pub passed: Option<bool>,
    pub enable_registering_completion_to_uh_open_university: bool,
    pub certification_enabled: bool,
    pub certificate_configuration_id: Option<Uuid>,
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
        course_module_completions::get_all_by_course_instance_and_user_id(
            conn,
            course_instance_id,
            user_id,
        )
        .await?
        .into_iter()
        .map(|x| (x.course_module_id, x))
        .collect();

    let all_default_certificate_configurations = crate::certificate_configurations::get_default_certificate_configurations_and_requirements_by_course_instance(conn, course_instance_id).await?;

    let course_module_completion_statuses = course_modules
        .into_iter()
        .map(|module| {
            let mut certificate_configuration_id = None;

            let completion = course_module_completions.get(&module.id);
            let passed = completion.map(|x| x.passed);
            if module.certification_enabled && passed == Some(true) {
                // If passed, show the user the default certificate configuration id so that they can generate their certificate.
                let default_certificate_configuration = all_default_certificate_configurations
                    .iter()
                    .find(|x| x.requirements.course_module_ids.contains(&module.id));
                if let Some(default_certificate_configuration) = default_certificate_configuration {
                    certificate_configuration_id = Some(
                        default_certificate_configuration
                            .certificate_configuration
                            .id,
                    );
                }
            }
            UserModuleCompletionStatus {
                completed: completion.is_some(),
                default: module.is_default_module(),
                module_id: module.id,
                name: module.name.unwrap_or_else(|| course.name.clone()),
                order_number: module.order_number,
                passed,
                grade: completion.and_then(|x| x.grade),
                prerequisite_modules_completed: completion
                    .map_or(false, |x| x.prerequisite_modules_completed),
                enable_registering_completion_to_uh_open_university: module
                    .enable_registering_completion_to_uh_open_university,
                certification_enabled: module.certification_enabled,
                certificate_configuration_id,
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
    if !course_module.enable_registering_completion_to_uh_open_university {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Completion registration is not enabled for this course module.".to_string(),
            None,
        ));
    }
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
        course_module_completions::get_latest_by_course_module_instance_and_user_ids(
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
    let registration_link = match course_module.completion_registration_link_override.as_ref() {
        Some(link_override) => link_override.clone(),
        None => {
            let uh_course_code = course_module.uh_course_code.clone().ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "Course module doesn't have an assossiated University of Helsinki course code."
                        .to_string(),
                    None,
                )
            })?;
            open_university_registration_links::get_link_by_course_code(conn, &uh_course_code)
                .await?
        }
    };
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
            chapters::NewChapter,
            course_modules::{
                self, AutomaticCompletionRequirements, CompletionPolicy, NewCourseModule,
            },
            exercises::{self, ActivityProgress, GradingProgress},
            library::content_management,
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
            insert_data!(tx: tx; :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise);
            let automatic_completion_policy =
                CompletionPolicy::Automatic(AutomaticCompletionRequirements {
                    course_module_id: course_module.id,
                    number_of_exercises_attempted_treshold: Some(0),
                    number_of_points_treshold: Some(0),
                    requires_exam: false,
                });
            courses::update_course_base_module_completion_count_requirement(tx.as_mut(), course, 1)
                .await
                .unwrap();
            let course_module_2 = course_modules::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                &NewCourseModule::new(course, Some("Module 2".to_string()), 1),
            )
            .await
            .unwrap();
            let (chapter_2, page2) = content_management::create_new_chapter(
                tx.as_mut(),
                PKeyPolicy::Generate,
                &NewChapter {
                    name: "chapter 2".to_string(),
                    color: None,
                    course_id: course,
                    chapter_number: 2,
                    front_page_id: None,
                    opens_at: None,
                    deadline: None,
                    course_module_id: Some(course_module_2.id),
                },
                user,
                |_, _, _| unimplemented!(),
                |_| unimplemented!(),
            )
            .await
            .unwrap();

            let exercise_2 = exercises::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                course,
                "",
                page2.id,
                chapter_2.id,
                0,
            )
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

    // TODO: New automatic completion tests?
}
