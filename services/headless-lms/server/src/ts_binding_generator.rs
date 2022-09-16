use std::fs::File;
use std::io::Write;

macro_rules! export {
    ($target:expr, $($types:ty),* $(,)?) => {
        {
            $(

                writeln!($target, "export {}\n", <$types as ::ts_rs::TS>::decl()).unwrap();
            )*
        }
    };
}

#[test]
fn ts_binding_generator() {
    let mut target = File::create("../../../shared-module/src/bindings.ts").unwrap();
    domain(&mut target);
    models(&mut target);
    controllers(&mut target);
    utils(&mut target);
}

fn domain(target: &mut File) {
    use crate::domain::*;

    export! {
        target,

        authorization::ActionOnResource,
        authorization::Action,
        authorization::Resource,
    };
}

fn models(target: &mut File) {
    use headless_lms_models::*;

    export! {
        target,

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
        course_modules::ModifiedModule,
        course_modules::ModuleUpdates,
        course_modules::NewModule,

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

        exercise_repositories::ExerciseRepository,
        exercise_repositories::ExerciseRepositoryStatus,

        exercise_service_info::CourseMaterialExerciseServiceInfo,
        exercise_service_info::ExerciseServiceInfoApi,

        exercise_services::ExerciseService,
        exercise_services::ExerciseServiceNewOrUpdate,
        exercise_services::ExerciseServiceIframeRenderingInfo,

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
        library::progressing::CourseInstanceCompletionSummary,
        library::progressing::ManualCompletionPreview,
        library::progressing::ManualCompletionPreviewUser,
        library::progressing::TeacherManualCompletion,
        library::progressing::TeacherManualCompletionRequest,
        library::progressing::UserCompletionInformation,
        library::progressing::UserCourseModuleCompletion,
        library::progressing::UserModuleCompletionStatus,
        library::progressing::UserWithModuleCompletions,

        material_references::MaterialReference,
        material_references::NewMaterialReference,

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

        peer_review_configs::PeerReviewConfig,
        peer_review_configs::PeerReviewAcceptingStrategy,
        peer_review_configs::CmsPeerReviewConfig,
        peer_review_configs::CmsPeerReviewConfiguration,

        peer_review_questions::CmsPeerReviewQuestion,
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

        repository_exercises::RepositoryExercise,

        exercise_slide_submissions::ExerciseSlideSubmission,
        exercise_slide_submissions::ExerciseSlideSubmissionCount,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByExercise,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByWeekAndHour,
        exercise_slide_submissions::ExerciseSlideSubmissionInfo,
        exercise_slide_submissions::ExerciseAnswersInCourseRequiringAttentionCount,
        exercise_slide_submissions::AnswerRequiringAttention,

        teacher_grading_decisions::TeacherGradingDecision,
        teacher_grading_decisions::TeacherDecisionType,
        teacher_grading_decisions::NewTeacherGradingDecision,

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
        user_exercise_states::UserExerciseState,
        users::User,
    };
}

fn controllers(target: &mut File) {
    use crate::controllers::*;

    // root
    export! {
        target,

        ErrorData,
        ErrorResponse,
        UploadResult,
    };

    // auth
    {
        use auth::*;
        export! {
            target,

            CreateAccountDetails,
            UserInfo,
            Login,
        };
    }

    // course_material
    {
        use course_material::*;
        export! {
            target,

            courses::ChaptersWithStatus,
            courses::CourseMaterialCourseModule,
            exams::ExamData,
            exams::ExamEnrollmentData,
        };
    }

    // main_frontend
    {
        use main_frontend::*;
        export! {
            target,

            roles::RoleQuery,
            roles::RoleInfo,
            exams::ExamCourseInfo,
            exercises::ExerciseSubmissions,
            exercises::AnswersRequiringAttention,
            exercises::AnswerRequiringAttentionWithTasks,
            exercise_repositories::NewExerciseRepository,
            feedback::MarkAsRead,
            courses::GetFeedbackQuery,
            proposed_edits::GetEditProposalsQuery,
        };
    }
}

fn utils(target: &mut File) {
    use headless_lms_utils::*;

    export! {
        target,

        pagination::Pagination,
        url_to_oembed_endpoint::OEmbedResponse,
    };
}
