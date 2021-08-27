#[cfg(test)]
use crate::{
    controllers::{
        auth::Login,
        main_frontend::{
            courses::GetFeedbackQuery, exercises::ExerciseSubmissions, feedback::MarkAsRead,
        },
        UploadResult,
    },
    models::{
        chapters::{Chapter, ChapterStatus, ChapterUpdate, ChapterWithStatus, NewChapter},
        course_instance_enrollments::CourseInstanceEnrollment,
        course_instances::{CourseInstance, VariantStatus},
        courses::{Course, CourseStructure, CourseUpdate, NewCourse},
        email_templates::{EmailTemplate, EmailTemplateNew, EmailTemplateUpdate},
        exercise_service_info::{CourseMaterialExerciseServiceInfo, ExerciseServiceInfoApi},
        exercise_tasks::{CourseMaterialExerciseTask, ExerciseTask},
        exercises::{
            ActivityProgress, CourseMaterialExercise, Exercise, ExerciseStatus, GradingProgress,
            PlaygroundExample, PlaygroundExampleData,
        },
        feedback::{Feedback, FeedbackBlock, FeedbackCount, NewFeedback},
        gradings::{Grading, UserPointsUpdateStrategy},
        organizations::Organization,
        page_history::{HistoryChangeReason, PageHistory},
        pages::{
            ExerciseWithExerciseTasks, HistoryRestoreData, NewPage, NormalizedCmsExercise,
            NormalizedCmsExerciseTask, Page, PageRoutingData, PageUpdate, PageWithExercises,
        },
        submissions::{
            NewSubmission, Submission, SubmissionCount, SubmissionCountByExercise,
            SubmissionCountByWeekAndHour, SubmissionInfo, SubmissionResult,
        },
        user_exercise_states::UserProgress,
    },
    utils::pagination::Pagination,
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
  ExerciseServiceInfoApi,
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
  SubmissionInfo,
  PageHistory,
  HistoryChangeReason,
  HistoryRestoreData,
  Feedback,
  MarkAsRead,
  NewFeedback,
  FeedbackBlock,
  FeedbackCount,
  GetFeedbackQuery,
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
  Pagination,
  // returned from the API as serde_json::Value
  ExerciseTask,
  ExerciseWithExerciseTasks,
  NormalizedCmsExercise,
  NormalizedCmsExerciseTask,
  PlaygroundExample,PlaygroundExampleData
    => "../../shared-module/src/bindings.ts"
}
