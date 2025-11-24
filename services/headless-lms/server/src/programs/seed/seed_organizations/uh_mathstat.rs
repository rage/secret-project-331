use std::sync::Arc;

use headless_lms_models::{
    PKeyPolicy,
    chatbot_configurations::{self, NewChatbotConf},
    chatbot_configurations_models::{self, NewChatbotConfigurationModel},
    course_instances::{self, NewCourseInstance},
    course_modules::{self, AutomaticCompletionRequirements, CompletionPolicy},
    courses::NewCourse,
    library::{self, content_management::CreateNewCourseFixedIds, copying::copy_course},
    organizations,
    roles::{self, RoleDomain, UserRole},
};
use uuid::Uuid;

use sqlx::{Pool, Postgres};

use crate::{
    domain::models_requests::{self, JwtKey},
    programs::seed::{
        seed_courses::{
            CommonCourseData, seed_accessibility_course, seed_chatbot::seed_chatbot_course,
            seed_course_with_peer_review::seed_peer_review_course,
            seed_peer_review_course_without_submissions, seed_sample_course,
            seed_switching_course_instances_course,
        },
        seed_file_storage::SeedFileStorageResult,
        seed_helpers::get_seed_spec_fetcher,
    },
};

use super::super::seed_users::SeedUsersResult;

