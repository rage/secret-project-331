use headless_lms_models::{users, PKeyPolicy};
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

    let admin_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("02c79854-da22-4cfc-95c4-13038af25d2e")?),
        "admin@example.com",
        Some("Admin"),
        Some("Example"),
    )
    .await?;
    let teacher_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("90643204-7656-4570-bdd9-aad5d297f9ce")?),
        "teacher@example.com",
        Some("Teacher"),
        Some("Example"),
    )
    .await?;
    let language_teacher_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("0fd8bd2d-cb4e-4035-b7db-89e798fe4df0")?),
        "language.teacher@example.com",
        Some("Language"),
        Some("Example"),
    )
    .await?;
    let assistant_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("24342539-f1ba-453e-ae13-14aa418db921")?),
        "assistant@example.com",
        Some("Assistant"),
        Some("Example"),
    )
    .await?;
    let course_or_exam_creator_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("c9f9f9f9-f9f9-f9f9-f9f9-f9f9f9f9f9f9")?),
        "creator@example.com",
        Some("Creator"),
        Some("Example"),
    )
    .await?;
    let student_user_id = users::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("849b8d32-d5f8-4994-9d21-5aa6259585b1")?),
        "user@example.com",
        Some("User"),
        Some("Example"),
    )
    .await?;

    let example_normal_user_ids = vec![
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("00e249d8-345f-4eff-aedb-7bdc4c44c1d5")?),
            "user_1@example.com",
            Some("User1"),
            None,
        )
        .await?,
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("8d7d6c8c-4c31-48ae-8e20-c68fa95c25cc")?),
            "user_2@example.com",
            Some("User2"),
            None,
        )
        .await?,
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("fbeb9286-3dd8-4896-a6b8-3faffa3fabd6")?),
            "user_3@example.com",
            Some("User3"),
            None,
        )
        .await?,
        users::insert(
            &mut conn,
            PKeyPolicy::Fixed(Uuid::parse_str("3524d694-7fa8-4e73-aa1a-de9a20fd514b")?),
            "user_4@example.com",
            Some("User4"),
            None,
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
