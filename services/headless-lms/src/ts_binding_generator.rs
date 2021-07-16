#[cfg(test)]
use crate::{
    controllers::{
        auth::Login, cms::pages::UploadResult, main_frontend::exercises::ExerciseSubmissions,
    },
    models::{
        chapters::{Chapter, ChapterStatus, ChapterUpdate, ChapterWithStatus, NewChapter},
        course_instance_enrollments::CourseInstanceEnrollment,
        course_instances::{CourseInstance, VariantStatus},
        courses::{Course, CourseStructure, CourseUpdate, NewCourse},
        email_templates::{EmailTemplate, EmailTemplateNew, EmailTemplateUpdate},
        exercise_service_info::CourseMaterialExerciseServiceInfo,
        exercise_tasks::{CourseMaterialExerciseTask, ExerciseTask},
        exercises::{
            ActivityProgress, CourseMaterialExercise, Exercise, ExerciseStatus, GradingProgress,
        },
        gradings::{Grading, UserPointsUpdateStrategy},
        organizations::Organization,
        pages::{
            ExerciseWithExerciseTasks, NewPage, Page, PageRoutingData, PageUpdate,
            PageUpdateExercise, PageUpdateExerciseTask, PageWithExercises,
        },
        submissions::{
            NewSubmission, Submission, SubmissionCount, SubmissionCountByExercise,
            SubmissionCountByWeekAndHour, SubmissionResult,
        },
        user_exercise_states::UserProgress,
    },
};

ts_rs::export! {
  Chapter,
  EmailTemplate,
  CourseStructure,
  Page,
  UploadResult,
  PageWithExercises,
  UserProgress,
  CourseInstanceEnrollment,
  CourseInstance,
  ChapterWithStatus,
  CourseMaterialExercise,
  PageRoutingData,
  SubmissionResult,
  Course,
  Exercise,
  SubmissionCount,
  SubmissionCountByWeekAndHour,
  SubmissionCountByExercise,
  ExerciseSubmissions,
  Organization,
  NewChapter,
  ChapterUpdate,
  EmailTemplateNew,
  EmailTemplateUpdate,
  NewPage,
  PageUpdate,
  NewSubmission,
  NewCourse,
  CourseUpdate,
  Login,
  // dependencies
  VariantStatus,
  ChapterStatus,
  CourseMaterialExerciseTask,
  CourseMaterialExerciseServiceInfo,
  ExerciseStatus,
  Submission,
  Grading,
  ActivityProgress,
  GradingProgress,
  UserPointsUpdateStrategy,
  // returned from the API as serde_json::Value
  ExerciseTask,
  ExerciseWithExerciseTasks,
  PageUpdateExercise,
  PageUpdateExerciseTask
    => "../../shared-module/src/bindings.ts"
}
