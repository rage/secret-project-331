use crate::prelude::*;
use headless_lms_utils::error_fingerprint::compute_fingerprint;
use rand::RngExt;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "error_source", rename_all = "snake_case")]
pub enum ErrorSource {
    Backend,
    Frontend,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ErrorGroup {
    pub id: Uuid,
    pub fingerprint: String,
    pub error_source: ErrorSource,
    pub message: String,
    pub stack_trace: Option<String>,
    pub occurrence_count: i32,
    pub last_seen_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct NewErrorReport {
    pub message: String,
    pub stack_trace: Option<String>,
    pub path: Option<String>,
    pub app_version: Option<String>,
    pub details: Option<serde_json::Value>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    source: ErrorSource,
    report: &NewErrorReport,
) -> ModelResult<Uuid> {
    let fingerprint = compute_fingerprint(
        &format!("{:?}", source),
        &report.message,
        report.stack_trace.as_deref(),
    );

    let group_id = sqlx::query!(
        r#"
INSERT INTO error_groups (id, fingerprint, error_source, message, stack_trace)
VALUES (uuid_generate_v4(), $1, $2, $3, $4)
ON CONFLICT (fingerprint) DO UPDATE SET
    occurrence_count = error_groups.occurrence_count + 1,
    last_seen_at = now(),
    updated_at = now()
RETURNING id
        "#,
        fingerprint,
        source as ErrorSource,
        report.message,
        report.stack_trace
    )
    .fetch_one(&mut *conn)
    .await?
    .id;

    sqlx::query!(
        "
INSERT INTO error_occurrences (id, error_group_id, user_id, path, app_version, details)
VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5)
        ",
        group_id,
        user_id,
        report.path,
        report.app_version,
        report.details
    )
    .execute(&mut *conn)
    .await?;

    Ok(group_id)
}

pub async fn get_all_groups(
    conn: &mut PgConnection,
    pagination: Pagination,
) -> ModelResult<Vec<ErrorGroup>> {
    let res = sqlx::query!(
        r#"
SELECT
    id,
    fingerprint,
    error_source AS "error_source: ErrorSource",
    message,
    stack_trace,
    occurrence_count,
    last_seen_at,
    resolved_at,
    created_at,
    updated_at,
    deleted_at
FROM error_groups
WHERE deleted_at IS NULL
ORDER BY last_seen_at DESC
LIMIT $1 OFFSET $2
        "#,
        pagination.limit(),
        pagination.offset()
    )
    .map(|r| ErrorGroup {
        id: r.id,
        fingerprint: r.fingerprint,
        error_source: r.error_source,
        message: r.message,
        stack_trace: r.stack_trace,
        occurrence_count: r.occurrence_count,
        last_seen_at: r.last_seen_at,
        resolved_at: r.resolved_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
    })
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn delete_expired(conn: &mut PgConnection) -> ModelResult<()> {
    sqlx::query!(
        r#"
WITH deleted AS (
    DELETE FROM error_occurrences
    WHERE created_at < now() - interval '2 months'
    RETURNING error_group_id
)
UPDATE error_groups g
SET
    occurrence_count = (SELECT COUNT(*) FROM error_occurrences WHERE error_group_id = g.id),
    last_seen_at = COALESCE(
        (SELECT MAX(created_at) FROM error_occurrences WHERE error_group_id = g.id),
        g.created_at
    ),
    updated_at = now()
FROM (SELECT DISTINCT error_group_id FROM deleted) d
WHERE g.id = d.error_group_id
        "#
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn maybe_delete_expired(conn: &mut PgConnection) -> ModelResult<()> {
    if rand::rng().random_range(1..=1000) == 1 {
        info!("Cleaning up expired errors");
        delete_expired(conn).await?;
    }
    Ok(())
}
