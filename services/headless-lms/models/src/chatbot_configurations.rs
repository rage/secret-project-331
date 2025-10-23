use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "reasoning_effort_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ReasoningEffortLevel {
    Minimal,
    Low,
    Medium,
    High,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "verbosity_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VerbosityLevel {
    Low,
    Medium,
    High,
}

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
    pub model: Option<Uuid>,
    pub thinking_model: Option<bool>,
    pub prompt: String,
    pub initial_message: String,
    pub weekly_tokens_per_user: i32,
    pub daily_tokens_per_user: i32,
    pub response_max_tokens: i32,
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub max_completion_tokens: i32,
    pub verbosity: VerbosityLevel,
    pub reasoning_effort: ReasoningEffortLevel,
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
            model: Some(Uuid::nil()),
            thinking_model: Some(false),
            prompt: Default::default(),
            initial_message: Default::default(),
            weekly_tokens_per_user: 20000 * 5,
            daily_tokens_per_user: 20000,
            response_max_tokens: 500,
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            max_completion_tokens: 600,
            reasoning_effort: ReasoningEffortLevel::Minimal,
            verbosity: VerbosityLevel::Medium,
            use_azure_search: false,
            maintain_azure_search_index: false,
            hide_citations: false,
            use_semantic_reranking: false,
            default_chatbot: false,
        }
    }
}

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewChatbotConf {
    pub course_id: Uuid,
    pub enabled_to_students: bool,
    pub chatbot_name: String,
    pub model: Option<Uuid>,
    pub thinking_model: Option<bool>,
    pub prompt: String,
    pub initial_message: String,
    pub weekly_tokens_per_user: i32,
    pub daily_tokens_per_user: i32,
    pub response_max_tokens: i32,
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub max_completion_tokens: i32,
    pub verbosity: VerbosityLevel,
    pub reasoning_effort: ReasoningEffortLevel,
    pub use_azure_search: bool,
    pub maintain_azure_search_index: bool,
    pub hide_citations: bool,
    pub use_semantic_reranking: bool,
    pub default_chatbot: bool,
    pub chatbotconf_id: Option<Uuid>,
}

