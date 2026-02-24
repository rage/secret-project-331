use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "application_task", rename_all = "kebab-case")]
pub enum ApplicationTask {
    ContentCleaning,
    MessageSuggestion,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ApplicationTaskDefaultLanguageModel {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub model_id: Uuid,
    pub task: ApplicationTask,
    pub context_utilization: f32,
}

impl Default for ApplicationTaskDefaultLanguageModel {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            model_id: Default::default(),
            task: ApplicationTask::ContentCleaning,
            context_utilization: 0.75,
        }
    }
}

pub struct TaskLMSpec {
    pub id: Uuid,
    pub task: ApplicationTask,
    pub context_utilization: f32,
    pub model: String,
    pub thinking: bool,
    pub deployment_name: String,
    pub context_size: i32,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ApplicationTaskDefaultLanguageModel,
) -> ModelResult<ApplicationTaskDefaultLanguageModel> {
    let res = sqlx::query_as!(
        ApplicationTaskDefaultLanguageModel,
        r#"
INSERT INTO application_task_default_language_models (model_id, task, context_utilization)
VALUES ($1, $2, $3)
RETURNING
    id,
    created_at,
    updated_at,
    deleted_at,
    model_id,
    task as "task: ApplicationTask",
    context_utilization
        "#,
        input.model_id,
        input.task as ApplicationTask,
        input.context_utilization
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE application_task_default_language_models
SET deleted_at = now()
WHERE id = $1
AND deleted_at IS NULL
        "#,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_for_task(
    conn: &mut PgConnection,
    task: ApplicationTask,
) -> ModelResult<TaskLMSpec> {
    let res = sqlx::query_as!(
        TaskLMSpec,
        r#"
SELECT
    a.id,
    a.task as "task: ApplicationTask",
    a.context_utilization,
    model.model,
    model.thinking,
    model.deployment_name,
    model.context_size
FROM application_task_default_language_models AS a
JOIN chatbot_configurations_models AS model ON model.id = a.model_id
WHERE a.task = $1
AND a.deleted_at IS NULL
AND model.deleted_at IS NULL
        "#,
        task as ApplicationTask
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
