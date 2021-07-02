use anyhow::Result;
use sqlx::PgConnection;
use uuid::Uuid;

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    course_instance_id: Uuid,
    current: bool,
) -> Result<()> {
    sqlx::query!(
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id, current)
VALUES ($1, $2, $3, $4)
",
        user_id,
        course_id,
        course_instance_id,
        current
    )
    .execute(conn)
    .await?;
    Ok(())
}
