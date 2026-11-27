//! `get_exercise_repositories` and `manage_exercise_repository`: a course's exercise repositories,
//! which global admins manage. Repository actions take effect at once; they aren't staged.

use std::collections::BTreeMap;

use async_trait::async_trait;
use headless_lms_models::{
    CourseOrExamId,
    exercise_repositories::{self, ExerciseRepository, ExerciseRepositoryUpdate},
    repository_exercises::{self, RepositoryExercise},
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::access::{authorize_course, connection};
use crate::state::McpState;
use crate::text::serialized_len;
use crate::tools::args::{
    GetExerciseRepositoriesArgs, ManageExerciseRepositoryArgs, RepositoryAction,
};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

const IMMEDIATE: &str =
    "Done at once: repository actions aren't staged and can't be discarded or reverted.";
const SYNC_QUEUED: &str = "A sync is queued; it runs in the background within a minute or so. get_exercise_repositories shows status, error_message and last_sync_report when it's done.";

/// Handler of the `get_exercise_repositories` tool.
pub struct GetExerciseRepositories;

/// Handler of the `manage_exercise_repository` tool.
pub struct ManageExerciseRepository;

/// The exercise service plugin the repository's service found the exercise to use, if reported.
fn plugin(exercise: &RepositoryExercise) -> Option<&str> {
    exercise.details.as_ref()?.get("plugin")?.as_str()
}

fn repository_summary(repository: &ExerciseRepository, exercise_count: usize) -> Value {
    json!({
        "id": repository.id,
        "url": repository.url,
        "branch": repository.branch,
        "status": repository.status,
        "error_message": repository.error_message,
        "sync_attempts": repository.sync_attempts,
        "last_synced_at": repository.last_synced_at,
        "last_sync_report": repository.last_sync_report,
        "has_deploy_key": repository.has_deploy_key,
        "public_key": repository.public_key,
        "exercise_count": exercise_count,
        "exercise_task_count": repository.exercise_task_count,
    })
}

/// The repository, checked to belong to the course.
async fn repository_of_course(
    conn: &mut sqlx::PgConnection,
    course_id: Uuid,
    repository_id: Uuid,
) -> Result<ExerciseRepository, ToolError> {
    let repository = exercise_repositories::get(conn, repository_id).await?;
    if repository.course_id != Some(course_id) {
        return Err(ToolError::NotFound {
            message: format!(
                "course {course_id} has no exercise repository {repository_id}; get_exercise_repositories lists its repositories"
            ),
        });
    }
    Ok(repository)
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetExerciseRepositories {
    type Args = GetExerciseRepositoriesArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: GetExerciseRepositoriesArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let course_id = args.course.id();
        let mut conn = connection(state).await?;
        authorize_course(&mut conn, ctx.principal.actor.user_id, course_id).await?;
        let course = CourseOrExamId::Course(course_id);
        let Some(repository_id) = args.repository.map(|r| r.id()) else {
            let repositories =
                exercise_repositories::get_for_course_or_exam(&mut conn, course).await?;
            let mut counts: BTreeMap<Uuid, usize> = BTreeMap::new();
            for exercise in repository_exercises::get_for_course_or_exam(&mut conn, course).await? {
                *counts.entry(exercise.repository_id).or_default() += 1;
            }
            let repositories: Vec<Value> = repositories
                .iter()
                .map(|r| repository_summary(r, counts.get(&r.id).copied().unwrap_or_default()))
                .collect();
            return Ok(ToolResult::success(json!({
                "repositories": repositories,
                "note": "Give repository to list its exercises.",
            }))
            .into());
        };
        let repository = repository_of_course(&mut conn, course_id, repository_id).await?;
        let exercises: Vec<RepositoryExercise> =
            repository_exercises::get_for_repository(&mut conn, repository_id)
                .await?
                .into_iter()
                .filter(|e| args.part.as_deref().is_none_or(|part| e.part == part))
                .collect();
        let ids: Vec<Uuid> = exercises.iter().map(|e| e.id).collect();
        let mut uses: BTreeMap<Uuid, Vec<Value>> = BTreeMap::new();
        for used in repository_exercises::get_uses(&mut conn, &ids).await? {
            uses.entry(used.repository_exercise_id)
                .or_default()
                .push(json!({
                    "task": used.exercise_task_id,
                    "exercise": used.exercise_id,
                    "exercise_name": used.exercise_name,
                    "other_course": (used.course_id != Some(course_id)).then_some(used.course_id).flatten(),
                }));
        }
        let listed: Vec<Value> = exercises
            .iter()
            .map(|exercise| {
                json!({
                    "id": exercise.id,
                    "part": exercise.part,
                    "name": exercise.name,
                    "plugin": plugin(exercise),
                    "used_by": uses.remove(&exercise.id).unwrap_or_default(),
                })
            })
            .collect();
        let result = json!({
            "repository": repository_summary(&repository, exercises.len()),
            "exercises": listed,
            "note": "used_by lists published tasks only; staged links show in get_exercise.",
        });
        let budget = ctx.client.result_budget_bytes();
        if serialized_len(&result) > budget {
            let parts: std::collections::BTreeSet<&str> =
                exercises.iter().map(|e| e.part.as_str()).collect();
            return Err(ToolError::InvalidArguments {
                message: format!(
                    "the exercise list is over the {budget} bytes a read may return; give part, one of {parts:?}"
                ),
            });
        }
        Ok(ToolResult::success(result).into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for ManageExerciseRepository {
    type Args = ManageExerciseRepositoryArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: ManageExerciseRepositoryArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let course_id = args.course.id();
        let rules = state.repository_rules.as_ref();
        let refused = |message: String| ToolError::InvalidArguments { message };
        let mut conn = connection(state).await?;
        authorize_course(&mut conn, ctx.principal.actor.user_id, course_id).await?;
        let existing = match (args.action, args.repository) {
            (RepositoryAction::Add, None) => None,
            (RepositoryAction::Add, Some(_)) => {
                return Err(refused(
                    "add creates a repository; leave out repository".into(),
                ));
            }
            (_, Some(repository)) => {
                Some(repository_of_course(&mut conn, course_id, repository.id()).await?)
            }
            (_, None) => {
                return Err(refused(
                    "give repository, an id from get_exercise_repositories".into(),
                ));
            }
        };
        let generate_key = || -> Result<_, ToolError> {
            args.generate_deploy_key
                .then(|| rules.generate_deploy_key())
                .transpose()
                .map_err(ToolError::Internal)
        };
        let (repository_id, generated) = match (args.action, existing) {
            (RepositoryAction::Add, _) => {
                let url = args
                    .url
                    .as_deref()
                    .map(str::trim)
                    .filter(|url| !url.is_empty())
                    .ok_or_else(|| refused("add needs url".into()))?;
                let branch = rules
                    .check_url_and_branch(url, args.branch.flatten().as_deref())
                    .await
                    .map_err(refused)?;
                let keys = generate_key()?;
                let id = Uuid::new_v4();
                exercise_repositories::new(
                    &mut conn,
                    id,
                    CourseOrExamId::Course(course_id),
                    url,
                    branch.as_deref(),
                    keys.as_ref().map(|(public, _)| public.as_str()),
                    keys.as_ref().map(|(_, private)| private),
                )
                .await?;
                (id, keys.map(|(public, _)| public))
            }
            (RepositoryAction::Update, Some(repository)) => {
                let url = args
                    .url
                    .as_deref()
                    .map(str::trim)
                    .filter(|url| !url.is_empty())
                    .unwrap_or(&repository.url);
                let branch = match &args.branch {
                    Some(branch) => branch.as_deref(),
                    None => repository.branch.as_deref(),
                };
                let branch = rules
                    .check_url_and_branch(url, branch)
                    .await
                    .map_err(refused)?;
                let keys = generate_key()?;
                let public_key = keys.as_ref().map(|(public, _)| public.clone());
                let (public_key_update, deploy_key) = match keys {
                    Some((public, private)) => (Some(public), Some(private)),
                    None => (None, None),
                };
                exercise_repositories::update(
                    &mut conn,
                    repository.id,
                    &ExerciseRepositoryUpdate {
                        url: url.to_string(),
                        branch,
                        deploy_key,
                        public_key: public_key_update,
                    },
                )
                .await?;
                (repository.id, public_key)
            }
            (RepositoryAction::Sync, Some(repository)) => {
                exercise_repositories::request_sync(&mut conn, repository.id).await?;
                (repository.id, None)
            }
            (RepositoryAction::Delete, Some(repository)) => {
                if repository.exercise_task_count > 0 && !args.even_if_in_use {
                    return Err(ToolError::InvalidArguments {
                        message: format!(
                            "{} published exercise tasks use this repository's exercises; deleting it leaves them without their exercise files. Ask the teacher, and repeat with even_if_in_use: true only if they agree.",
                            repository.exercise_task_count
                        ),
                    });
                }
                rules
                    .delete(&mut conn, repository.id)
                    .await
                    .map_err(ToolError::Internal)?;
                return Ok(ToolResult::success(json!({
                    "deleted": repository.id,
                    "note": IMMEDIATE,
                }))
                .into());
            }
            (_, None) => return Err(ToolError::Internal("no repository to act on".into())),
        };
        let repository = exercise_repositories::get(&mut conn, repository_id).await?;
        let mut result = json!({
            "repository": repository_summary(&repository, 0),
            "note": format!("{IMMEDIATE} {SYNC_QUEUED}"),
        });
        if let Some(public_key) = generated {
            result["deploy_key"] = json!({
                "public_key": public_key,
                "next_step": "Ask someone with admin rights on the repository to add this public key as a read-only deploy key (GitHub: Settings > Deploy keys), then sync. The private key stays on the server.",
            });
        }
        if let Value::Object(summary) = &mut result["repository"] {
            summary.remove("exercise_count");
        }
        Ok(ToolResult::success(result).into())
    }
}
