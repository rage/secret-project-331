use crate::prelude::*;
use utoipa::ToSchema;

/// The audit record of one privileged mutation a support chatbot admin confirmed and the server
/// executed. See the table's own `COMMENT ON` for why this exists alongside per-domain logs.
#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct ChatbotActionLog {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub acting_user_id: Uuid,
    pub tool_call_id: Uuid,
    pub tool_name: String,
    #[schema(value_type = Object)]
    pub arguments: serde_json::Value,
    pub target_user_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub summary: String,
}

/// The fields a caller supplies to record an executed action; the rest are assigned by the insert.
pub struct NewChatbotActionLog {
    pub acting_user_id: Uuid,
    pub tool_call_id: Uuid,
    pub tool_name: String,
    pub arguments: serde_json::Value,
    pub target_user_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub summary: String,
}

pub async fn insert(conn: &mut PgConnection, input: NewChatbotActionLog) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO chatbot_action_logs (
    acting_user_id,
    tool_call_id,
    tool_name,
    arguments,
    target_user_id,
    course_id,
    summary
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id
        "#,
        input.acting_user_id,
        input.tool_call_id,
        input.tool_name,
        input.arguments,
        input.target_user_id,
        input.course_id,
        input.summary
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
