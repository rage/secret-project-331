use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "reasoning_effort_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ReasoningEffortLevel {
    None,
    Minimal,
    Low,
    Medium,
    High,
    Xhigh,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "verbosity_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum VerbosityLevel {
    Low,
    Medium,
    High,
}

/// The UI/authorization grouping a [`ToolCategory`] belongs to. Derived from the leaf, never
/// stored: the database and the wire format only ever carry [`ToolCategory`] values.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategoryGroup {
    CourseAssistance,
    CourseDiscovery,
    Interaction,
    AdminSupport,
}

/// A category of chatbot tools a configuration can choose to offer the LLM. Independent of the
/// chatbot crate's per-tool `ToolPermission` check: a category answers "does this chatbot offer
/// this kind of tool", not "may this caller use it".
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "chatbot_tool_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    CourseMaterial,
    CourseInfo,
    CourseCatalog,
    Interaction,
    AdminSupportAccounts,
    AdminSupportCourses,
    AdminSupportLearningProgress,
    AdminSupportAcademicIntegrity,
}

impl ToolCategory {
    /// Canonical order for the UI, seeds, and normalization -- keep in sync with the enum
    /// definition above and with the `chatbot_tool_category` Postgres enum's value order.
    pub const ALL: [ToolCategory; 8] = [
        ToolCategory::CourseMaterial,
        ToolCategory::CourseInfo,
        ToolCategory::CourseCatalog,
        ToolCategory::Interaction,
        ToolCategory::AdminSupportAccounts,
        ToolCategory::AdminSupportCourses,
        ToolCategory::AdminSupportLearningProgress,
        ToolCategory::AdminSupportAcademicIntegrity,
    ];

    pub const fn group(self) -> ToolCategoryGroup {
        match self {
            ToolCategory::CourseMaterial | ToolCategory::CourseInfo => {
                ToolCategoryGroup::CourseAssistance
            }
            ToolCategory::CourseCatalog => ToolCategoryGroup::CourseDiscovery,
            ToolCategory::Interaction => ToolCategoryGroup::Interaction,
            ToolCategory::AdminSupportAccounts
            | ToolCategory::AdminSupportCourses
            | ToolCategory::AdminSupportLearningProgress
            | ToolCategory::AdminSupportAcademicIntegrity => ToolCategoryGroup::AdminSupport,
        }
    }

    pub const fn requires_global_admin(self) -> bool {
        matches!(self.group(), ToolCategoryGroup::AdminSupport)
    }
}

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct CreateChatbotRequest {
    pub name: String,
    pub course_id: Option<Uuid>,
    pub purpose: String,
}

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct ChatbotConfiguration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Option<Uuid>,
    pub enabled_to_students: bool,
    pub chatbot_name: String,
    pub model_id: Uuid,
    pub prompt: String,
    pub initial_message: String,
    pub weekly_tokens_per_user: i32,
    pub daily_tokens_per_user: i32,
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub max_output_tokens: i32,
    pub verbosity: VerbosityLevel,
    pub reasoning_effort: ReasoningEffortLevel,
    pub use_azure_search: bool,
    pub maintain_azure_search_index: bool,
    pub hide_citations: bool,
    pub use_semantic_reranking: bool,
    pub enabled_tool_categories: Vec<ToolCategory>,
    pub default_chatbot: bool,
    pub suggest_next_messages: bool,
    pub initial_suggested_messages: Option<Vec<String>>,
    pub publicly_accessible: bool,
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
            model_id: Uuid::nil(),
            prompt: Default::default(),
            initial_message: Default::default(),
            weekly_tokens_per_user: 20000 * 5,
            daily_tokens_per_user: 20000,
            max_output_tokens: 20_000,
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            reasoning_effort: ReasoningEffortLevel::Medium,
            verbosity: VerbosityLevel::Medium,
            use_azure_search: true,
            maintain_azure_search_index: true,
            hide_citations: false,
            use_semantic_reranking: false,
            enabled_tool_categories: vec![
                ToolCategory::CourseMaterial,
                ToolCategory::CourseInfo,
                ToolCategory::CourseCatalog,
                ToolCategory::Interaction,
            ],
            default_chatbot: false,
            suggest_next_messages: true,
            initial_suggested_messages: None,
            publicly_accessible: false,
        }
    }
}

#[derive(Clone, PartialEq, Deserialize, Serialize, Debug, ToSchema)]

