use crate::controllers::{
    auth::Login,
    course_material::{
        exams::{ExamData, ExamEnrollmentData},
        submissions::PreviousSubmission,
    },
    main_frontend::{
        courses::GetFeedbackQuery,
        exams::ExamCourseInfo,
        exercises::ExerciseSubmissions,
        feedback::MarkAsRead,
        proposed_edits::GetEditProposalsQuery,
        roles::{RoleInfo, RoleQuery},
    },
    ErrorData, ErrorResponse, UploadResult,
};
use headless_lms_models::*;
use headless_lms_utils::pagination::Pagination;

macro_rules! export {
    ($target:expr, $($types:ty),*) => {
        {
            let target = $target;
            fn _export(target: &mut impl ::std::io::Write) -> ::std::result::Result<(), ::std::io::Error> {
                $(
                    writeln!(target, "export {}\n", <$types as ::ts_rs::TS>::decl())?;
                )*
                Ok(())
            }
            _export(target)
        }
    };
}

#[test]
fn ts_binding_generator() {
    let mut target = std::fs::File::create("../../../shared-module/src/bindings.ts").unwrap();
    let res = export! {
        &mut target,

        glossary::Term,
        glossary::TermUpdate,

        chapters::Chapter,
        chapters::DatabaseChapter,
        chapters::ChapterStatus,
        chapters::ChapterUpdate,
        chapters::ChapterWithStatus,
        chapters::NewChapter,
        chapters::UserCourseInstanceChapterProgress,

        course_instance_enrollments::CourseInstanceEnrollment,

        course_instances::ChapterScore,
        course_instances::CourseInstance,
        course_instances::CourseInstanceForm,
        course_instances::PointMap,
        course_instances::Points,
        course_instances::VariantStatus,

        courses::Course,
        courses::CourseStructure,
        courses::CourseUpdate,
        courses::NewCourse,
        courses::CourseCount,

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
        pages::PageChapterAndCourseInformation,

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

        roles::RoleUser,
        roles::RoleDomain,
        roles::UserRole,

        submissions::Submission,
        submissions::SubmissionCount,
        submissions::SubmissionCountByWeekAndHour,
        submissions::SubmissionCountByExercise,
        submissions::SubmissionInfo,
        submissions::SubmissionResult,
        submissions::NewSubmission,
        submissions::GradingResult,

        user_course_settings::UserCourseSettings,

        user_exercise_states::UserCourseInstanceChapterExerciseProgress,
        user_exercise_states::UserCourseInstanceProgress,
        user_exercise_states::ExerciseUserCounts,

        users::User,

        RoleQuery,
        RoleInfo,
        PreviousSubmission,
        ExamData,
        ExamEnrollmentData,
        ExamCourseInfo,
        Login,
        UploadResult,
        ExerciseSubmissions,
        MarkAsRead,
        GetFeedbackQuery,
        GetEditProposalsQuery,
        ErrorResponse,
        ErrorData,
        Pagination
    };
    res.unwrap();
}
