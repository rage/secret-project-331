#[cfg(feature = "ts_rs")]
use crate::controllers::{
    auth::{CreateAccountDetails, Login},
    course_material::{
        courses::{ChaptersWithStatus, CourseMaterialCourseModule},
        exams::{ExamData, ExamEnrollmentData},
    },
    main_frontend::{
        courses::{GetFeedbackQuery},
        exams::ExamCourseInfo,
        exercises::ExerciseSubmissions,
        feedback::MarkAsRead,
        proposed_edits::GetEditProposalsQuery,
        roles::{RoleInfo, RoleQuery},
    },
    ErrorData, ErrorResponse, UploadResult,
};

#[cfg(feature = "ts_rs")]
use crate::domain::*;

#[cfg(feature = "ts_rs")]
use headless_lms_models::*;
#[cfg(feature = "ts_rs")]
use headless_lms_utils::pagination::Pagination;
#[cfg(feature = "ts_rs")]
use headless_lms_utils::url_to_oembed_endpoint::OEmbedResponse;

#[cfg(feature = "ts_rs")]
macro_rules! export {
    ($target:expr, $($types:ty),*) => {
        {
            let target = $target;
            fn _export(target: &mut impl ::std::io::Write) -> ::std::result::Result<(), ::std::io::Error> {
                $(
                    #[cfg(feature = "ts_rs")]
                    writeln!(target, "export {}\n", <$types as ::ts_rs::TS>::decl())?;
                )*
                Ok(())
            }
            _export(target)
        }
    };
}

#[test]
#[cfg(feature = "ts_rs")]
fn ts_binding_generator() {
    let mut target = std::fs::File::create("../../../shared-module/src/bindings.ts").unwrap();
    let res = export! {
        &mut target,

        authorization::ActionOnResource,
        authorization::Action,
        authorization::Resource,

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

        course_modules::CourseModule,

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
        exams::NewExam,
        exams::OrgExam,
        exams::ExamInstructions,
        exams::ExamInstructionsUpdate,

        exercise_service_info::CourseMaterialExerciseServiceInfo,
        exercise_service_info::ExerciseServiceInfoApi,

        exercise_services::ExerciseService,
        exercise_services::ExerciseServiceNewOrUpdate,

        exercise_slides::CourseMaterialExerciseSlide,
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

        library::grading::StudentExerciseSlideSubmission,
        library::grading::StudentExerciseSlideSubmissionResult,
        library::grading::StudentExerciseTaskSubmission,
        library::grading::StudentExerciseTaskSubmissionResult,

        library::peer_reviewing::CourseMaterialPeerReviewData,
        library::peer_reviewing::CourseMaterialPeerReviewDataAnswerToReview,
        library::peer_reviewing::CourseMaterialPeerReviewQuestionAnswer,
        library::peer_reviewing::CourseMaterialPeerReviewSubmission,

        library::progressing::CompletionRegistrationLink,
        library::progressing::UserCompletionInformation,
        library::progressing::UserModuleCompletionStatus,

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
        pages::PageInfo,
        pages::PageSearchRequest,
        pages::PageSearchResult,
        pages::PageWithExercises,
        pages::NewPage,
        pages::PageChapterAndCourseInformation,
        pages::IsChapterFrontPage,
        pages::PageRoutingData,
        pages::PageNavigationInformation,

        peer_reviews::PeerReview,
        peer_reviews::PeerReviewAcceptingStrategy,

        peer_review_questions::NewPeerReviewQuestion,
        peer_review_questions::PeerReviewQuestion,
        peer_review_questions::PeerReviewQuestionType,

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

        exercise_slide_submissions::ExerciseSlideSubmission,
        exercise_slide_submissions::ExerciseSlideSubmissionCount,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByExercise,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByWeekAndHour,
        exercise_slide_submissions::ExerciseSlideSubmissionInfo,

        exercise_task_gradings::ExerciseTaskGrading,
        exercise_task_gradings::ExerciseTaskGradingResult,
        exercise_task_gradings::UserPointsUpdateStrategy,

        exercise_task_submissions::ExerciseTaskSubmission,

        roles::RoleUser,
        roles::RoleDomain,
        roles::UserRole,

        user_course_settings::UserCourseSettings,

        user_exercise_states::UserCourseInstanceChapterExerciseProgress,
        user_exercise_states::UserCourseInstanceProgress,
        user_exercise_states::ExerciseUserCounts,
        user_exercise_states::ReviewingStage,

        users::User,

        ChaptersWithStatus,
        CourseMaterialCourseModule,
        CreateAccountDetails,
        RoleQuery,
        RoleInfo,
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
        Pagination,
        OEmbedResponse,

        material_references::MaterialReference,
        material_references::NewMaterialReference
    };
    res.unwrap();
}