pub struct NewChatbotConf {
    pub course_id: Option<Uuid>,
    pub enabled_to_students: bool,
    pub chatbot_name: String,
    pub model_id: Uuid,
    pub prompt: String,
    pub initial_message: String,
    pub weekly_tokens_per_user: i32,
    pub daily_tokens_per_user: i32,
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub max_output_tokens: i32,
    pub verbosity: VerbosityLevel,
    pub reasoning_effort: ReasoningEffortLevel,
    pub use_azure_search: bool,
    pub maintain_azure_search_index: bool,
    pub hide_citations: bool,
    pub use_semantic_reranking: bool,
    pub enabled_tool_categories: Vec<ToolCategory>,
    pub default_chatbot: bool,
    pub chatbotconf_id: Option<Uuid>,
    pub suggest_next_messages: bool,
    pub initial_suggested_messages: Option<Vec<String>>,
    pub publicly_accessible: bool,
}

impl Default for NewChatbotConf {
    fn default() -> Self {
        let chatbot_conf: ChatbotConfiguration = ChatbotConfiguration::default();
        Self {
            course_id: chatbot_conf.course_id,
            enabled_to_students: chatbot_conf.enabled_to_students,
            chatbot_name: chatbot_conf.chatbot_name,
            model_id: chatbot_conf.model_id,
            prompt: chatbot_conf.prompt,
            initial_message: chatbot_conf.initial_message,
            weekly_tokens_per_user: chatbot_conf.weekly_tokens_per_user,
            daily_tokens_per_user: chatbot_conf.daily_tokens_per_user,
            temperature: chatbot_conf.temperature,
            top_p: chatbot_conf.top_p,
            frequency_penalty: chatbot_conf.frequency_penalty,
            presence_penalty: chatbot_conf.presence_penalty,
            max_output_tokens: chatbot_conf.max_output_tokens,
            verbosity: chatbot_conf.verbosity,
            reasoning_effort: chatbot_conf.reasoning_effort,
            use_azure_search: chatbot_conf.use_azure_search,
            maintain_azure_search_index: chatbot_conf.maintain_azure_search_index,
            hide_citations: chatbot_conf.hide_citations,
            use_semantic_reranking: chatbot_conf.use_semantic_reranking,
            enabled_tool_categories: chatbot_conf.enabled_tool_categories,
            default_chatbot: chatbot_conf.default_chatbot,
            chatbotconf_id: None,
            suggest_next_messages: chatbot_conf.suggest_next_messages,
            initial_suggested_messages: chatbot_conf.initial_suggested_messages,
            publicly_accessible: chatbot_conf.publicly_accessible,
        }
    }
}

impl From<ChatbotConfiguration> for NewChatbotConf {
    fn from(v: ChatbotConfiguration) -> Self {
        Self {
            course_id: v.course_id,
            enabled_to_students: v.enabled_to_students,
            chatbot_name: v.chatbot_name,
            model_id: v.model_id,
            prompt: v.prompt,
            initial_message: v.initial_message,
            weekly_tokens_per_user: v.weekly_tokens_per_user,
            daily_tokens_per_user: v.daily_tokens_per_user,
            temperature: v.temperature,
            top_p: v.top_p,
            frequency_penalty: v.frequency_penalty,
            presence_penalty: v.presence_penalty,
            max_output_tokens: v.max_output_tokens,
            verbosity: v.verbosity,
            reasoning_effort: v.reasoning_effort,
            use_azure_search: v.use_azure_search,
            maintain_azure_search_index: v.maintain_azure_search_index,
            hide_citations: v.hide_citations,
            use_semantic_reranking: v.use_semantic_reranking,
            use_tools: v.use_tools,
            default_chatbot: v.default_chatbot,
            chatbotconf_id: Some(v.id),
            suggest_next_messages: v.suggest_next_messages,
            initial_suggested_messages: v.initial_suggested_messages,
            publicly_accessible: v.publicly_accessible,
        }
    }
}

/// Minimum `max_output_tokens` allowed for a configuration. Too small a budget cannot produce a
/// usable response — and with reasoning models the hidden reasoning tokens are spent from the same
/// budget, so the floor needs to leave room for the actual answer either way.
const MIN_MAX_OUTPUT_TOKENS: i32 = 10_000;

/// Rejects configurations whose `max_output_tokens` is too small to produce a usable response.
fn validate_max_output_tokens(input: &NewChatbotConf) -> ModelResult<()> {
    if input.max_output_tokens < MIN_MAX_OUTPUT_TOKENS {
        return Err(model_err!(
            PreconditionFailed,
            format!("max_output_tokens must be at least {MIN_MAX_OUTPUT_TOKENS}.")
        ));
    }
    Ok(())
}

