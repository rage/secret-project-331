use headless_lms_models::{PKeyPolicy, user_details, users};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[derive(Clone, Copy)]
pub struct SeedUsersResult {
    pub admin_user_id: Uuid,
    pub teacher_user_id: Uuid,
    pub language_teacher_user_id: Uuid,
    pub assistant_user_id: Uuid,
    pub course_or_exam_creator_user_id: Uuid,
    pub example_normal_user_ids: [Uuid; 4],
    pub teaching_and_learning_services_user_id: Uuid,
    pub student_without_research_consent: Uuid,
    pub student_without_country: Uuid,
    pub material_viewer_user_id: Uuid,
    pub user_user_id: Uuid,
    pub student_1_user_id: Uuid,
    pub student_2_user_id: Uuid,
    pub student_3_user_id: Uuid,
    pub student_4_user_id: Uuid,
    pub student_5_user_id: Uuid,
    pub student_6_user_id: Uuid,
    pub langs_user_id: Uuid,
    pub sign_up_user: Uuid,
}

pub async fn seed_users(db_pool: Pool<Postgres>) -> anyhow::Result<SeedUsersResult> {
    info!("inserting users");
    let mut conn = db_pool.acquire().await?;

    let admin_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("02c79854-da22-4cfc-95c4-13038af25d2e")?),
        "admin@example.com",
        Some("Admin"),
        Some("Example"),
    )
    .await?;
    user_details::update_user_country(&mut conn, admin_user_id, "fi").await?;
    let teacher_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("90643204-7656-4570-bdd9-aad5d297f9ce")?),
        "teacher@example.com",
        Some("Teacher"),
        Some("Example"),
    )
    .await?;
    user_details::update_user_country(&mut conn, teacher_user_id, "fi").await?;

    let language_teacher_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("0fd8bd2d-cb4e-4035-b7db-89e798fe4df0")?),
        "language.teacher@example.com",
        Some("Language"),
        Some("Example"),
    )
    .await?;
    user_details::update_user_country(&mut conn, language_teacher_user_id, "fi").await?;

    let material_viewer_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("ee0753ae-9f4b-465a-b04b-66edf91b41a5")?),
        "material.viewer@example.com",
        Some("Material"),
        Some("Viewer"),
    )
    .await?;
    user_details::update_user_country(&mut conn, material_viewer_user_id, "fi").await?;

    let assistant_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("24342539-f1ba-453e-ae13-14aa418db921")?),
        "assistant@example.com",
        Some("Assistant"),
        Some("Example"),
    )
    .await?;
    user_details::update_user_country(&mut conn, assistant_user_id, "fi").await?;

    let course_or_exam_creator_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("c9f9f9f9-f9f9-f9f9-f9f9-f9f9f9f9f9f9")?),
        "creator@example.com",
        Some("Creator"),
        Some("Example"),
    )
    .await?;
    user_details::update_user_country(&mut conn, course_or_exam_creator_user_id, "fi").await?;

    let user_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("849b8d32-d5f8-4994-9d21-5aa6259585b1")?),
        "user@example.com",
        Some("User"),
        Some("Example"),
    )
    .await?;
    user_details::update_user_country(&mut conn, user_user_id, "fi").await?;

    let student_1_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("02364d40-2aac-4763-8a06-2381fd298d79")?),
        "student1@example.com",
        Some("User"),
        Some("1"),
    )
    .await?;
    user_details::update_user_country(&mut conn, student_1_user_id, "fi").await?;

    let student_2_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("d7d6246c-45a8-4ff4-bf4d-31dedfaac159")?),
        "student2@example.com",
        Some("User"),
        Some("2"),
    )
    .await?;
    user_details::update_user_country(&mut conn, student_2_user_id, "fi").await?;

    let student_3_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("6b9b61f2-012a-4dc2-9e35-5da81cd3936b")?),
        "student3@example.com",
        Some("User"),
        Some("3"),
    )
    .await?;
    user_details::update_user_country(&mut conn, student_3_user_id, "fi").await?;

    let student_4_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("bc403a82-1e8b-4274-acc8-d765648ef698")?),
        "student4@example.com",
        Some("User"),
        Some("4"),
    )
    .await?;
    user_details::update_user_country(&mut conn, student_4_user_id, "fi").await?;

    let student_5_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("7ba4beb1-abe8-4bad-8bb2-d012c55b310c")?),
        "student5@example.com",
        Some("User"),
        Some("5"),
    )
    .await?;
    user_details::update_user_country(&mut conn, student_5_user_id, "fi").await?;

    let student_6_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("4ba4beb1-abe8-4bad-8bb2-d012c55b310d")?),
        "student6@example.com",
        Some("User"),
        Some("6"),
    )
    .await?;
    user_details::update_user_country(&mut conn, student_6_user_id, "fi").await?;

    let teaching_and_learning_services_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("5d081ccb-1dab-4367-9549-267fd3f1dd9c")?),
        "teaching-and-learning-services@example.com",
        Some("Teaching"),
        Some("And Learning"),
    )
    .await?;
    user_details::update_user_country(&mut conn, teaching_and_learning_services_user_id, "fi")
        .await?;

    let langs_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("c60ca874-bab9-452a-895f-02597cf60886")?),
        "langs@example.com",
        Some("langs"),
        Some("Langs"),
    )
    .await?;
    user_details::update_user_country(&mut conn, langs_user_id, "fi").await?;

    let student_without_research_consent = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("d08d2bd9-8c9b-4d46-84c4-d02f37c2b4c0")?),
        "student-without-research-consent@example.com",
        Some("User"),
        Some("User4"),
    )
    .await?;
    user_details::update_user_country(&mut conn, student_without_research_consent, "fi").await?;

    let student_without_country = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("88036435-9779-4b81-8d85-66767f529639")?),
        "student-without-country@example.com",
        Some("User"),
        Some("User"),
    )
    .await?;

    let sign_up_user = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("fb3e9b9d-8870-47a5-b4a3-7087ff8e8355")?),
        "sign-up-user@example.com",
        Some("NewUser"),
        Some("Signup"),
    )
    .await?;

    let example_normal_user_ids: [Uuid; 4] = [
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("00e249d8-345f-4eff-aedb-7bdc4c44c1d5")?),
            "user_1@example.com",
            Some("User1"),
            Some("User1"),
        )
        .await?,
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("8d7d6c8c-4c31-48ae-8e20-c68fa95c25cc")?),
            "user_2@example.com",
            Some("User2"),
            Some("User2"),
        )
        .await?,
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("fbeb9286-3dd8-4896-a6b8-3faffa3fabd6")?),
            "user_3@example.com",
            Some("User3"),
            Some("User3"),
        )
        .await?,
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("3524d694-7fa8-4e73-aa1a-de9a20fd514b")?),
            "user_4@example.com",
            Some("User4"),
            Some("User4"),
        )
        .await?,
    ];
    for user_id in example_normal_user_ids {
        user_details::update_user_country(&mut conn, user_id, "fi").await?;
    }

    Ok(SeedUsersResult {
        admin_user_id,
        teacher_user_id,
        language_teacher_user_id,
        assistant_user_id,
        course_or_exam_creator_user_id,
        example_normal_user_ids,
        teaching_and_learning_services_user_id,
        student_without_research_consent,
        student_without_country,
        sign_up_user,
        material_viewer_user_id,
        user_user_id,
        student_1_user_id,
        student_2_user_id,
        student_3_user_id,
        student_4_user_id,
        student_5_user_id,
        student_6_user_id,
        langs_user_id,
    })
}
