use std::sync::Arc;

use chrono::{Duration, TimeZone, Utc};
use futures::try_join;
use headless_lms_models::{
    course_exams,
    course_instances::{self, NewCourseInstance},
    course_modules::{self, AutomaticCompletionRequirements, CompletionPolicy},
    courses::NewCourse,
    library::{
        self,
        content_management::CreateNewCourseFixedIds,
        progressing::{TeacherManualCompletion, TeacherManualCompletionRequest},
    },
    open_university_registration_links, organizations,
    roles::{self, RoleDomain, UserRole},
    PKeyPolicy,
};
use headless_lms_utils::futures::run_parallelly;
use uuid::Uuid;

use crate::{
    domain::models_requests::{self, JwtKey},
    programs::seed::{
        seed_courses::{
            create_glossary_course, seed_cs_course_material,
            seed_peer_review_course_without_submissions, seed_sample_course, CommonCourseData,
        },
        seed_file_storage::SeedFileStorageResult,
        seed_helpers::create_exam,
    },
};

use super::super::seed_users::SeedUsersResult;
use sqlx::{Pool, Postgres};

pub struct SeedOrganizationUhCsResult {
    pub uh_cs_organization_id: Uuid,
    pub cs_intro_course_id: Uuid,
}

pub async fn seed_organization_uh_cs(
    db_pool: Pool<Postgres>,
    seed_users_result: SeedUsersResult,
    base_url: String,
    jwt_key: Arc<JwtKey>,
    // Passed to this function to ensure the seed file storage has been ran before this. This function will not work is seed file storage has not been ran
    seed_file_storage_result: SeedFileStorageResult,
) -> anyhow::Result<SeedOrganizationUhCsResult> {
    info!("inserting organization uh-cs");
    let SeedUsersResult {
        admin_user_id,
        teacher_user_id,
        language_teacher_user_id,
        material_viewer_user_id,
        assistant_user_id: _,
        course_or_exam_creator_user_id,
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

    let uh_cs_organization_id = organizations::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("8bb12295-53ac-4099-9644-ac0ff5e34d92")?),
        "University of Helsinki, Department of Computer Science",
        "uh-cs",
        "Organization for Computer Science students and the rest of the world who wish to learn the basics in Computer Science, programming and software development.",
    )
    .await?;

    roles::insert(
        &mut conn,
        material_viewer_user_id,
        UserRole::MaterialViewer,
        RoleDomain::Organization(uh_cs_organization_id),
    )
    .await?;

    info!("inserting uh-cs courses");

    // Seed courses in groups to improve performance. We cannot create a new task for each course because it is causing stack overflows in headless-lms entrypoint in seemingly unrelated code.
    let cs_data = CommonCourseData {
        db_pool: db_pool.clone(),
        organization_id: uh_cs_organization_id,
        admin_user_id,
        student_user_id: student_3_user_id,
        langs_user_id,
        example_normal_user_ids: Arc::new(example_normal_user_ids.to_vec()),
        jwt_key: Arc::clone(&jwt_key),
        base_url: base_url.clone(),
    };
    let (
        cs_intro,
        automatic_completions_id,
        introduction_to_localizing,
        manual_completions_id,
        automatic_course_with_exam_id,
        certificates_id,
        ..,
    ) = try_join!(
        // using these ids
        run_parallelly(seed_sample_course(
            Uuid::parse_str("7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5")?,
            "Introduction to everything",
            "introduction-to-everything",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("b39b64f3-7718-4556-ac2b-333f3ed4096f")?,
            "Automatic Completions",
            "automatic-completions",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("639f4d25-9376-49b5-bcca-7cba18c38565")?,
            "Introduction to localizing",
            "introduction-to-localizing",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("34f4e7b7-9f55-48a7-95d7-3fc3e89553b5")?,
            "Manual Completions",
            "manual-completions",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("260b2157-94ad-4791-91c7-f236f203c338")?,
            "Automatic Course with Exam",
            "automatic-course-with-exam",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("51ce5ea4-2587-407e-bea9-421309f77f69")?,
            "Certificates",
            "certificates",
            cs_data.clone(),
            seed_users_result,
        )),
        // not using these ids
        run_parallelly(seed_sample_course(
            Uuid::parse_str("4dde368a-5e5d-4001-b8aa-13079390f818")?,
            "Model solutions",
            "model-solutions",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("edaa1c52-15cd-458d-8ce2-1e4010641244")?,
            "Course Modules",
            "course-modules",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("d18b3780-563d-4326-b311-8d0e132901cd")?,
            "Introduction to feedback",
            "introduction-to-feedback",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("0ab2c4c5-3aad-4daa-a8fe-c26e956fde35")?,
            "Introduction to history",
            "introduction-to-history",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("cae7da38-9486-47da-9106-bff9b6a280f2")?,
            "Introduction to edit proposals",
            "introduction-to-edit-proposals",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("b4cb334c-11d6-4e93-8f3d-849c4abfcd67")?,
            "Point view for teachers",
            "point-view-for-teachers",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4")?,
            "Advanced course instance management",
            "advanced-course-instance-management",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("0cf67777-0edb-480c-bdb6-13f90c136fc3")?,
            "Advanced exercise states",
            "advanced-exercise-states",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("c218ca00-dbde-4b0c-ab98-4f075c49425a")?,
            "Glossary course",
            "glossary-course",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("a2002fc3-2c87-4aae-a5e5-9d14617aad2b")?,
            "Permission management",
            "permission-management",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("f9579c00-d0bb-402b-affd-7db330dcb11f")?,
            "Redirections",
            "redirections",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("9da60c66-9517-46e4-b351-07d0f7aa6cd4")?,
            "Limited tries",
            "limited-tries",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(seed_sample_course(
            Uuid::parse_str("86cbc198-601c-42f4-8e0f-3e6cce49bbfc")?,
            "Course Structure",
            "course-structure",
            cs_data.clone(),
            seed_users_result,
        )),
        run_parallelly(create_glossary_course(
            Uuid::parse_str("e5b89931-e3d6-4930-9692-61539748c12c")?,
            cs_data.clone(),
        )),
        run_parallelly(seed_peer_review_course_without_submissions(
            Uuid::parse_str("c47e1cfd-a2da-4fd1-aca8-f2b2d906c4c0")?,
            "Peer review Course",
            "peer-review-course",
            cs_data.clone(),
        ))
    )?;

    // configure automatic completions
    let automatic_default_module =
        course_modules::get_default_by_course_id(&mut conn, automatic_completions_id).await?;
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
        Some("EXAMPLE123".to_string()),
    )
    .await?;
    let automatic_with_exam_default_module =
        course_modules::get_default_by_course_id(&mut conn, automatic_course_with_exam_id).await?;
    let automatic_with_exam_default_module = course_modules::update_automatic_completion_status(
        &mut conn,
        automatic_with_exam_default_module.id,
        &CompletionPolicy::Automatic(AutomaticCompletionRequirements {
            course_module_id: automatic_with_exam_default_module.id,
            number_of_exercises_attempted_treshold: Some(1),
            number_of_points_treshold: Some(1),
            requires_exam: true,
        }),
    )
    .await?;
    course_modules::update_uh_course_code(
        &mut conn,
        automatic_with_exam_default_module.id,
        Some("EXAMPLE123".to_string()),
    )
    .await?;
    open_university_registration_links::upsert(&mut conn, "EXAMPLE123", "https://www.example.com")
        .await?;

    // configure manual completions
    let manual_default_module =
        course_modules::get_default_by_course_id(&mut conn, manual_completions_id).await?;
    let manual_default_instance =
        course_instances::get_default_by_course_id(&mut conn, manual_completions_id).await?;
    library::progressing::add_manual_completions(
        &mut conn,
        admin_user_id,
        &manual_default_instance,
        &TeacherManualCompletionRequest {
            course_module_id: manual_default_module.id,
            new_completions: vec![TeacherManualCompletion {
                user_id: *example_normal_user_ids.first().unwrap(),
                grade: Some(4),
                completion_date: Some(Utc.with_ymd_and_hms(2022, 9, 1, 0, 0, 0).unwrap()),
            }],
            skip_duplicate_completions: true,
        },
    )
    .await?;

    // configure certification
    let certificates_default_module =
        course_modules::get_default_by_course_id(&mut conn, certificates_id).await?;
    course_modules::update_automatic_completion_status(
        &mut conn,
        certificates_default_module.id,
        &CompletionPolicy::Automatic(AutomaticCompletionRequirements {
            course_module_id: certificates_default_module.id,
            number_of_exercises_attempted_treshold: Some(1),
            number_of_points_treshold: Some(1),
            requires_exam: false,
        }),
    )
    .await?;
    course_modules::update_certification_enabled(&mut conn, certificates_default_module.id, true)
        .await?;

    roles::insert(
        &mut conn,
        language_teacher_user_id,
        UserRole::Teacher,
        RoleDomain::Course(introduction_to_localizing),
    )
    .await?;
    roles::insert(
        &mut conn,
        course_or_exam_creator_user_id,
        UserRole::CourseOrExamCreator,
        RoleDomain::Organization(uh_cs_organization_id),
    )
    .await?;

    info!("inserting sample exams");
    create_exam(
        &mut conn,
        "Ongoing ends soon".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(1)),
        120,
        uh_cs_organization_id,
        cs_intro,
        Uuid::parse_str("7d6ed843-2a94-445b-8ced-ab3c67290ad0")?,
        teacher_user_id,
        0,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;
    create_exam(
        &mut conn,
        "Ongoing short timer".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(120)),
        1,
        uh_cs_organization_id,
        cs_intro,
        Uuid::parse_str("6959e7af-6b78-4d37-b381-eef5b7aaad6c")?,
        teacher_user_id,
        0,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;
    create_exam(
        &mut conn,
        "Ongoing plenty of time".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(120)),
        730,
        uh_cs_organization_id,
        cs_intro,
        Uuid::parse_str("8e202d37-3a26-4181-b9e4-0560b90c0ccb")?,
        teacher_user_id,
        0,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;

    create_exam(
        &mut conn,
        "Exam for manual grading".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(120)),
        1,
        uh_cs_organization_id,
        cs_intro,
        Uuid::parse_str("fee8bb0c-8629-477c-86eb-1785005143ae")?,
        teacher_user_id,
        0,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;
    create_exam(
        &mut conn,
        "Starting soon".to_string(),
        Some(Utc::now() + Duration::minutes(5)),
        Some(Utc::now() + Duration::days(30)),
        1,
        uh_cs_organization_id,
        cs_intro,
        Uuid::parse_str("65f5c3f3-b5fd-478d-8858-a45cdcb16b86")?,
        teacher_user_id,
        0,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;
    create_exam(
        &mut conn,
        "Over".to_string(),
        Some(Utc::now() - Duration::days(7)),
        Some(Utc::now() - Duration::minutes(30)),
        1,
        uh_cs_organization_id,
        cs_intro,
        Uuid::parse_str("5c4fca1f-f0d6-471f-a0fd-eac552f5fb84")?,
        teacher_user_id,
        0,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;
    let automatic_course_exam = create_exam(
        &mut conn,
        "Automatic course exam".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(120)),
        1,
        uh_cs_organization_id,
        cs_intro,
        Uuid::parse_str("b2168b2f-f721-4771-a35d-ca75ca0937b1")?,
        teacher_user_id,
        0,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;
    course_exams::upsert(
        &mut conn,
        automatic_course_exam,
        automatic_course_with_exam_id,
    )
    .await?;

    info!("cs");
    let _cs_design = seed_cs_course_material(
        &db_pool,
        uh_cs_organization_id,
        admin_user_id,
        langs_user_id,
        base_url.clone(),
        Arc::clone(&jwt_key),
    )
    .await?;
    let new_course = NewCourse {
        name: "Introduction to Computer Science".to_string(),
        slug: "introduction-to-computer-science".to_string(),
        organization_id: uh_cs_organization_id,
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "An example course.".to_string(),
        is_draft: false,
        is_test_mode: false,
        is_unlisted: false,
        copy_user_permissions: false,
    };
    let (cs_course, _cs_front_page, _cs_default_course_instance, _cs_default_course_module) =
        library::content_management::create_new_course(
            &mut conn,
            PKeyPolicy::Fixed(CreateNewCourseFixedIds {
                course_id: Uuid::parse_str("06a7ccbd-8958-4834-918f-ad7b24e583fd")?,
                default_course_instance_id: Uuid::parse_str(
                    "48399008-6523-43c5-8fd6-59ecc731a426",
                )?,
            }),
            new_course,
            admin_user_id,
            models_requests::make_spec_fetcher(
                base_url.clone(),
                Uuid::new_v4(),
                Arc::clone(&jwt_key),
            ),
            models_requests::fetch_service_info,
        )
        .await?;
    let _cs_course_instance = course_instances::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("49c618d3-926d-4287-9159-b3af1f86082d")?),
        NewCourseInstance {
            course_id: cs_course.id,
            name: Some("Non-default instance"),
            description: Some("This is another non-default instance"),
            support_email: Some("contact@example.com"),
            teacher_in_charge_name: "admin",
            teacher_in_charge_email: "admin@example.com",
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;
    Ok(SeedOrganizationUhCsResult {
        uh_cs_organization_id,
        cs_intro_course_id: cs_intro,
    })
}
