use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConfigurationModel {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub model: String,
    pub default_model: bool,
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

pub async fn get_default(conn: &mut PgConnection) -> ModelResult<ChatbotConfigurationModel> {
    let res = sqlx::query_as!(
        ChatbotConfigurationModel,
        r#"
SELECT * FROM chatbot_configurations_models
WHERE default_model = true
AND deleted_at IS NULL
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_chatbot_configuration_id(
    conn: &mut PgConnection,
    chatbotconf_id: Uuid,
) -> ModelResult<ChatbotConfigurationModel> {
    let res = sqlx::query_as!(
        ChatbotConfigurationModel,
        r#"
SELECT * FROM chatbot_configurations_models
WHERE id = (
    SELECT model FROM chatbot_configurations WHERE id = $1
)
AND deleted_at IS NULL
        "#,
        chatbotconf_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
