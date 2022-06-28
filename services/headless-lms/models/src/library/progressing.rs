use crate::{
    course_module_completions::{self, NewCourseModuleCompletion},
    course_modules::{self, CourseModule},
    courses,
    prelude::*,
    user_exercise_states::{self, UserCourseInstanceMetrics},
    users,
};

/// Validates and creates an automatic course completion for an user.
///
/// Currently only completions without grades are supported for automatic completions.
pub async fn process_automatic_module_completion_request(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let course_module = course_modules::get_by_id(conn, course_module_id).await?;
    if !course_module.automatic_completion {
        return Err(ModelError::InvalidRequest(
            "Course module doesn't support automatic completion.".to_string(),
        ));
    }
    let course = courses::get_course(conn, course_module.course_id).await?;
    let user_metrics = user_exercise_states::get_single_module_course_instance_metrics(
        conn,
        course_instance_id,
        course_module_id,
        user_id,
    )
    .await?;
    if user_is_eligible_for_automatic_completion(&course_module, &user_metrics) {
        let user = users::get_by_id(conn, user_id).await?;
        let _completion_id = course_module_completions::insert(
            conn,
            &NewCourseModuleCompletion {
                course_id: course_module.course_id,
                course_module_id,
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
        Err(ModelError::PreconditionFailed(
            "User is not eligible for automatic completion.".to_string(),
        ))
    }
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
