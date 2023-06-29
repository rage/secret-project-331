//! Contains the Convert trait for converting between langs API types and headless-lms types.

use headless_lms_models::{
    course_instances::CourseInstanceWithCourseInfo,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::Exercise,
    library::grading::{
        StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult,
        StudentExerciseTaskSubmission,
    },
};
use mooc_langs_api as api;

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

impl Convert<api::Exercise> for Exercise {
    fn convert(self) -> api::Exercise {
        api::Exercise {
            id: self.id,
            name: self.name,
            deadline: self.deadline,
            order_number: self.order_number,
        }
    }
}

impl Convert<api::ExerciseTask> for CourseMaterialExerciseTask {
    fn convert(self) -> api::ExerciseTask {
        api::ExerciseTask { id: self.id }
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
