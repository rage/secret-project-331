//! Contains the Convert trait for converting between langs API types and headless-lms types.

use headless_lms_models::{
    course_instances::CourseInstance, exercise_tasks::CourseMaterialExerciseTask,
    exercises::Exercise,
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

impl Convert<api::CourseInstance> for CourseInstance {
    fn convert(self) -> api::CourseInstance {
        api::CourseInstance {
            id: self.id,
            course_id: self.course_id,
            name: self.name,
            description: self.description,
        }
    }
}

impl Convert<api::Exercise> for Exercise {
    fn convert(self) -> api::Exercise {
        api::Exercise {
            id: self.id,
            name: self.name,
            deadline: self.deadline,
        }
    }
}

impl Convert<api::ExerciseTask> for CourseMaterialExerciseTask {
    fn convert(self) -> api::ExerciseTask {
        api::ExerciseTask { id: self.id }
    }
}
