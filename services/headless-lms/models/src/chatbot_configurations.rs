use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConfiguration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub enabled_to_students: bool,
    pub chatbot_name: String,
    pub prompt: String,
    pub initial_message: String,
    pub weekly_tokens_per_user: i32,
    pub daily_tokens_per_user: i32,
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub response_max_tokens: i32,
    pub use_azure_search: bool,
    pub maintain_azure_search_index: bool,
    pub hide_citations: bool,
    pub use_semantic_reranking: bool,
    pub default_chatbot: bool,
}

impl Default for ChatbotConfiguration {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            course_id: Default::default(),
            enabled_to_students: false,
            chatbot_name: Default::default(),
            prompt: Default::default(),
            initial_message: Default::default(),
            weekly_tokens_per_user: Default::default(),
            daily_tokens_per_user: Default::default(),
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: Default::default(),
            presence_penalty: Default::default(),
            response_max_tokens: 500,
            use_azure_search: false,
            maintain_azure_search_index: false,
            hide_citations: false,
            use_semantic_reranking: false,
            default_chatbot: false,
        }
    }
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewChatbotConf {
    pub course_id: Uuid,
    pub enabled_to_students: bool,
    pub chatbot_name: String,
    pub prompt: String,
    pub initial_message: String,
    pub weekly_tokens_per_user: i32,
    pub daily_tokens_per_user: i32,
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub response_max_tokens: i32,
    pub use_azure_search: bool,
    pub maintain_azure_search_index: bool,
    pub hide_citations: bool,
    pub use_semantic_reranking: bool,
    pub default_chatbot: bool,
}

impl Default for NewChatbotConf {
    fn default() -> Self {
        Self {
            course_id: Default::default(),
            enabled_to_students: false,
            chatbot_name: Default::default(),
            prompt: Default::default(),
            initial_message: Default::default(),
            weekly_tokens_per_user: Default::default(),
            daily_tokens_per_user: Default::default(),
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: Default::default(),
            presence_penalty: Default::default(),
            response_max_tokens: 500,
            use_azure_search: false,
            maintain_azure_search_index: false,
            hide_citations: false,
            use_semantic_reranking: false,
            default_chatbot: false,
        }
    }
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
SELECT * FROM chatbot_configurations
WHERE id = $1
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert(
    conn: &mut PgConnection,
    input: NewChatbotConf,
) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
INSERT INTO chatbot_configurations (
    course_id,
    enabled_to_students,
    chatbot_name,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *
        "#,
        input.course_id,
        input.enabled_to_students,
        input.chatbot_name,
        input.prompt,
        input.initial_message,
        input.weekly_tokens_per_user,
        input.daily_tokens_per_user,
        input.temperature,
        input.top_p,
        input.frequency_penalty,
        input.presence_penalty,
        input.response_max_tokens
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn edit(
    conn: &mut PgConnection,
    input: NewChatbotConf,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
UPDATE chatbot_configurations AS cc
SET
    enabled_to_students = $1,
    chatbot_name = $2,
    prompt = $3,
    initial_message = $4,
    weekly_tokens_per_user = $5,
    daily_tokens_per_user = $6,
    temperature = $7,
    top_p = $8,
    frequency_penalty = $9,
    presence_penalty = $10,
    response_max_tokens = $11,
    use_azure_search = $12,
    maintain_azure_search_index = $13,
    hide_citations = $14,
    use_semantic_reranking = $15,
    default_chatbot = $16
WHERE cc.id = $17
RETURNING *"#,
        input.enabled_to_students,
        input.chatbot_name,
        input.prompt,
        input.initial_message,
        input.weekly_tokens_per_user,
        input.daily_tokens_per_user,
        input.temperature,
        input.top_p,
        input.frequency_penalty,
        input.presence_penalty,
        input.response_max_tokens,
        input.use_azure_search,
        input.maintain_azure_search_index,
        input.hide_citations,
        input.use_semantic_reranking,
        input.default_chatbot,
        chatbot_configuration_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, chatbot_configuration_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE chatbot_configurations
SET deleted_at = now()
WHERE id = $1
AND deleted_at IS NULL
        "#,
        chatbot_configuration_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ChatbotConfiguration>> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
SELECT * FROM
chatbot_configurations
WHERE course_id = $1
AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_for_azure_search_maintenance(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ChatbotConfiguration>> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
SELECT * FROM
chatbot_configurations
WHERE maintain_azure_search_index = true
AND deleted_at IS NULL
"#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn remove_default_chatbot_from_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query_as!(
        ChatbotConfiguration,
        r#"
UPDATE chatbot_configurations
SET default_chatbot = false
WHERE course_id = $1
AND default_chatbot = true
AND deleted_at IS NULL
"#,
        course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_default_chatbot_for_course(
    conn: &mut PgConnection,
    chatbot_configuration_id: Uuid,
) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
UPDATE chatbot_configurations
SET default_chatbot = true
WHERE id = $1
RETURNING *
"#,
        chatbot_configuration_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
