//! Contains the Convert trait for converting between langs API types and headless-lms types.

use headless_lms_models::{
    course_instances::CourseInstanceWithCourseInfo, exercise_tasks::CourseMaterialExerciseTask,
    exercises::GradingProgress,
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
            course_id: self.course_id,
            course_slug: self.course_slug,
            course_name: self.course_name,
            course_description: self.course_description,
            id: self.course_instance_id,
            instance_name: self.course_instance_name,
            instance_description: self.course_instance_description,
        }
    }
}

impl Convert<api::ExerciseTask> for CourseMaterialExerciseTask {
    fn convert(self) -> api::ExerciseTask {
        api::ExerciseTask {
            task_id: self.id,
            order_number: self.order_number,
            assignment: self.assignment,
            public_spec: self.public_spec,
            model_solution_spec: self.model_solution_spec,
            exercise_service_slug: self.exercise_service_slug,
        }
    }
}

impl Convert<api::GradingProgress> for GradingProgress {
    fn convert(self) -> api::GradingProgress {
        match self {
            Self::Failed => api::GradingProgress::Failed,
            Self::NotReady => api::GradingProgress::NotReady,
            Self::PendingManual => api::GradingProgress::PendingManual,
            Self::Pending => api::GradingProgress::Pending,
            Self::FullyGraded => api::GradingProgress::FullyGraded,
        }
    }
}
