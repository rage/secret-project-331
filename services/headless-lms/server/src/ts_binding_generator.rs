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

        authorization::Action,
        authorization::ActionOnResource,
        authorization::Resource,
        error::ErrorData,
        error::ErrorResponse,
        models_requests::SpecRequest,
    };
}

fn models(target: &mut File) {
    use headless_lms_models::*;

    export! {
        target,

        chapters::Chapter,
        chapters::ChapterStatus,
        chapters::ChapterUpdate,
        chapters::ChapterWithStatus,
        chapters::DatabaseChapter,
        chapters::NewChapter,
        chapters::UserCourseInstanceChapterProgress,
        course_instance_enrollments::CourseInstanceEnrollment,
        course_instances::ChapterScore,
        course_instances::CourseInstance,
        course_instances::CourseInstanceForm,
        course_instances::PointMap,
        course_instances::Points,

        course_background_question_answers::CourseBackgroundQuestionAnswer,
        course_background_question_answers::NewCourseBackgroundQuestionAnswer,

        course_background_questions::CourseBackgroundQuestionsAndAnswers,
        course_background_questions::CourseBackgroundQuestion,
        course_background_questions::CourseBackgroundQuestionType,

        course_module_completions::CourseModuleCompletionWithRegistrationInfo,

        course_modules::AutomaticCompletionRequirements,
        course_modules::CompletionPolicy,
        course_modules::CourseModule,
        course_modules::NewCourseModule,
        course_modules::ModifiedModule,
        course_modules::ModuleUpdates,
        course_modules::NewModule,

        courses::Course,
        courses::CourseCount,
        courses::CourseStructure,
        courses::CourseUpdate,
        courses::NewCourse,
        courses::CourseBreadcrumbInfo,

        email_templates::EmailTemplate,
        email_templates::EmailTemplateNew,
        email_templates::EmailTemplateUpdate,
        exams::CourseExam,
        exams::Exam,
        exams::ExamEnrollment,
        exams::ExamInstructions,
        exams::ExamInstructionsUpdate,
        exams::NewExam,
        exams::OrgExam,
        exercise_repositories::ExerciseRepository,
        exercise_repositories::ExerciseRepositoryStatus,
        exercise_service_info::CourseMaterialExerciseServiceInfo,
        exercise_service_info::ExerciseServiceInfoApi,
        exercise_services::ExerciseService,
        exercise_services::ExerciseServiceIframeRenderingInfo,
        exercise_services::ExerciseServiceNewOrUpdate,
        exercise_slide_submissions::AnswerRequiringAttention,
        exercise_slide_submissions::ExerciseAnswersInCourseRequiringAttentionCount,
        exercise_slide_submissions::ExerciseSlideSubmission,
        exercise_slide_submissions::ExerciseSlideSubmissionCount,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByExercise,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByWeekAndHour,
        exercise_slide_submissions::ExerciseSlideSubmissionInfo,
        exercise_task_submissions::PeerReviewsRecieved,
        exercise_slides::CourseMaterialExerciseSlide,
        exercise_slides::ExerciseSlide,
        exercise_task_gradings::ExerciseTaskGrading,
        exercise_task_gradings::ExerciseTaskGradingResult,
        exercise_task_gradings::UserPointsUpdateStrategy,
        exercise_task_submissions::ExerciseTaskSubmission,
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

        glossary::Term,
        glossary::TermUpdate,

        library::grading::AnswerRequiringAttentionWithTasks,
        library::grading::AnswersRequiringAttention,
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

        page_history::HistoryChangeReason,
        page_history::PageHistory,
        pages::CmsPageExercise,
        pages::CmsPageExerciseSlide,
        pages::CmsPageExerciseTask,
        pages::CmsPageUpdate,
        pages::ContentManagementPage,
        pages::CoursePageWithUserData,
        pages::ExerciseWithExerciseTasks,
        pages::HistoryRestoreData,
        pages::IsChapterFrontPage,
        pages::NewPage,
        pages::Page,
        pages::PageChapterAndCourseInformation,
        pages::PageInfo,
        pages::PageNavigationInformation,
        pages::PageRoutingData,
        pages::PageSearchRequest,
        pages::PageSearchResult,
        pages::PageWithExercises,
        peer_review_configs::CourseMaterialPeerReviewConfig,
        peer_review_configs::CmsPeerReviewConfig,
        peer_review_configs::CmsPeerReviewConfiguration,
        peer_review_configs::PeerReviewAcceptingStrategy,
        peer_review_configs::PeerReviewConfig,
        peer_review_questions::CmsPeerReviewQuestion,
        peer_review_questions::PeerReviewQuestion,
        peer_review_questions::PeerReviewQuestionType,
        peer_review_question_submissions::PeerReviewAnswer,
        peer_review_question_submissions::PeerReviewQuestionAndAnswer,
        peer_review_question_submissions::PeerReviewQuestionSubmission,
        peer_review_question_submissions::PeerReviewWithQuestionsAndAnswers,
        pending_roles::PendingRole,
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

        regradings::NewRegrading,
        regradings::Regrading,
        regradings::RegradingInfo,
        regradings::RegradingSubmissionInfo,
        repository_exercises::RepositoryExercise,
        roles::RoleDomain,
        roles::RoleInfo,
        roles::RoleUser,
        roles::UserRole,

        teacher_grading_decisions::NewTeacherGradingDecision,
        teacher_grading_decisions::TeacherDecisionType,
        teacher_grading_decisions::TeacherGradingDecision,

        user_course_settings::UserCourseSettings,
        user_exercise_states::ExerciseUserCounts,
        user_exercise_states::ReviewingStage,
        user_exercise_states::UserCourseInstanceChapterExerciseProgress,
        user_exercise_states::UserCourseInstanceProgress,
        user_exercise_states::UserExerciseState,
        users::User,

        user_course_instance_exercise_service_variables::UserCourseInstanceExerciseServiceVariable,
    };
}

fn controllers(target: &mut File) {
    use crate::controllers::*;

    // root
    export! {
        target,

        UploadResult,
    };

    // auth
    {
        use auth::*;
        export! {
            target,

            CreateAccountDetails,
            Login,
            UserInfo,
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
            course_instances::SaveCourseSettingsPayload,
        };
    }

    // main_frontend
    {
        use main_frontend::*;
        export! {
            target,

            courses::GetFeedbackQuery,
            exams::ExamCourseInfo,
            exercise_repositories::NewExerciseRepository,
            exercises::ExerciseSubmissions,
            feedback::MarkAsRead,
            proposed_edits::GetEditProposalsQuery,
            roles::RoleQuery,
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
