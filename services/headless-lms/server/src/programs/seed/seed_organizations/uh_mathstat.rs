use std::sync::Arc;

use headless_lms_models::{
    course_instances::{self, NewCourseInstance},
    courses::NewCourse,
    library,
    library::content_management::CreateNewCourseFixedIds,
    library::copying::copy_course,
    organizations,
    roles::{self, RoleDomain, UserRole},
    PKeyPolicy,
};
use uuid::Uuid;

use sqlx::{Pool, Postgres};

use crate::{
    domain::models_requests::{self, JwtKey},
    programs::seed::{
        seed_courses::{seed_sample_course, CommonCourseData},
        seed_file_storage::SeedFileStorageResult,
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
        admin_user_id,
        teacher_user_id,
        language_teacher_user_id: _,
        material_viewer_user_id,
        assistant_user_id: _,
        course_or_exam_creator_user_id: _,
        example_normal_user_ids,
        teaching_and_learning_services_user_id: _,
        student_without_research_consent: _,
        user_user_id: _,
        student_1_user_id: _,
        student_2_user_id: _,
        student_3_user_id,
        student_4_user_id: _,
        student_5_user_id: _,
        student_6_user_id: _,
        langs_user_id,
    } = seed_users_result;
    let _ = seed_file_storage_result;

    let mut conn = db_pool.acquire().await?;

    let uh_mathstat_id = organizations::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("269d28b2-a517-4572-9955-3ed5cecc69bd")?),
        "University of Helsinki, Department of Mathematics and Statistics",
        "uh-mathstat",
        "Organization for Mathematics and Statistics courses. This organization creates courses that do require prior experience in mathematics, such as integration and induction.",
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
        admin_user_id,
        models_requests::make_spec_fetcher(base_url.clone(), Uuid::new_v4(), Arc::clone(&jwt_key)),
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
    };
    library::content_management::create_new_course(
        &mut conn,
        PKeyPolicy::Fixed(CreateNewCourseFixedIds {
            course_id: Uuid::parse_str("963a9caf-1e2d-4560-8c88-9c6d20794da3")?,
            default_course_instance_id: Uuid::parse_str("5cb4b4d6-4599-4f81-ab7e-79b415f8f584")?,
        }),
        draft_course,
        admin_user_id,
        models_requests::make_spec_fetcher(base_url.clone(), Uuid::new_v4(), Arc::clone(&jwt_key)),
        models_requests::fetch_service_info,
    )
    .await?;

    let uh_data = CommonCourseData {
        db_pool: db_pool.clone(),
        organization_id: uh_mathstat_id,
        admin_user_id,
        student_user_id: student_3_user_id,
        langs_user_id,
        example_normal_user_ids: Arc::new(example_normal_user_ids.clone()),
        jwt_key: Arc::clone(&jwt_key),
        base_url,
    };
    let introduction_to_citations = seed_sample_course(
        Uuid::parse_str("049061ba-ac30-49f1-aa9d-b7566dc22b78")?,
        "Introduction to citations",
        "introduction-to-citations",
        uh_data.clone(),
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
        },
        true,
        admin_user_id,
    )
    .await?;

    let preview_unopened_chapters = seed_sample_course(
        Uuid::parse_str("dc276e05-6152-4a45-b31d-97a0c2700a68")?,
        "Preview unopened chapters",
        "preview-unopened-chapters",
        uh_data.clone(),
    )
    .await?;

    roles::insert(
        &mut conn,
        teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(preview_unopened_chapters),
    )
    .await?;

    let reset_progress = seed_sample_course(
        Uuid::parse_str("841ea3f5-0269-4146-a4c6-4fd2f51e4150")?,
        "Reset progress",
        "reset-progress",
        uh_data.clone(),
    )
    .await?;

    roles::insert(
        &mut conn,
        teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(reset_progress),
    )
    .await?;

    let change_path = seed_sample_course(
        Uuid::parse_str("c783777b-426e-4cfd-9a5f-4a36b2da503a")?,
        "Change path",
        "change-path",
        uh_data.clone(),
    )
    .await?;

    roles::insert(
        &mut conn,
        teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(change_path),
    )
    .await?;

    let self_review = seed_sample_course(
        Uuid::parse_str("3cbaac48-59c4-4e31-9d7e-1f51c017390d")?,
        "Self review",
        "self-review",
        uh_data.clone(),
    )
    .await?;

    roles::insert(
        &mut conn,
        teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(self_review),
    )
    .await?;

    let audio_course = seed_sample_course(
        Uuid::parse_str("2b80a0cb-ae0c-4f4b-843e-0322a3d18aff")?,
        "Audio course",
        "audio-course",
        uh_data.clone(),
    )
    .await?;

    roles::insert(
        &mut conn,
        teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(audio_course),
    )
    .await?;

    let suspected_cheaters_course = seed_sample_course(
        Uuid::parse_str("060c272f-8c68-4d90-946f-2d431114ed56")?,
        "Course for Suspected Cheaters",
        "course-for-suspected-cheaters",
        uh_data.clone(),
    )
    .await?;

    roles::insert(
        &mut conn,
        teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(suspected_cheaters_course),
    )
    .await?;

    Ok(uh_mathstat_id)
}
