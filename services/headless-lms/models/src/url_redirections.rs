use crate::prelude::*;

pub async fn insert(
  conn: &mut PgConnection,
  destination_page_id: Uuid,
  old_url_path: &str,
  course_id: Uuid,
) -> ModelResult<Uuid> {
  let res = sqlx::query!(
      "
INSERT INTO url_redirections (destination_page_id, old_url_path, course_id)
SELECT $1, $2, $3
RETURNING id
",
destination_page_id,
old_url_path,
course_id
  )
  .fetch_one(conn)
  .await?;
  Ok(res.id)
}
