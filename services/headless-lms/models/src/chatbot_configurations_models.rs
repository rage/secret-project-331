use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "model_type", rename_all = "kebab-case")]
pub enum ModelType {
    GPTThinking,
    GPTNonThinking,
    GPTHardThinking,
    Mistral,
}

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct ChatbotConfigurationModel {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub model: String,
    pub model_type: ModelType,
    pub default_model: bool,
    pub context_size: i32,
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct NewChatbotConfigurationModel {
    pub id: Uuid,
    pub model: String,
    pub model_type: ModelType,
    pub default_model: bool,
    pub context_size: i32,
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ChatbotConfigurationModel> {
    let res = sqlx::query_as!(
        ChatbotConfigurationModel,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    model,
    model_type as "model_type: ModelType",
    default_model,
    context_size
FROM chatbot_configurations_models
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
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    model,
    model_type as "model_type: ModelType",
    default_model,
    context_size
FROM chatbot_configurations_models
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
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    model,
    model_type as "model_type: ModelType",
    default_model,
    context_size
FROM chatbot_configurations_models
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
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  model,
  model_type AS "model_type: ModelType",
  default_model,
  context_size
FROM chatbot_configurations_models
WHERE id = (
    SELECT model_id
    FROM chatbot_configurations
    WHERE id = $1
      AND deleted_at IS NULL
  )
  AND deleted_at IS NULL
        "#,
        chatbotconf_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert(
    conn: &mut PgConnection,
    input: NewChatbotConfigurationModel,
) -> ModelResult<ChatbotConfigurationModel> {
    let res = sqlx::query_as!(
        ChatbotConfigurationModel,
        r#"
INSERT INTO chatbot_configurations_models (id, model, model_type, default_model, context_size) VALUES ($1, $2, $3, $4, $5) RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    model,
    model_type as "model_type: ModelType",
    default_model,
    context_size
        "#,
        input.id,
        input.model,
        input.model_type as ModelType,
        input.default_model,
        input.context_size,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
