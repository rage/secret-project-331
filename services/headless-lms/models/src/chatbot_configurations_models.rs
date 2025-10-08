use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConfigurationModel {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub model: String,
    pub deployment_name: String,
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ChatbotConfigurationModel> {
    let res = sqlx::query_as!(
        ChatbotConfigurationModel,
        r#"
SELECT * FROM chatbot_configurations_models
WHERE id = $1
AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<ChatbotConfigurationModel>> {
    let res = sqlx::query_as!(
        ChatbotConfigurationModel,
        r#"
SELECT * FROM chatbot_configurations_models
WHERE deleted_at IS NULL
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