impl Default for NewChatbotConf {
    fn default() -> Self {
        let chatbot_conf: ChatbotConfiguration = ChatbotConfiguration::default();
        Self {
            course_id: chatbot_conf.course_id,
            enabled_to_students: chatbot_conf.enabled_to_students,
            chatbot_name: chatbot_conf.chatbot_name,
            model: chatbot_conf.model,
            thinking_model: chatbot_conf.thinking_model,
            prompt: chatbot_conf.prompt,
            initial_message: chatbot_conf.initial_message,
            weekly_tokens_per_user: chatbot_conf.weekly_tokens_per_user,
            daily_tokens_per_user: chatbot_conf.daily_tokens_per_user,
            response_max_tokens: chatbot_conf.response_max_tokens,
            temperature: chatbot_conf.temperature,
            top_p: chatbot_conf.top_p,
            frequency_penalty: chatbot_conf.frequency_penalty,
            presence_penalty: chatbot_conf.presence_penalty,
            max_completion_tokens: chatbot_conf.max_completion_tokens,
            verbosity: chatbot_conf.verbosity,
            reasoning_effort: chatbot_conf.reasoning_effort,
            use_azure_search: chatbot_conf.use_azure_search,
            maintain_azure_search_index: chatbot_conf.maintain_azure_search_index,
            hide_citations: chatbot_conf.hide_citations,
            use_semantic_reranking: chatbot_conf.use_semantic_reranking,
            default_chatbot: chatbot_conf.default_chatbot,
            chatbotconf_id: None,
        }
    }
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens,
    max_completion_tokens,
    use_azure_search,
    maintain_azure_search_index,
    hide_citations,
    use_semantic_reranking,
    default_chatbot,
    verbosity as "verbosity: VerbosityLevel",
    reasoning_effort as "reasoning_effort: ReasoningEffortLevel"
FROM chatbot_configurations
WHERE id = $1
AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    input: NewChatbotConf,
) -> ModelResult<ChatbotConfiguration> {
    let maintain_azure_search_index = input.use_azure_search;
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
INSERT INTO chatbot_configurations (
    id,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    hide_citations,
    frequency_penalty,
    presence_penalty,
    max_completion_tokens,
    verbosity,
    reasoning_effort,
    response_max_tokens,
    use_azure_search,
    maintain_azure_search_index,
    default_chatbot
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens,
    max_completion_tokens,
    use_azure_search,
    maintain_azure_search_index,
    hide_citations,
    use_semantic_reranking,
    default_chatbot,
    verbosity as "verbosity: VerbosityLevel",
    reasoning_effort as "reasoning_effort: ReasoningEffortLevel"
        "#,
        pkey_policy.into_uuid(),
        input.course_id,
        input.enabled_to_students,
        input.chatbot_name,
        input.model,
        input.thinking_model,
        input.prompt,
        input.initial_message,
        input.weekly_tokens_per_user,
        input.daily_tokens_per_user,
        input.temperature,
        input.top_p,
        input.hide_citations,
        input.frequency_penalty,
        input.presence_penalty,
        input.max_completion_tokens,
        input.verbosity as VerbosityLevel,
        input.reasoning_effort as ReasoningEffortLevel,
        input.response_max_tokens,
        input.use_azure_search,
        maintain_azure_search_index,
        input.default_chatbot
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
UPDATE chatbot_configurations
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
    default_chatbot = $16,
    model = $17,
    thinking_model = $18,
    max_completion_tokens = $19,
    verbosity = $20,
    reasoning_effort = $21
WHERE id = $22
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens,
    max_completion_tokens,
    use_azure_search,
    maintain_azure_search_index,
    hide_citations,
    use_semantic_reranking,
    default_chatbot,
    verbosity as "verbosity: VerbosityLevel",
    reasoning_effort as "reasoning_effort: ReasoningEffortLevel"
"#,
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
        input.model,
        input.thinking_model,
        input.max_completion_tokens,
        input.verbosity as VerbosityLevel,
        input.reasoning_effort as ReasoningEffortLevel,
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
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens,
    max_completion_tokens,
    use_azure_search,
    maintain_azure_search_index,
    hide_citations,
    use_semantic_reranking,
    default_chatbot,
    verbosity as "verbosity: VerbosityLevel",
    reasoning_effort as "reasoning_effort: ReasoningEffortLevel"
FROM chatbot_configurations
WHERE course_id = $1
AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_enabled_nondefault_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ChatbotConfiguration>> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens,
    max_completion_tokens,
    use_azure_search,
    maintain_azure_search_index,
    hide_citations,
    use_semantic_reranking,
    default_chatbot,
    verbosity as "verbosity: VerbosityLevel",
    reasoning_effort as "reasoning_effort: ReasoningEffortLevel"
FROM chatbot_configurations
WHERE course_id = $1
AND default_chatbot IS false
AND enabled_to_students IS true
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
SELECT
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens,
    max_completion_tokens,
    use_azure_search,
    maintain_azure_search_index,
    hide_citations,
    use_semantic_reranking,
    default_chatbot,
    verbosity as "verbosity: VerbosityLevel",
    reasoning_effort as "reasoning_effort: ReasoningEffortLevel"

FROM chatbot_configurations
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
    sqlx::query!(
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
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    course_id,
    enabled_to_students,
    chatbot_name,
    model,
    thinking_model,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    response_max_tokens,
    max_completion_tokens,
    use_azure_search,
    maintain_azure_search_index,
    hide_citations,
    use_semantic_reranking,
    default_chatbot,
    verbosity as "verbosity: VerbosityLevel",
    reasoning_effort as "reasoning_effort: ReasoningEffortLevel"
"#,
        chatbot_configuration_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
