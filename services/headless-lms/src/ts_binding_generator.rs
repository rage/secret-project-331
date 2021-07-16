#[cfg(test)]
use crate::{
    controllers::{cms::pages::UploadResult, main_frontend::exercises::ExerciseSubmissions},
    models::{
        chapters::{Chapter, ChapterStatus, ChapterWithStatus},
        course_instance_enrollments::CourseInstanceEnrollment,
        course_instances::{CourseInstance, VariantStatus},
        courses::{Course, CourseStructure},
        email_templates::EmailTemplate,
        exercise_service_info::CourseMaterialExerciseServiceInfo,
        exercise_tasks::CourseMaterialExerciseTask,
        exercises::{
            ActivityProgress, CourseMaterialExercise, Exercise, ExerciseStatus, GradingProgress,
        },
        gradings::{Grading, UserPointsUpdateStrategy},
        organizations::Organization,
        pages::{Page, PageRoutingData, PageWithExercises},
        submissions::{
            Submission, SubmissionCount, SubmissionCountByExercise, SubmissionCountByWeekAndHour,
            SubmissionResult,
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
  UserPointsUpdateStrategy
    => "../../shared-module/src/bindings.ts"
}
