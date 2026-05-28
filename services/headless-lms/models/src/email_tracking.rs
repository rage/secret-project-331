use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EmailEngagementStats {
    pub template_type: Option<String>,
    pub total_sent: i64,
    pub total_opened: i64,
    pub unique_opened: i64,
    pub total_clicked: i64,
    pub unique_clicked: i64,
    pub hard_bounces: i64,
    pub soft_bounces: i64,
}

pub async fn insert_email_open(
    conn: &mut PgConnection,
    delivery_id: Uuid,
    user_agent: Option<String>,
) -> ModelResult<()> {
    sqlx::query!(
        "INSERT INTO email_opens (email_delivery_id, user_agent) VALUES ($1, $2)",
        delivery_id,
        user_agent,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn insert_email_link_click_stubs(
    conn: &mut PgConnection,
    stubs: &[(Uuid, Uuid, String)],
) -> ModelResult<()> {
    for (id, delivery_id, destination_url) in stubs {
        sqlx::query!(
            "INSERT INTO email_link_clicks (id, email_delivery_id, destination_url) VALUES ($1, $2, $3)",
            id,
            delivery_id,
            destination_url,
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

pub async fn record_link_click(
    conn: &mut PgConnection,
    click_id: Uuid,
) -> ModelResult<Option<String>> {
    let row = sqlx::query!(
        r#"
UPDATE email_link_clicks
SET first_clicked_at = COALESCE(first_clicked_at, NOW()),
    click_count = click_count + 1
WHERE id = $1
RETURNING destination_url
        "#,
        click_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(row.map(|r| r.destination_url))
}

pub async fn get_per_template_engagement_stats(
    conn: &mut PgConnection,
) -> ModelResult<Vec<EmailEngagementStats>> {
    let rows = sqlx::query!(
        r#"
SELECT
    et.email_template_type::TEXT AS template_type,
    COUNT(DISTINCT ed.id) AS "total_sent!: i64",
    COUNT(eo.id) AS "total_opened!: i64",
    COUNT(DISTINCT eo.email_delivery_id) AS "unique_opened!: i64",
    SUM(elc.click_count) AS "total_clicked!: i64",
    COUNT(DISTINCT CASE WHEN elc.first_clicked_at IS NOT NULL THEN elc.email_delivery_id END) AS "unique_clicked!: i64",
    COUNT(DISTINCT CASE WHEN ede.smtp_response_code >= 500 THEN ede.email_delivery_id END) AS "hard_bounces!: i64",
    COUNT(DISTINCT CASE WHEN ede.smtp_response_code >= 400 AND ede.smtp_response_code < 500 THEN ede.email_delivery_id END) AS "soft_bounces!: i64"
FROM email_deliveries ed
JOIN email_templates et ON et.id = ed.email_template_id
LEFT JOIN email_opens eo ON eo.email_delivery_id = ed.id
LEFT JOIN email_link_clicks elc ON elc.email_delivery_id = ed.id
LEFT JOIN email_delivery_errors ede ON ede.email_delivery_id = ed.id
WHERE ed.deleted_at IS NULL
  AND ed.sent = TRUE
GROUP BY et.email_template_type
ORDER BY et.email_template_type
        "#,
    )
    .fetch_all(conn)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| EmailEngagementStats {
            template_type: r.template_type,
            total_sent: r.total_sent,
            total_opened: r.total_opened,
            unique_opened: r.unique_opened,
            total_clicked: r.total_clicked,
            unique_clicked: r.unique_clicked,
            hard_bounces: r.hard_bounces,
            soft_bounces: r.soft_bounces,
        })
        .collect())
}
