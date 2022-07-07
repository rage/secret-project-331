use crate::{
    course_module_completions::{self, NewCourseModuleCompletion},
    course_modules::{self, CourseModule},
    courses::{self, Course},
    open_university_registration_links,
    prelude::*,
    user_course_settings,
    user_exercise_states::{self, UserCourseInstanceMetrics},
    users,
};

/// Checks whether the course module can be completed automatically and creates an entry for completion
/// if the user meets the criteria.
///
/// This function is a no-op if the completion already exists or can't be granted. That way it can be
/// called during a generic exercise state update. In future, it could return a value indicating the
/// result.
pub async fn grant_automatic_completion_if_eligible(
    conn: &mut PgConnection,
    course_module: &CourseModule,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let user_metrics = user_exercise_states::get_single_module_course_instance_metrics(
        conn,
        course_instance_id,
        course_module.id,
        user_id,
    )
    .await?;
    if user_has_completed_course_module(conn, course_module.id, course_instance_id, user_id).await?
    {
        // If user already has a completion, do not attempt to create a new completion.
        Ok(())
    } else if user_is_eligible_for_automatic_completion(course_module, &user_metrics) {
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
        Ok(())
    } else {
        // Can't grant automatic completion; no-op.
        Ok(())
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

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCompletionInformation {
    pub course_module_completion_id: Uuid,
    pub course_name: String,
    pub uh_course_code: String,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

pub async fn get_user_completion_information(
    conn: &mut PgConnection,
    user_id: Uuid,
    course: &Course,
) -> ModelResult<UserCompletionInformation> {
    let user = users::get_by_id(conn, user_id).await?;
    let course_module = course_modules::get_default_by_course_id(conn, course.id).await?;
    let user_settings =
        user_course_settings::get_user_course_settings_by_course_id(conn, user.id, course.id)
            .await?
            .ok_or_else(|| ModelError::Generic("Missing settings".to_string()))?;
    let course_module_completion =
        course_module_completions::get_by_course_module_instance_and_user_ids(
            conn,
            course_module.id,
            user_settings.current_course_instance_id,
            user.id,
        )
        .await?;
    // Course code is required only so that fetching the link later works.
    let uh_course_code = course_module.uh_course_code.ok_or_else(|| {
        ModelError::PreconditionFailed("Course module is missing uh_course_code.".to_string())
    })?;
    Ok(UserCompletionInformation {
        course_module_completion_id: course_module_completion.id,
        course_name: course_module.name.unwrap_or_else(|| course.name.clone()),
        uh_course_code,
        email: course_module_completion.email,
        first_name: user.first_name,
        last_name: user.last_name,
    })
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CompletionRegistrationLink {
    pub url: String,
}

pub async fn get_completion_registration_link_and_save_attempt(
    conn: &mut PgConnection,
    user_id: Uuid,
    course: &Course,
) -> ModelResult<CompletionRegistrationLink> {
    let user = users::get_by_id(conn, user_id).await?;
    let course_module = course_modules::get_default_by_course_id(conn, course.id).await?;
    let user_settings =
        user_course_settings::get_user_course_settings_by_course_id(conn, user.id, course.id)
            .await?
            .ok_or_else(|| ModelError::Generic("Missing settings".to_string()))?;
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
    let uh_course_code = course_module.uh_course_code.ok_or_else(|| {
        ModelError::PreconditionFailed(
            "Course module doesn't have an assossiated University of Helsinki course code."
                .to_string(),
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
}