/// Whether the configuration may use Azure search, which needs a course: the search index it
/// queries is built per course, so a configuration without one has nothing to search.
fn azure_search_allowed(input: &NewChatbotConf, course_id: Option<Uuid>) -> bool {
    input.use_azure_search && course_id.is_some()
}

/// Dedupes and sorts into [`ToolCategory::ALL`] order, so the stored array is canonical and two
/// equal sets (e.g. compared by the `edit_chatbot` controller) compare equal regardless of the
/// order the caller submitted them in.
pub fn normalized_tool_categories(input: &[ToolCategory]) -> Vec<ToolCategory> {
    ToolCategory::ALL
        .into_iter()
        .filter(|category| input.contains(category))
        .collect()
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ChatbotConfiguration> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
SELECT *
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
    validate_max_output_tokens(&input)?;
    let use_azure_search = azure_search_allowed(&input, input.course_id);
    let maintain_azure_search_index = use_azure_search;
    let enabled_tool_categories = normalized_tool_categories(&input.enabled_tool_categories);
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
INSERT INTO chatbot_configurations (
    id,
    course_id,
    enabled_to_students,
    chatbot_name,
    model_id,
    prompt,
    initial_message,
    weekly_tokens_per_user,
    daily_tokens_per_user,
    temperature,
    top_p,
    hide_citations,
    frequency_penalty,
    presence_penalty,
    max_output_tokens,
    verbosity,
    reasoning_effort,
    use_azure_search,
    enabled_tool_categories,
    maintain_azure_search_index,
    default_chatbot,
    suggest_next_messages,
    initial_suggested_messages,
    publicly_accessible
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
RETURNING *
        "#,
        pkey_policy.into_uuid(),
        input.course_id,
        input.enabled_to_students,
        input.chatbot_name,
        input.model_id,
        input.prompt,
        input.initial_message,
        input.weekly_tokens_per_user,
        input.daily_tokens_per_user,
        input.temperature,
        input.top_p,
        input.hide_citations,
        input.frequency_penalty,
        input.presence_penalty,
        input.max_output_tokens,
        input.verbosity as VerbosityLevel,
        input.reasoning_effort as ReasoningEffortLevel,
        use_azure_search,
        &enabled_tool_categories as &[ToolCategory],
        maintain_azure_search_index,
        input.default_chatbot,
        input.suggest_next_messages,
        input.initial_suggested_messages.as_deref(),
        input.publicly_accessible
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
    validate_max_output_tokens(&input)?;
    // The course the configuration is already attached to, not the one the caller sent: `edit`
    // never moves a configuration between courses.
    let course_id = get_by_id(conn, chatbot_configuration_id).await?.course_id;
    let use_azure_search = azure_search_allowed(&input, course_id);
    let enabled_tool_categories = normalized_tool_categories(&input.enabled_tool_categories);
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
    max_output_tokens = $11,
    use_azure_search = $12,
    maintain_azure_search_index = $13,
    hide_citations = $14,
    use_semantic_reranking = $15,
    default_chatbot = $16,
    model_id = $17,
    verbosity = $18,
    reasoning_effort = $19,
    enabled_tool_categories = $20,
    suggest_next_messages = $21,
    initial_suggested_messages = $22,
    publicly_accessible = $23
WHERE id = $24
    AND deleted_at IS NULL
RETURNING *
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
        input.max_output_tokens,
        use_azure_search,
        use_azure_search,
        input.hide_citations,
        input.use_semantic_reranking,
        input.default_chatbot,
        input.model_id,
        input.verbosity as VerbosityLevel,
        input.reasoning_effort as ReasoningEffortLevel,
        &enabled_tool_categories as &[ToolCategory],
        input.suggest_next_messages,
        input.initial_suggested_messages.as_deref(),
        input.publicly_accessible,
        chatbot_configuration_id,
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
SELECT *
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
SELECT *
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
SELECT *
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
SET default_chatbot = TRUE
WHERE id = $1
  AND deleted_at IS NULL
RETURNING *
"#,
        chatbot_configuration_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_chatbots(conn: &mut PgConnection) -> ModelResult<Vec<ChatbotConfiguration>> {
    let res = sqlx::query_as!(
        ChatbotConfiguration,
        r#"
    SELECT *
    FROM chatbot_configurations
    WHERE deleted_at IS NULL
    "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