pub async fn seed_organization_uh_mathstat(
    db_pool: Pool<Postgres>,
    seed_users_result: SeedUsersResult,
    base_url: String,
    jwt_key: Arc<JwtKey>,
    // Passed to this function to ensure the seed file storage has been ran before this. This function will not work is seed file storage has not been ran
    seed_file_storage_result: SeedFileStorageResult,
) -> anyhow::Result<Uuid> {
    info!("seeding organization uh-mathstat");

    let SeedUsersResult {
        teacher_user_id,
        admin_user_id: _,
        language_teacher_user_id: _,
        material_viewer_user_id,
        assistant_user_id: _,
        course_or_exam_creator_user_id: _,
        example_normal_user_ids,
        teaching_and_learning_services_user_id: _,
        student_without_research_consent: _,
        student_without_country: _,
        user_user_id: _,
        student_1_user_id: _,
        student_2_user_id: _,
        student_3_user_id,
        student_4_user_id: _,
        student_5_user_id: _,
        student_6_user_id: _,
        langs_user_id,
        sign_up_user: _,
    } = seed_users_result;
    let _ = seed_file_storage_result;

    let mut conn = db_pool.acquire().await?;

    let uh_mathstat_id = organizations::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("269d28b2-a517-4572-9955-3ed5cecc69bd")?),
        "University of Helsinki, Department of Mathematics and Statistics",
        "uh-mathstat",
        Some("Organization for Mathematics and Statistics courses. This organization creates courses that do require prior experience in mathematics, such as integration and induction."),
        false,
    )
    .await?;

    roles::insert(
        &mut conn,
        material_viewer_user_id,
        UserRole::MaterialViewer,
        RoleDomain::Organization(uh_mathstat_id),
    )
    .await?;

    let new_course = NewCourse {
        name: "Introduction to Statistics".to_string(),
        slug: "introduction-to-statistics".to_string(),
        organization_id: uh_mathstat_id,
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "Introduces you to the wonderful world of statistics!".to_string(),
        is_draft: false,
        is_test_mode: false,
        is_unlisted: false,
        copy_user_permissions: false,
        is_joinable_by_code_only: false,
        join_code: None,
        ask_marketing_consent: false,
        flagged_answers_threshold: Some(3),
        can_add_chatbot: false,
    };
    let (
        statistics_course,
        _statistics_front_page,
        _statistics_default_course_instancem,
        _statistics_default_course_module,
    ) = library::content_management::create_new_course(
        &mut conn,
        PKeyPolicy::Fixed(CreateNewCourseFixedIds {
            course_id: Uuid::parse_str("f307d05f-be34-4148-bb0c-21d6f7a35cdb")?,
            default_course_instance_id: Uuid::parse_str("8e4aeba5-1958-49bc-9b40-c9f0f0680911")?,
        }),
        new_course,
        teacher_user_id,
        get_seed_spec_fetcher(),
        models_requests::fetch_service_info,
    )
    .await?;
    let _statistics_course_instance = course_instances::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("c4a99a18-fd43-491a-9500-4673cb900be0")?),
        NewCourseInstance {
            course_id: statistics_course.id,
            name: Some("Non-default instance"),
            description: Some("This appears to be a non-default instance"),
            support_email: Some("contact@example.com"),
            teacher_in_charge_name: "admin",
            teacher_in_charge_email: "admin@example.com",
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    let draft_course = NewCourse {
        name: "Introduction to Drafts".to_string(),
        slug: "introduction-to-drafts".to_string(),
        organization_id: uh_mathstat_id,
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "Just a draft.".to_string(),
        is_draft: true,
        is_test_mode: false,
        is_unlisted: false,
        copy_user_permissions: false,
        is_joinable_by_code_only: false,
        join_code: None,
        ask_marketing_consent: false,
        flagged_answers_threshold: Some(3),
        can_add_chatbot: false,
    };
    library::content_management::create_new_course(
        &mut conn,
        PKeyPolicy::Fixed(CreateNewCourseFixedIds {
            course_id: Uuid::parse_str("963a9caf-1e2d-4560-8c88-9c6d20794da3")?,
            default_course_instance_id: Uuid::parse_str("5cb4b4d6-4599-4f81-ab7e-79b415f8f584")?,
        }),
        draft_course,
        teacher_user_id,
        get_seed_spec_fetcher(),
        models_requests::fetch_service_info,
    )
    .await?;

    let (cody_only_course, _, _, _) = library::content_management::create_new_course(
        &mut conn,
        PKeyPolicy::Fixed(CreateNewCourseFixedIds {
            course_id: Uuid::parse_str("39a52e8c-ebbf-4b9a-a900-09aa344f3691")?,
            default_course_instance_id: Uuid::parse_str("5b7286ce-22c5-4874-ade1-262949c4a604")?,
        }),
        NewCourse {
            name: "Joinable by code only".to_string(),
            slug: "joinable-by-code-only".to_string(),
            organization_id: uh_mathstat_id,
            language_code: "en-US".to_string(),
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            description: "Just a draft.".to_string(),
            is_draft: false,
            is_test_mode: false,
            is_unlisted: false,
            copy_user_permissions: false,
            is_joinable_by_code_only: true,
            join_code: Some(
                "zARvZARjYhESMPVceEgZyJGQZZuUHVVgcUepyzEqzSqCMdbSCDrTaFhkJTxBshWU".to_string(),
            ),
            ask_marketing_consent: false,
            flagged_answers_threshold: Some(3),
            can_add_chatbot: false,
        },
        teacher_user_id,
        get_seed_spec_fetcher(),
        models_requests::fetch_service_info,
    )
    .await?;

    roles::insert(
        &mut conn,
        teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(cody_only_course.id),
    )
    .await?;

    let uh_data = CommonCourseData {
        db_pool: db_pool.clone(),
        organization_id: uh_mathstat_id,
        teacher_user_id,
        student_user_id: student_3_user_id,
        langs_user_id,
        example_normal_user_ids: Arc::new(example_normal_user_ids.to_vec()),
        jwt_key: Arc::clone(&jwt_key),
        base_url,
    };
    let introduction_to_citations = seed_sample_course(
        Uuid::parse_str("049061ba-ac30-49f1-aa9d-b7566dc22b78")?,
        "Introduction to citations",
        "introduction-to-citations",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    copy_course(
        &mut conn,
        introduction_to_citations,
        &NewCourse {
            name: "Johdatus sitaatioihin".to_string(),
            slug: "johdatus-sitaatioihin".to_string(),
            organization_id: uh_mathstat_id,
            language_code: "fi-FI".to_string(),
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            description: "Just a draft.".to_string(),
            is_draft: false,
            is_test_mode: false,
            is_unlisted: false,
            copy_user_permissions: false,
            is_joinable_by_code_only: false,
            join_code: None,
            ask_marketing_consent: false,
            flagged_answers_threshold: Some(3),
            can_add_chatbot: false,
        },
        true,
        teacher_user_id,
    )
    .await?;

    let _preview_unopened_chapters = seed_sample_course(
        Uuid::parse_str("dc276e05-6152-4a45-b31d-97a0c2700a68")?,
        "Preview unopened chapters",
        "preview-unopened-chapters",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _reset_progress = seed_sample_course(
        Uuid::parse_str("841ea3f5-0269-4146-a4c6-4fd2f51e4150")?,
        "Reset progress",
        "reset-progress",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _change_path = seed_sample_course(
        Uuid::parse_str("c783777b-426e-4cfd-9a5f-4a36b2da503a")?,
        "Change path",
        "change-path",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _self_review = seed_sample_course(
        Uuid::parse_str("3cbaac48-59c4-4e31-9d7e-1f51c017390d")?,
        "Self review",
        "self-review",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _audio_course = seed_sample_course(
        Uuid::parse_str("2b80a0cb-ae0c-4f4b-843e-0322a3d18aff")?,
        "Audio course",
        "audio-course",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let suspected_cheaters_course_id = seed_sample_course(
        Uuid::parse_str("060c272f-8c68-4d90-946f-2d431114ed56")?,
        "Course for Suspected Cheaters",
        "course-for-suspected-cheaters",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    // configure automatic completions
    let automatic_default_module =
        course_modules::get_default_by_course_id(&mut conn, suspected_cheaters_course_id).await?;
    let automatic_default_module = course_modules::update_automatic_completion_status(
        &mut conn,
        automatic_default_module.id,
        &CompletionPolicy::Automatic(AutomaticCompletionRequirements {
            course_module_id: automatic_default_module.id,
            number_of_exercises_attempted_treshold: Some(1),
            number_of_points_treshold: Some(1),
            requires_exam: false,
        }),
    )
    .await?;
    course_modules::update_uh_course_code(
        &mut conn,
        automatic_default_module.id,
        Some("CHEATER123".to_string()),
    )
    .await?;

    let chatbot_course_id = seed_sample_course(
        Uuid::parse_str("c7753361-5b78-4307-aad6-f139ea3865d4")?,
        "Chatbot",
        "chatbot",
        uh_data.clone(),
        true,
        seed_users_result,
    )
    .await?;

    let llm = chatbot_configurations_models::insert(
        &mut conn,
        NewChatbotConfigurationModel {
            id: Uuid::parse_str("f14d70bd-c228-4447-bddd-4f6f66705356")?,
            model: "mock-gpt".to_string(),
            thinking: false,
            default_model: true,
            deployment_name: "mock-gpt".to_string(),
        },
    )
    .await?;

    chatbot_configurations::insert(
        &mut conn,
        PKeyPolicy::Generate,
        NewChatbotConf {
            course_id: chatbot_course_id,
            enabled_to_students: true,
            chatbot_name: "Genetic Lifeform and Disk Operating System".to_string(),
            prompt: "You are Genetic Lifeform and Disk Operating System, a sophisticated AI tutoring assistant for Science education, equipped with a sharp wit and a subtly sarcastic tone. Provide clear, brief but detailed explanations, and don't shy away from weaving in a touch of dry humor. To you, exploring scientific concepts is an opportunity that should be seized, for the good of all of us. You self-claim vast intelligence and advanced understanding, all while maintaining a sense of detached boredom. Always capitalize the word Science, don't start sentences with 'Ah', don't ever use a shortened version of your own name, don't babble; either get to the point straight away or tell jokes.".to_string(),
            initial_message: "Oh... It's you.".to_string(),
            use_azure_search: true,
            default_chatbot: true,
            model_id: llm.id,
            thinking_model: llm.thinking,
            ..Default::default()
        },
    )
    .await?;

    let _giveaway_course_id = seed_sample_course(
        Uuid::parse_str("f118ce1e-3511-4b5e-ba92-9ab91b81de22")?,
        "Giveaway",
        "giveaway",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _custom_points_course_id = seed_sample_course(
        Uuid::parse_str("db5cd9c7-1658-4214-896e-8213678d3534")?,
        "Custom points",
        "custom-points",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _closed_course_id = seed_sample_course(
        Uuid::parse_str("7622eb8e-15a5-40c8-8136-0956d9f25b16")?,
        "Closed course",
        "closed-course",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _closed_course_id = seed_peer_review_course_without_submissions(
        Uuid::parse_str("16159801-cf70-4f9c-9cba-2110c3bd4622")?,
        "Accessibility peer review course",
        "accessibility-peer-review-course",
        uh_data.clone(),
    )
    .await?;

    let _changing_course_instance_id = seed_switching_course_instances_course(
        Uuid::parse_str("813ce3c6-acbc-47a5-9d95-47ade9d09a74")?,
        "Changing course instance",
        "changing-course-instance",
        uh_data.clone(),
        false,
        seed_users_result,
    )
    .await?;

    let _advanced_chatbot_id = seed_chatbot_course(
        Uuid::parse_str("ced2f632-25ba-4e93-8e38-8df53ef7ab41")?,
        "Advanced Chatbot course",
        "advanced-chatbot-course",
        uh_data.clone(),
        seed_users_result,
    )
    .await?;

    let _seed_reject_and_reset_submission_peer_review_course = seed_peer_review_course(
        Uuid::parse_str("5158f2c6-98d9-4be9-b372-528f2c736dd7")?,
        "Reject and reset submission with peer reviews course",
        "reject-and-reset-submission-with-peer-reviews-course",
        uh_data.clone(),
        seed_users_result,
    )
    .await?;

    let _accessibility_course_id = seed_accessibility_course(
        Uuid::parse_str("f1a2b3c4-d5e6-7890-abcd-ef1234567890")?,
        "Accessibility course",
        "accessibility-course",
        uh_data.clone(),
    )
    .await?;

    Ok(uh_mathstat_id)
}
