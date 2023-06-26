//! Conversions between langs API types and headless-lms types.

use headless_lms_models::{
    course_background_question_answers::NewCourseBackgroundQuestionAnswer,
    course_background_questions::{CourseBackgroundQuestion, CourseBackgroundQuestionType},
    course_instances::CourseInstance,
    courses::Course,
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

impl Convert<api::CourseBackgroundQuestionType> for CourseBackgroundQuestionType {
    fn convert(self) -> api::CourseBackgroundQuestionType {
        match self {
            CourseBackgroundQuestionType::Checkbox => api::CourseBackgroundQuestionType::Checkbox,
            CourseBackgroundQuestionType::Text => api::CourseBackgroundQuestionType::Text,
        }
    }
}

impl Convert<api::Course> for Course {
    fn convert(self) -> api::Course {
        api::Course {
            id: self.id,
            name: self.name,
            description: self.description,
        }
    }
}

impl Convert<api::CourseInstance> for CourseInstance {
    fn convert(self) -> api::CourseInstance {
        api::CourseInstance {
            id: self.id,
            name: self.name,
            description: self.description,
        }
    }
}

impl Convert<api::CourseInstanceEnrollmentBackgroundQuestion> for CourseBackgroundQuestion {
    fn convert(self) -> api::CourseInstanceEnrollmentBackgroundQuestion {
        api::CourseInstanceEnrollmentBackgroundQuestion {
            id: self.id,
            course_instance_id: self.id,
            course_id: self.course_id,
            question_text: self.question_text,
            question_type: self.question_type.convert(),
        }
    }
}

impl Convert<NewCourseBackgroundQuestionAnswer>
    for api::CourseInstanceEnrollmentBackgroundQuestionAnswer
{
    fn convert(self) -> NewCourseBackgroundQuestionAnswer {
        NewCourseBackgroundQuestionAnswer {
            course_background_question_id: self.question_id,
            answer_value: self.answer,
        }
    }
}
