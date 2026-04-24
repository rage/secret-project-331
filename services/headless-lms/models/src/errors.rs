use crate::prelude::*;
use headless_lms_utils::error_identifier::{
    calculate_error_grouping_identifier, calculate_exact_error_identifier, normalize_message,
    normalize_stack_trace,
};
use rand::RngExt;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, Type, ToSchema)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "error_source", rename_all = "snake_case")]
pub enum ErrorSource {
    Backend,
    Frontend,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ErrorVariant {
    pub id: Uuid,
    pub service: String,
    pub exact_error_identifier: String,
    pub error_grouping_identifier: String,
    pub error_source: ErrorSource,
    pub example_message: String,
    pub example_stack_trace: Option<String>,
    pub normalized_message: String,
    pub normalized_stack_trace: Option<String>,
    pub occurrence_count: i32,
    pub last_seen_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct NewErrorReport {
    pub service: String,
    pub error_source: Option<ErrorSource>,
    pub message: String,
    pub stack_trace: Option<String>,
    pub path: Option<String>,
    pub app_version: Option<String>,
    pub details: Option<serde_json::Value>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    report: &NewErrorReport,
) -> ModelResult<Uuid> {
    let service = report.service.trim();
    if service.is_empty() {
        return Err(model_err!(
            InvalidRequest,
            "service must not be empty".to_string()
        ));
    }

    let error_source = report.error_source.unwrap_or(ErrorSource::Frontend);
    let error_source_str = serde_json::to_value(error_source)?
        .as_str()
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::Conversion,
                "Failed to serialize ErrorSource as a string".to_string(),
                None,
            )
        })?
        .to_string();

    let normalized_message = normalize_message(&report.message);
    let normalized_stack_trace = report.stack_trace.as_deref().map(normalize_stack_trace);

    let exact_error_identifier = calculate_exact_error_identifier(
        service,
        &error_source_str,
        &report.message,
        report.stack_trace.as_deref(),
    );
    let error_grouping_identifier =
        calculate_error_grouping_identifier(service, &error_source_str, &report.message);

    let mut tx = conn.begin().await?;
    let variant_id = sqlx::query!(
        r#"
INSERT INTO error_variants (
    id,
    service,
    exact_error_identifier,
    error_grouping_identifier,
    error_source,
    example_message,
    example_stack_trace,
    normalized_message,
    normalized_stack_trace
)
VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (service, exact_error_identifier, deleted_at) DO UPDATE SET
    deleted_at = NULL,
    resolved_at = NULL,
    occurrence_count = error_variants.occurrence_count + 1,
    last_seen_at = now(),
    updated_at = now()
RETURNING id
        "#,
        service,
        exact_error_identifier,
        error_grouping_identifier,
        error_source as ErrorSource,
        report.message,
        report.stack_trace,
        normalized_message,
        normalized_stack_trace
    )
    .fetch_one(&mut *tx)
    .await?
    .id;

    sqlx::query!(
        "
INSERT INTO error_occurrences (id, error_variant_id, service, user_id, path, app_version, details)
VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
        ",
        variant_id,
        service,
        user_id,
        report.path,
        report.app_version,
        report.details
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(variant_id)
}

pub async fn get_all_variants(
    conn: &mut PgConnection,
    pagination: Pagination,
) -> ModelResult<Vec<ErrorVariant>> {
    let res = sqlx::query!(
        r#"
SELECT
    id,
    service,
    exact_error_identifier,
    error_grouping_identifier,
    error_source AS "error_source: ErrorSource",
    example_message,
    example_stack_trace,
    normalized_message,
    normalized_stack_trace,
    occurrence_count,
    last_seen_at,
    resolved_at,
    created_at,
    updated_at,
    deleted_at
FROM error_variants
WHERE deleted_at IS NULL
ORDER BY last_seen_at DESC
LIMIT $1 OFFSET $2
        "#,
        pagination.limit(),
        pagination.offset()
    )
    .map(|r| ErrorVariant {
        id: r.id,
        service: r.service,
        exact_error_identifier: r.exact_error_identifier,
        error_grouping_identifier: r.error_grouping_identifier,
        error_source: r.error_source,
        example_message: r.example_message,
        example_stack_trace: r.example_stack_trace,
        normalized_message: r.normalized_message,
        normalized_stack_trace: r.normalized_stack_trace,
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
    use std::collections::HashSet;

    let mut tx = conn.begin().await?;
    let deleted_variant_ids = sqlx::query!(
        r#"
DELETE FROM error_occurrences
WHERE created_at < now() - interval '2 months'
RETURNING error_variant_id
        "#
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|r| r.error_variant_id)
    .collect::<HashSet<_>>()
    .into_iter()
    .collect::<Vec<_>>();

    // Benign race: a concurrent insert between DELETE and this UPDATE can briefly skew aggregates.
    sqlx::query!(
        r#"
UPDATE error_variants v
SET
    occurrence_count = (
        SELECT COUNT(*)::int
        FROM error_occurrences
        WHERE error_variant_id = v.id
          AND deleted_at IS NULL
    ),
    last_seen_at = COALESCE(
        (
            SELECT MAX(created_at)
            FROM error_occurrences
            WHERE error_variant_id = v.id
              AND deleted_at IS NULL
        ),
        v.created_at
    ),
    updated_at = now()
WHERE v.id = ANY($1)
        "#,
        &deleted_variant_ids
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn maybe_delete_expired(conn: &mut PgConnection) -> ModelResult<()> {
    if rand::rng().random_range(1..=1000) == 1 {
        info!("Cleaning up expired errors");
        delete_expired(conn).await?;
    }
    Ok(())
}
