#[cfg(test)]
use crate::{
    controllers::{
        auth::Login,
        main_frontend::{
            courses::GetFeedbackQuery, exams::ExamCourseInfo, exercises::ExerciseSubmissions,
            feedback::MarkAsRead, proposed_edits::GetEditProposalsQuery,
        },
        ErrorResponse, UploadResult,
    },
    models::*,
    utils::pagination::Pagination,
};

ts_rs::export! {
  chapters::Chapter,
  chapters::ChapterStatus,
  chapters::ChapterUpdate,
  chapters::ChapterWithStatus,
  chapters::NewChapter,
  chapters::UserCourseInstanceChapterProgress,

  course_instance_enrollments::CourseInstanceEnrollment,

  course_instances::CourseInstance,
  course_instances::CourseInstanceForm,
  course_instances::VariantStatus,

  courses::Course,
  courses::CourseStructure,
  courses::CourseUpdate,
  courses::NewCourse,

  email_templates::EmailTemplate,
  email_templates::EmailTemplateNew,
  email_templates::EmailTemplateUpdate,

  exams::CourseExam,
  exams::Exam,
  exams::ExamEnrollment,

  exercise_service_info::CourseMaterialExerciseServiceInfo,
  exercise_service_info::ExerciseServiceInfoApi,

  exercise_services::ExerciseService,
  exercise_services::ExerciseServiceNewOrUpdate,

  exercise_slides::ExerciseSlide,

  exercise_tasks::CourseMaterialExerciseTask,
  exercise_tasks::ExerciseTask,

  exercises::ActivityProgress,
  exercises::CourseMaterialExercise,
  exercises::Exercise,
  exercises::ExerciseStatus,
  exercises::GradingProgress,

  feedback::Feedback,
  feedback::FeedbackBlock,
  feedback::FeedbackCount,
  feedback::NewFeedback,

  gradings::Grading,
  gradings::UserPointsUpdateStrategy,

  organizations::Organization,

  page_history::PageHistory,
  page_history::HistoryChangeReason,

  pages::CmsPageExercise,
  pages::CmsPageExerciseSlide,
  pages::CmsPageExerciseTask,
  pages::CmsPageUpdate,
  pages::ContentManagementPage,
  pages::CoursePageWithUserData,
  pages::ExerciseWithExerciseTasks,
  pages::HistoryRestoreData,
  pages::Page,
  pages::PageRoutingDataWithChapterStatus,
  pages::PageSearchRequest,
  pages::PageSearchResult,
  pages::PageWithExercises,
  pages::NewPage,

  playground_examples::PlaygroundExample,
  playground_examples::PlaygroundExampleData,

  proposed_block_edits::BlockProposal,
  proposed_block_edits::BlockProposalAction,
  proposed_block_edits::BlockProposalInfo,
  proposed_block_edits::NewProposedBlockEdit,
  proposed_block_edits::ProposalStatus,

  proposed_page_edits::EditProposalInfo,
  proposed_page_edits::NewProposedPageEdits,
  proposed_page_edits::PageProposal,
  proposed_page_edits::ProposalCount,

  submissions::Submission,
  submissions::SubmissionCount,
  submissions::SubmissionCountByWeekAndHour,
  submissions::SubmissionCountByExercise,
  submissions::SubmissionInfo,
  submissions::SubmissionResult,
  submissions::NewSubmission,

  user_course_settings::UserCourseSettings,

  user_exercise_states::UserCourseInstanceChapterExerciseProgress,
  user_exercise_states::UserCourseInstanceProgress,

  ExamCourseInfo,
  Login,
  UploadResult,
  ExerciseSubmissions,
  MarkAsRead,
  GetFeedbackQuery,
  GetEditProposalsQuery,
  ErrorResponse,
  Pagination
    => "../../shared-module/src/bindings.ts"
}
