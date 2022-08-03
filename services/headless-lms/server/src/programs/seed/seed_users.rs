use headless_lms_models::users;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[derive(Clone)]
pub struct SeedUsersResult {
    pub admin_user_id: Uuid,
    pub teacher_user_id: Uuid,
    pub language_teacher_user_id: Uuid,
    pub assistant_user_id: Uuid,
    pub course_or_exam_creator_user_id: Uuid,
    pub student_user_id: Uuid,
    pub example_normal_user_ids: Vec<Uuid>,
}

pub async fn seed_users(db_pool: Pool<Postgres>) -> anyhow::Result<SeedUsersResult> {
    info!("inserting users");
    let mut conn = db_pool.acquire().await?;

    let admin_user_id = users::insert_with_id(
        &mut conn,
        "admin@example.com",
        Some("Admin"),
        Some("Example"),
        Uuid::parse_str("02c79854-da22-4cfc-95c4-13038af25d2e")?,
    )
    .await?;
    let teacher_user_id = users::insert_with_id(
        &mut conn,
        "teacher@example.com",
        Some("Teacher"),
        Some("Example"),
        Uuid::parse_str("90643204-7656-4570-bdd9-aad5d297f9ce")?,
    )
    .await?;
    let language_teacher_user_id = users::insert_with_id(
        &mut conn,
        "language.teacher@example.com",
        Some("Language"),
        Some("Example"),
        Uuid::parse_str("0fd8bd2d-cb4e-4035-b7db-89e798fe4df0")?,
    )
    .await?;
    let assistant_user_id = users::insert_with_id(
        &mut conn,
        "assistant@example.com",
        Some("Assistant"),
        Some("Example"),
        Uuid::parse_str("24342539-f1ba-453e-ae13-14aa418db921")?,
    )
    .await?;
    let course_or_exam_creator_user_id = users::insert_with_id(
        &mut conn,
        "creator@example.com",
        Some("Creator"),
        Some("Example"),
        Uuid::parse_str("c9f9f9f9-f9f9-f9f9-f9f9-f9f9f9f9f9f9")?,
    )
    .await?;
    let student_user_id = users::insert_with_id(
        &mut conn,
        "user@example.com",
        Some("User"),
        Some("Example"),
        Uuid::parse_str("849b8d32-d5f8-4994-9d21-5aa6259585b1")?,
    )
    .await?;

    let example_normal_user_ids = vec![
        users::insert_with_id(
            &mut conn,
            "user_1@example.com",
            Some("User1"),
            None,
            Uuid::parse_str("00e249d8-345f-4eff-aedb-7bdc4c44c1d5")?,
        )
        .await?,
        users::insert_with_id(
            &mut conn,
            "user_2@example.com",
            Some("User2"),
            None,
            Uuid::parse_str("8d7d6c8c-4c31-48ae-8e20-c68fa95c25cc")?,
        )
        .await?,
        users::insert_with_id(
            &mut conn,
            "user_3@example.com",
            Some("User3"),
            None,
            Uuid::parse_str("fbeb9286-3dd8-4896-a6b8-3faffa3fabd6")?,
        )
        .await?,
        users::insert_with_id(
            &mut conn,
            "user_4@example.com",
            Some("User4"),
            None,
            Uuid::parse_str("3524d694-7fa8-4e73-aa1a-de9a20fd514b")?,
        )
        .await?,
    ];
    Ok(SeedUsersResult {
        admin_user_id,
        teacher_user_id,
        language_teacher_user_id,
        assistant_user_id,
        course_or_exam_creator_user_id,
        student_user_id,
        example_normal_user_ids,
    })
}
