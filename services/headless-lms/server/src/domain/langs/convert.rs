//! Contains the Convert trait for converting between langs API types and headless-lms types.

use headless_lms_models::{
    course_instances::CourseInstanceWithCourseInfo,
    exercise_tasks::CourseMaterialExerciseTask,
    library::grading::{
        StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult,
        StudentExerciseTaskSubmission,
    },
};
use headless_lms_utils::prelude::BackendError;
use mooc_langs_api as api;

use crate::domain::error::{ControllerError, ControllerErrorType};

pub trait Convert<T> {
    fn convert(self) -> T;
}

impl<T, U> Convert<Vec<T>> for Vec<U>
where
    U: Convert<T>,
{
    fn convert(self) -> Vec<T> {
        self.into_iter().map(Convert::convert).collect()
    }
}

impl Convert<api::CourseInstance> for CourseInstanceWithCourseInfo {
    fn convert(self) -> api::CourseInstance {
        api::CourseInstance {
            default_instance: self.course_instance_name.is_none(),
            course_id: self.course_id,
            course_name: self.course_name,
            course_description: self.course_description,
            id: self.course_instance_id,
            instance_name: self.course_instance_name,
            instance_description: self.course_instance_description,
        }
    }
}

impl Convert<StudentExerciseSlideSubmission> for api::ExerciseSlideSubmission {
    fn convert(self) -> StudentExerciseSlideSubmission {
        StudentExerciseSlideSubmission {
            exercise_slide_id: self.exercise_slide_id,
            exercise_task_submissions: self
                .exercise_task_submissions
                .into_iter()
                .map(Convert::convert)
                .collect(),
        }
    }
}

impl Convert<StudentExerciseTaskSubmission> for api::ExerciseTaskSubmission {
    fn convert(self) -> StudentExerciseTaskSubmission {
        StudentExerciseTaskSubmission {
            exercise_task_id: self.exercise_task_id,
            data_json: self.data_json,
        }
    }
}

impl Convert<api::ExerciseSlideSubmissionResult> for StudentExerciseSlideSubmissionResult {
    fn convert(self) -> api::ExerciseSlideSubmissionResult {
        api::ExerciseSlideSubmissionResult {}
    }
}

pub trait TryConvert<T> {
    fn try_convert(self) -> Result<T, ControllerError>;
}

impl TryConvert<Option<api::ExerciseTask>> for CourseMaterialExerciseTask {
    fn try_convert(self) -> Result<Option<api::ExerciseTask>, ControllerError> {
        use api::exercise_services::tmc;

        let task_info = match self.exercise_service_slug.as_str() {
            "tmc" => api::ExerciseTaskInfo::Tmc(tmc::ExerciseTaskInfo {
                assignment: self.assignment,
                public_spec: self
                    .public_spec
                    .map(serde_json::from_value)
                    .transpose()
                    .map_err(|e| {
                        ControllerError::new(
                            ControllerErrorType::InternalServerError,
                            "Mismatch between tmc public spec and expected schema".to_string(),
                            Some(e.into()),
                        )
                    })?,
                model_solution_spec: self
                    .model_solution_spec
                    .map(serde_json::from_value)
                    .transpose()
                    .map_err(|e| {
                        ControllerError::new(
                            ControllerErrorType::InternalServerError,
                            "Mismatch between tmc public spec and expected schema".to_string(),
                            Some(e.into()),
                        )
                    })?,
            }),
            _ => return Ok(None),
        };
        let task = api::ExerciseTask {
            task_id: self.id,
            order_number: self.order_number,
            task_info,
        };
        Ok(Some(task))
    }
}
