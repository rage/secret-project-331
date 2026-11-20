use utoipa::ToSchema;

use crate::prelude::*;

/// A redirect from a page's old path, created when the page moved to a new one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct CreatedRedirect {
    pub page_id: Uuid,
    pub old_url_path: String,
    pub new_url_path: String,
}

pub async fn upsert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    destination_page_id: Uuid,
    old_url_path: &str,
    course_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO url_redirections (id, destination_page_id, old_url_path, course_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (old_url_path, course_id, deleted_at) DO UPDATE SET
    destination_page_id = $2
RETURNING *
        ",
        pkey_policy.into_uuid(),
        destination_page_id,
        old_url_path,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
