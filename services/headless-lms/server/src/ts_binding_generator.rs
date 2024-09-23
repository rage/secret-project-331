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
    let mut target =
        File::create("../../../shared-module/packages/common/src/bindings.ts").unwrap();
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

        certificate_configuration_to_requirements::CertificateAllRequirements,
        certificate_configurations::CertificateConfiguration,
        certificate_configurations::CertificateConfigurationAndRequirements,
        certificate_configurations::CertificateTextAnchor,
        certificate_configurations::PaperSize,
        chapters::Chapter,
        chapters::ChapterStatus,
        chapters::ChapterUpdate,
        chapters::ChapterWithStatus,
        chapters::DatabaseChapter,
        chapters::NewChapter,
        chapters::UserCourseInstanceChapterProgress,
        chatbot_conversation_messages::ChatbotConversationMessage,
        chatbot_conversations::ChatbotConversation,
        chatbot_conversations::ChatbotConversationInfo,
        code_giveaway_codes::CodeGiveawayCode,
        code_giveaways::CodeGiveaway,
        code_giveaways::NewCodeGiveaway,
        code_giveaways::CodeGiveawayStatus,
        course_background_question_answers::CourseBackgroundQuestionAnswer,
        course_background_question_answers::NewCourseBackgroundQuestionAnswer,
        course_background_questions::CourseBackgroundQuestion,
        course_background_questions::CourseBackgroundQuestionType,
        course_background_questions::CourseBackgroundQuestionsAndAnswers,
        course_instance_enrollments::CourseInstanceEnrollment,
        course_instance_enrollments::CourseInstanceEnrollmentsInfo,
        course_instances::ChapterScore,
        course_instances::CourseInstance,
        course_instances::CourseInstanceForm,
        course_instances::PointMap,
        course_instances::Points,
        course_module_completions::CourseModuleCompletion,
        course_module_completions::CourseModuleCompletionWithRegistrationInfo,
        course_modules::AutomaticCompletionRequirements,
        course_modules::CompletionPolicy,
        course_modules::CourseModule,
        course_modules::ModifiedModule,
        course_modules::ModuleUpdates,
        course_modules::NewCourseModule,
        course_modules::NewModule,
        courses::Course,
        courses::CourseBreadcrumbInfo,
        courses::CourseCount,
        courses::CourseStructure,
        courses::CourseUpdate,
        courses::NewCourse,

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
        exercise_slide_submissions::ExerciseSlideSubmissionAndUserExerciseState,
        exercise_slide_submissions::ExerciseSlideSubmissionAndUserExerciseStateList,
        exercise_slide_submissions::ExerciseSlideSubmissionCount,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByExercise,
        exercise_slide_submissions::ExerciseSlideSubmissionCountByWeekAndHour,
        exercise_slide_submissions::ExerciseSlideSubmissionInfo,
        exercise_slides::CourseMaterialExerciseSlide,
        exercise_slides::ExerciseSlide,
        exercise_task_gradings::ExerciseTaskGrading,
        exercise_task_gradings::ExerciseTaskGradingResult,
        exercise_task_gradings::UserPointsUpdateStrategy,
        exercise_task_submissions::ExerciseTaskSubmission,
        exercise_task_submissions::PeerOrSelfReviewsReceived,
        exercise_tasks::CourseMaterialExerciseTask,
        exercise_tasks::ExerciseTask,
        exercises::ActivityProgress,
        exercises::CourseMaterialExercise,
        exercises::Exercise,
        exercises::ExerciseGradingStatus,
        exercises::ExerciseStatus,
        exercises::ExerciseStatusSummaryForUser,
        exercises::GradingProgress,

        feedback::Feedback,
        feedback::FeedbackBlock,
        feedback::FeedbackCount,
        feedback::NewFeedback,

        generated_certificates::GeneratedCertificate,
        glossary::Term,
        glossary::TermUpdate,

        library::custom_view_exercises::CustomViewExerciseSubmissions,
        library::custom_view_exercises::CustomViewExerciseTaskGrading,
        library::custom_view_exercises::CustomViewExerciseTaskSpec,
        library::custom_view_exercises::CustomViewExerciseTaskSubmission,
        library::custom_view_exercises::CustomViewExerciseTasks,
        library::global_stats::GlobalCourseModuleStatEntry,
        library::global_stats::GlobalStatEntry,
        library::grading::AnswerRequiringAttentionWithTasks,
        library::grading::AnswersRequiringAttention,
        library::grading::StudentExerciseSlideSubmission,
        library::grading::StudentExerciseSlideSubmissionResult,
        library::grading::StudentExerciseTaskSubmission,
        library::grading::StudentExerciseTaskSubmissionResult,
        library::peer_or_self_reviewing::CourseMaterialPeerOrSelfReviewData,
        library::peer_or_self_reviewing::CourseMaterialPeerOrSelfReviewDataAnswerToReview,
        library::peer_or_self_reviewing::CourseMaterialPeerOrSelfReviewQuestionAnswer,
        library::peer_or_self_reviewing::CourseMaterialPeerOrSelfReviewSubmission,
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

        page_audio_files::PageAudioFile,
        page_history::HistoryChangeReason,
        page_history::PageHistory,
        page_visit_datum_summary_by_courses::PageVisitDatumSummaryByCourse,
        page_visit_datum_summary_by_courses_countries::PageVisitDatumSummaryByCoursesCountries,
        page_visit_datum_summary_by_courses_device_types::PageVisitDatumSummaryByCourseDeviceTypes,
        page_visit_datum_summary_by_pages::PageVisitDatumSummaryByPages,
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
        pages::PageDetailsUpdate,
        pages::PageInfo,
        pages::PageNavigationInformation,
        pages::PageRoutingData,
        pages::PageSearchResult,
        pages::PageWithExercises,
        pages::SearchRequest,
        peer_or_self_review_configs::CmsPeerOrSelfReviewConfig,
        peer_or_self_review_configs::CmsPeerOrSelfReviewConfiguration,
        peer_or_self_review_configs::CourseMaterialPeerOrSelfReviewConfig,
        peer_or_self_review_configs::PeerOrSelfReviewConfig,
        peer_or_self_review_configs::PeerReviewProcessingStrategy,
        peer_or_self_review_question_submissions::PeerOrSelfReviewAnswer,
        peer_or_self_review_question_submissions::PeerOrSelfReviewQuestionAndAnswer,
        peer_or_self_review_question_submissions::PeerOrSelfReviewQuestionSubmission,
        peer_or_self_review_question_submissions::PeerReviewWithQuestionsAndAnswers,
        peer_or_self_review_questions::CmsPeerOrSelfReviewQuestion,
        peer_or_self_review_questions::PeerOrSelfReviewQuestion,
        peer_or_self_review_questions::PeerOrSelfReviewQuestionType,
        peer_or_self_review_submissions::PeerOrSelfReviewSubmission,
        peer_review_queue_entries::PeerReviewQueueEntry,
        pending_roles::PendingRole,
        playground_examples::PlaygroundExample,
        playground_examples::PlaygroundExampleData,
        proposed_block_edits::BlockProposal,
        proposed_block_edits::BlockProposalAction,
        proposed_block_edits::BlockProposalInfo,
        proposed_block_edits::EditedBlockNoLongerExistsData,
        proposed_block_edits::EditedBlockStillExistsData,
        proposed_block_edits::NewProposedBlockEdit,
        proposed_block_edits::ProposalStatus,
        proposed_page_edits::EditProposalInfo,
        proposed_page_edits::NewProposedPageEdits,
        proposed_page_edits::PageProposal,
        proposed_page_edits::ProposalCount,

        regradings::NewRegrading,
        regradings::NewRegradingIdType,
        regradings::Regrading,
        regradings::RegradingInfo,
        regradings::RegradingSubmissionInfo,
        repository_exercises::RepositoryExercise,
        research_forms::NewResearchForm,
        research_forms::NewResearchFormQuestion,
        research_forms::NewResearchFormQuestionAnswer,
        research_forms::ResearchForm,
        research_forms::ResearchFormQuestion,
        research_forms::ResearchFormQuestionAnswer,
        roles::RoleDomain,
        roles::RoleInfo,
        roles::RoleUser,
        roles::UserRole,

        student_countries::StudentCountry,
        suspected_cheaters::SuspectedCheaters,
        suspected_cheaters::ThresholdData,

        teacher_grading_decisions::NewTeacherGradingDecision,
        teacher_grading_decisions::TeacherDecisionType,
        teacher_grading_decisions::TeacherGradingDecision,

        user_course_instance_exercise_service_variables::UserCourseInstanceExerciseServiceVariable,
        user_course_settings::UserCourseSettings,
        user_details::UserDetail,
        user_exercise_states::ExerciseUserCounts,
        user_exercise_states::ReviewingStage,
        user_exercise_states::UserCourseInstanceChapterExerciseProgress,
        user_exercise_states::UserCourseInstanceProgress,
        user_exercise_states::UserExerciseState,
        user_research_consents::UserResearchConsent,
        users::User,
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

            course_instances::SaveCourseSettingsPayload,
            courses::ChaptersWithStatus,
            courses::CourseMaterialCourseModule,
            exams::ExamData,
            exams::ExamEnrollmentData,
            exercises::CourseMaterialPeerOrSelfReviewDataWithToken
        };
    }

    // main_frontend
    {
        use main_frontend::*;
        export! {
            target,

            certificates::CertificateConfigurationUpdate,
            courses::GetFeedbackQuery,
            exams::ExamCourseInfo,
            exercise_repositories::NewExerciseRepository,
            exercises::ExerciseSubmissions,
            feedback::MarkAsRead,
            playground_views::PlaygroundViewsMessage,
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
