use super::{courses::Course, ModelResult};
use crate::{
    models::{
        chapters::DatabaseChapter,
        exercise_service_info,
        exercise_services::{get_internal_public_spec_url, get_model_solution_url},
        exercise_tasks::ExerciseTask,
        exercises::Exercise,
        ModelError,
    },
    utils::document_schema_processor::{
        contains_blocks_not_allowed_in_top_level_pages, denormalize, normalize_from_json,
        GutenbergBlock, NormalizedDocument,
    },
};

use chrono::{DateTime, Utc};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, FromRow, PgConnection};
use std::{collections::HashMap, time::Duration};
use ts_rs::TS;
use url::Url;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct Page {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub course_id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub url_path: String,
    pub title: String,
    pub deleted_at: Option<DateTime<Utc>>,
    // should always be a Vec<GutenbergBlock>, but is more convenient to keep as Value for sqlx
    pub content: serde_json::Value,
    pub order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct PageWithExercises {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    course_id: Uuid,
    chapter_id: Option<Uuid>,
    content: serde_json::Value,
    url_path: String,
    title: String,
    order_number: i32,
    deleted_at: Option<DateTime<Utc>>,
    exercises: Vec<Exercise>,
}

// Represents the subset of page fields that are required to create a new page.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewPage {
    pub content: serde_json::Value,
    pub url_path: String,
    pub title: String,
    pub course_id: Uuid,
    pub chapter_id: Option<Uuid>,
    /// If set, set this page to be the front page of this course part.
    pub front_page_of_chapter_id: Option<Uuid>,
}

// Represents the subset of page fields that the user is allowed to modify.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct PageUpdate {
    content: serde_json::Value,
    url_path: String,
    title: String,
    chapter_id: Option<Uuid>,
    /// If set, set this page to be the front page of this course part.
    front_page_of_chapter_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NormalizedCmsExercise {
    // The id will be validated so that the client can't change it on us.
    pub id: Uuid,
    pub name: String,
    pub order_number: i32,
    pub exercise_tasks: Vec<NormalizedCmsExerciseTask>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NormalizedCmsExerciseTask {
    pub id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub private_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NormalizedCmsExerciseTaskWithExerciseId {
    pub id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
    pub exercise_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct PageRoutingData {
    url_path: String,
    title: String,
    chapter_number: i32,
    chapter_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
pub struct PageMetadata {
    page_id: Uuid,
    order_number: i32,
    chapter_id: Option<Uuid>,
    chapter_number: Option<i32>,
    course_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone, TS)]
pub struct PageSearchResult {
    id: Uuid,
    title_headline: Option<String>,
    rank: Option<f32>,
    content_headline: Option<String>,
    url_path: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone, TS)]
pub struct PageSearchRequest {
    query: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone, TS)]
pub struct ExerciseWithExerciseTasks {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    course_id: Uuid,
    deleted_at: Option<DateTime<Utc>>,
    name: String,
    deadline: Option<DateTime<Utc>>,
    page_id: Uuid,
    exercise_tasks: Vec<ExerciseTask>,
    score_maximum: i32,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    url_path: &str,
    title: &str,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO pages (
    course_id,
    content,
    url_path,
    title,
    order_number
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        course_id,
        serde_json::Value::Array(vec![]),
        url_path,
        title,
        order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn set_chapter(
    conn: &mut PgConnection,
    page_id: Uuid,
    chapter_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE pages SET chapter_id = $1 WHERE id = $2",
        chapter_id,
        page_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_content(
    conn: &mut PgConnection,
    page_id: Uuid,
    content: &[GutenbergBlock],
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE pages
SET content = $1
WHERE id = $2
",
        serde_json::to_value(content).unwrap(),
        page_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!("SELECT course_id FROM pages WHERE id = $1", id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn course_pages(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
FROM pages
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(pages)
}

pub async fn chapter_pages(conn: &mut PgConnection, chapter_id: Uuid) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
FROM pages
WHERE chapter_id = $1
  AND deleted_at IS NULL;
        ",
        chapter_id
    )
    .fetch_all(conn)
    .await?;
    Ok(pages)
}

pub async fn get_page(conn: &mut PgConnection, page_id: Uuid) -> ModelResult<Page> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
FROM pages
WHERE id = $1;
",
        page_id
    )
    .fetch_one(conn)
    .await?;
    Ok(pages)
}

pub async fn get_page_by_path(
    conn: &mut PgConnection,
    course_slug: String,
    url_path: &str,
) -> ModelResult<Page> {
    let page = sqlx::query_as!(
        Page,
        "
SELECT pages.id,
  pages.created_at,
  pages.updated_at,
  pages.course_id,
  pages.chapter_id,
  pages.url_path,
  pages.title,
  pages.deleted_at,
  pages.content,
  pages.order_number
FROM pages
  JOIN courses ON (pages.course_id = courses.id)
WHERE courses.slug = $1
  AND url_path = $2
  AND courses.deleted_at IS NULL
  AND pages.deleted_at IS NULL;
        ",
        course_slug,
        url_path
    )
    .fetch_one(conn)
    .await?;
    Ok(page)
}

pub async fn get_page_with_exercises(conn: &mut PgConnection, page_id: Uuid) -> ModelResult<Page> {
    let mut page = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
FROM pages
WHERE id = $1;
    ",
        page_id
    )
    .fetch_one(&mut *conn)
    .await?;

    let exercises: Vec<Exercise> = sqlx::query_as!(
        Exercise,
        "SELECT * FROM exercises WHERE page_id = $1;",
        page_id
    )
    .fetch_all(&mut *conn)
    .await?;

    let exercise_tasks: Vec<NormalizedCmsExerciseTaskWithExerciseId> = sqlx::query_as!(
        NormalizedCmsExerciseTaskWithExerciseId,
        "SELECT id, exercise_type, assignment, public_spec, private_spec, exercise_id FROM exercise_tasks WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1);",
        page_id
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut exercise_tasks_by_exercise: HashMap<Uuid, Vec<NormalizedCmsExerciseTask>> =
        exercise_tasks
            .into_iter()
            .into_group_map_by(|et| et.exercise_id)
            .into_iter()
            .map(|(key, value)| {
                (
                    key,
                    value
                        .into_iter()
                        .map(|i| NormalizedCmsExerciseTask {
                            id: i.id,
                            exercise_type: i.exercise_type,
                            assignment: i.assignment,
                            private_spec: i.private_spec,
                        })
                        .collect(),
                )
            })
            .collect();

    let exercises_with_tasks: Vec<NormalizedCmsExercise> = exercises
        .into_iter()
        .map(|e| {
            let exercise_tasks = match exercise_tasks_by_exercise.remove(&e.id) {
                Some(et) => et,
                None => Vec::new(),
            };
            NormalizedCmsExercise {
                id: e.id,
                name: e.name,
                order_number: e.order_number,
                exercise_tasks,
            }
        })
        .collect();
    // This is for cms so we need to put exercises back inside the content
    let normalized_document = NormalizedDocument {
        content: serde_json::from_value(page.content)?,
        exercises: exercises_with_tasks,
    };

    let denormalized_content = denormalize(normalized_document)?;
    let content_json = serde_json::to_value(denormalized_content)?;
    page.content = content_json;

    Ok(page)
}

// This has 3 stages: updating page, updating exercises, updating exercise tasks.
// This is currently implemented with multiple sql queries, but it could be optimized
// with data-modifying common table expressions if necessary.
pub async fn update_page(
    conn: &mut PgConnection,
    page_id: Uuid,
    page_update: PageUpdate,
) -> ModelResult<Page> {
    let normalized_document = normalize_from_json(page_update.content)?;

    if page_update.chapter_id.is_none()
        && contains_blocks_not_allowed_in_top_level_pages(&normalized_document.content)
    {
        return Err(ModelError::Generic(
                "Top level pages cannot contain exercises, exercise tasks or list of exercises in the chapter".to_string(),
            ));
    }

    let NormalizedDocument { content, exercises } = normalized_document;
    let content_as_json = serde_json::to_value(content)?;
    let mut tx = conn.begin().await?;
    // Updating page
    let page = sqlx::query_as!(
        Page,
        r#"
UPDATE pages
SET content = $2,
  url_path = $3,
  title = $4,
  chapter_id = $5
WHERE id = $1
RETURNING id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
            "#,
        page_id,
        content_as_json,
        page_update.url_path.trim(),
        page_update.title.trim(),
        page_update.chapter_id
    )
    .fetch_one(&mut tx)
    .await?;

    let (result_exercises, new_content) =
        upsert_exercises_and_exercise_tasks(&exercises, &page, &mut tx).await?;

    let denormalized_content = denormalize(NormalizedDocument {
        content: serde_json::from_value(new_content)?,
        exercises: result_exercises,
    })?;

    if let Some(front_page_of_chapter_id) = page_update.front_page_of_chapter_id {
        let _res = sqlx::query_as!(
            Chapter,
            r#"
UPDATE chapters SET front_page_id = $1 WHERE id = $2
        "#,
            page_id,
            front_page_of_chapter_id
        )
        // this should fail if no rows returned
        .fetch_one(&mut tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Page {
        content: serde_json::to_value(denormalized_content)?,
        course_id: page.course_id,
        created_at: page.created_at,
        updated_at: page.updated_at,
        deleted_at: page.deleted_at,
        id: page.id,
        title: page.title,
        url_path: page.url_path,
        order_number: page.order_number,
        chapter_id: page.chapter_id,
    })
}

struct ExerciseTaskIdAndSpec {
    id: Uuid,
    private_spec: Option<serde_json::Value>,
    public_spec: Option<serde_json::Value>,
    model_solution_spec: Option<serde_json::Value>,
}

/// Used by page inserts and page updates. The logic can be shared since the allowed inputs are the same.
async fn upsert_exercises_and_exercise_tasks(
    exercises: &[NormalizedCmsExercise],
    page: &Page,
    conn: &mut PgConnection,
) -> ModelResult<(Vec<NormalizedCmsExercise>, serde_json::Value)> {
    // All related exercises and items should be deleted if not included in the update
    // We accomplish this by deleting everyting first in the transaction and then
    // undeleting the necessary items when doing the actual updates
    // We need existing exercise ids to check which ids are client generated and need to be replaced.
    sqlx::query!(
        r#"
        UPDATE exercises SET deleted_at = now() WHERE page_id = $1
            "#,
        page.id
    )
    .execute(&mut *conn)
    .await?;

    sqlx::query!(
        r#"
        UPDATE exercise_tasks SET deleted_at = now() WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1)
            "#,
        page.id
    )
    .execute(&mut *conn)
    .await?;

    // We need existing exercise ids to check which ids are client generated and need to be replaced.
    let existing_exercise_ids = sqlx::query!(
        r#"
    SELECT id from exercises WHERE page_id = $1
        "#,
        page.id
    )
    .fetch_all(&mut *conn)
    .await?;

    // let exercise_infos_by_type = get_all_exercise_services_by_type(conn).await?;
    let existing_exercise_tasks = sqlx::query_as!(
        ExerciseTaskIdAndSpec,
        r#"
SELECT et.id,
  et.private_spec,
  et.public_spec,
  et.model_solution_spec
from exercise_tasks et
  JOIN exercises e ON (e.id = et.exercise_id)
WHERE page_id = $1
        "#,
        page.id
    )
    .fetch_all(&mut *conn)
    .await?;

    // For generating public specs for exercises.
    let exercise_types: Vec<String> = exercises
        .iter()
        .flat_map(|exercise| &exercise.exercise_tasks)
        .map(|task| task.exercise_type.clone())
        .unique()
        .collect();
    let client = reqwest::Client::new();

    let exercise_service_hashmap =
        exercise_service_info::get_selected_exercise_services_by_type(conn, &exercise_types)
            .await?;
    let public_spec_urls_by_exercise_type = exercise_service_hashmap
        .iter()
        .map(|(key, (service, info))| Ok((key, get_internal_public_spec_url(service, info)?)))
        .collect::<ModelResult<HashMap<&String, Url>>>()?;
    let model_solution_urls_by_exercise_type = exercise_service_hashmap
        .iter()
        .map(|(key, (service, info))| Ok((key, get_model_solution_url(service, info)?)))
        .collect::<ModelResult<HashMap<&String, Url>>>()?;
    // for returning the inserted values
    let mut result_exercises: Vec<NormalizedCmsExercise> = Vec::new();
    let mut changed_ids: HashMap<Uuid, Uuid> = HashMap::new();
    for exercise_update in exercises.iter() {
        let mut exercise_exercise_tasks: Vec<NormalizedCmsExerciseTask> = Vec::new();
        let safe_for_db_exercise_id = if existing_exercise_ids
            .iter()
            .any(|o| o.id == exercise_update.id)
        {
            exercise_update.id
        } else {
            let new_uuid = Uuid::new_v4();
            changed_ids.insert(exercise_update.id, new_uuid);
            new_uuid
        };
        // Upsert
        let exercise: Exercise = sqlx::query_as!(
            Exercise,
            r#"
INSERT INTO exercises(
    id,
    course_id,
    name,
    order_number,
    page_id,
    chapter_id
  )
VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO
UPDATE
SET course_id = $2,
  name = $3,
  order_number = $4,
  page_id = $5,
  chapter_id = $6,
  deleted_at = NULL
RETURNING *;
        "#,
            safe_for_db_exercise_id,
            page.course_id,
            exercise_update.name,
            exercise_update.order_number,
            page.id,
            page.chapter_id,
        )
        .fetch_one(&mut *conn)
        .await?;
        for task_update in exercise_update.exercise_tasks.iter() {
            let existing_exercise_task = existing_exercise_tasks
                .iter()
                .find(|o| o.id == task_update.id);
            let safe_for_db_exercise_task_id = match existing_exercise_task {
                Some(_) => task_update.id,
                None => {
                    // No need to add this to changed ids because exercise task ids
                    // are not supposed to appear in the content json.
                    Uuid::new_v4()
                }
            };
            let model_solution_spec = fetch_derived_spec(
                existing_exercise_task,
                task_update,
                &model_solution_urls_by_exercise_type,
                &client,
                existing_exercise_task
                    .map(|value| value.model_solution_spec.clone())
                    .flatten(),
            )
            .await?;
            let public_spec: Option<serde_json::Value> = fetch_derived_spec(
                existing_exercise_task,
                task_update,
                &public_spec_urls_by_exercise_type,
                &client,
                existing_exercise_task
                    .map(|value| value.public_spec.clone())
                    .flatten(),
            )
            .await?;
            // Upsert
            let exercise_task: NormalizedCmsExerciseTask = sqlx::query_as!(
                NormalizedCmsExerciseTask,
                r#"
INSERT INTO exercise_tasks(id, exercise_id, exercise_type, assignment, public_spec, private_spec, model_solution_spec)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (id) DO UPDATE
SET exercise_id=$2, exercise_type=$3, assignment=$4, public_spec=$5, private_spec=$6, deleted_at=NULL
RETURNING id, exercise_type, assignment, private_spec;
        "#,
                safe_for_db_exercise_task_id,
                safe_for_db_exercise_id,
                task_update.exercise_type,
                task_update.assignment,
                public_spec,
                task_update.private_spec,
                model_solution_spec,
            )
            .fetch_one(&mut *conn)
            .await?;
            exercise_exercise_tasks.push(exercise_task);
        }
        result_exercises.push(NormalizedCmsExercise {
            id: exercise.id,
            name: exercise.name,
            order_number: exercise.order_number,
            exercise_tasks: exercise_exercise_tasks,
        })
    }

    // Now, we might have changed some of the exercise ids and need to do the same changes in the page content as well
    let new_content = update_ids_in_content(&page.content, changed_ids)?;
    sqlx::query!(
        r#"UPDATE pages SET content = $1 WHERE id = $2;"#,
        new_content,
        page.id
    )
    .execute(conn)
    .await?;
    Ok((result_exercises, new_content))
}

async fn fetch_derived_spec(
    existing_exercise_task: Option<&ExerciseTaskIdAndSpec>,
    task_update: &NormalizedCmsExerciseTask,
    urls_by_exercise_type: &HashMap<&String, Url>,
    client: &reqwest::Client,
    previous_spec: Option<serde_json::Value>,
) -> Result<Option<serde_json::Value>, ModelError> {
    let result_spec: Option<serde_json::Value> = match existing_exercise_task {
        Some(exercise_task) if exercise_task.private_spec == task_update.private_spec => {
            // Skip generating public spec for an existing exercise again if private spec is still the same.
            previous_spec
        }
        _ => {
            let url = urls_by_exercise_type
                .get(&task_update.exercise_type)
                .ok_or_else(|| {
                    ModelError::PreconditionFailed("Missing info for exercise type.".to_string())
                })?
                .clone();
            let res = client
                .post(url)
                .timeout(Duration::from_secs(120))
                .json(&task_update.private_spec)
                .send()
                .await?;
            if !res.status().is_success() {
                return Err(ModelError::Generic(
                    "Failed to generate spec for exercise.".to_string(),
                ));
            }
            Some(res.json::<serde_json::Value>().await?)
        }
    };
    Ok(result_spec)
}

fn update_ids_in_content(
    content: &serde_json::Value,
    chaged_ids: HashMap<Uuid, Uuid>,
) -> ModelResult<serde_json::Value> {
    // naive implementation for now because the structure of the content was not decided at the time of writing this.
    // In the future we could only edit the necessary fields.
    let mut content_str = serde_json::to_string(content)?;
    for (k, v) in chaged_ids.into_iter() {
        content_str = content_str.replace(&k.to_string(), &v.to_string());
    }
    Ok(serde_json::from_str(&content_str)?)
}

pub async fn insert_page(conn: &mut PgConnection, new_page: NewPage) -> ModelResult<Page> {
    let normalized_document = normalize_from_json(new_page.content)?;

    if new_page.chapter_id.is_none()
        && contains_blocks_not_allowed_in_top_level_pages(&normalized_document.content)
    {
        return Err(ModelError::Generic(
                "Top level pages cannot contain exercises, exercise tasks or list of exercises in the chapter".to_string(),
            ));
    }

    let NormalizedDocument { content, exercises } = normalized_document;
    let content_as_json = serde_json::to_value(content.clone())?;
    let next_order_number = match new_page.chapter_id {
        Some(id) => get_next_page_order_number_in_chapter(conn, id).await?,
        None => get_next_order_number_for_courses_top_level_pages(conn, new_page.course_id).await?,
    };
    let mut tx = conn.begin().await?;
    // For sharing the transaction between functions
    // let transaction_holder = RefCell::new(transaction);

    let course = crate::models::courses::get_course(&mut tx, new_page.course_id).await?;

    let page = sqlx::query_as!(
        Page,
        r#"
INSERT INTO pages(
    course_id,
    content,
    url_path,
    title,
    order_number,
    chapter_id,
    content_search_language
  )
VALUES($1, $2, $3, $4, $5, $6, $7::regconfig)
RETURNING id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
          "#,
        new_page.course_id,
        content_as_json,
        new_page.url_path.trim(),
        new_page.title.trim(),
        next_order_number,
        new_page.chapter_id,
        course.content_search_language as _
    )
    .fetch_one(&mut tx)
    .await?;

    let (result_exercises, new_content) =
        upsert_exercises_and_exercise_tasks(&exercises, &page, &mut tx).await?;

    let denormalized_content = denormalize(NormalizedDocument {
        content: serde_json::from_value(new_content)?,
        exercises: result_exercises,
    })?;

    if let Some(front_page_of_chapter_id) = new_page.front_page_of_chapter_id {
        let _res = sqlx::query_as!(
            DatabaseChapter,
            r#"
UPDATE chapters
SET front_page_id = $1
WHERE id = $2
RETURNING *;
        "#,
            page.id,
            front_page_of_chapter_id
        )
        // this should fail if no rows returned
        .fetch_one(&mut tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Page {
        content: serde_json::to_value(denormalized_content)?,
        course_id: page.course_id,
        created_at: page.created_at,
        updated_at: page.updated_at,
        deleted_at: page.deleted_at,
        id: page.id,
        title: page.title,
        url_path: page.url_path,
        order_number: page.order_number,
        chapter_id: page.chapter_id,
    })
}

pub async fn delete_page_and_exercises(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Page> {
    let mut tx = conn.begin().await?;
    let page = sqlx::query_as!(
        Page,
        r#"
UPDATE pages
SET deleted_at = now()
WHERE id = $1
RETURNING id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
          "#,
        page_id,
    )
    .fetch_one(&mut tx)
    .await?;

    sqlx::query!(
        r#"
  UPDATE exercises
  SET deleted_at = now()
  WHERE page_id = $1
          "#,
        page_id,
    )
    .execute(&mut tx)
    .await?;

    sqlx::query!(
        r#"
  UPDATE exercise_tasks
  SET deleted_at = now()
  WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1)
          "#,
        page_id,
    )
    .execute(&mut tx)
    .await?;

    tx.commit().await?;
    Ok(page)
}

pub async fn get_chapters_pages_with_exercises(
    conn: &mut PgConnection,
    chapters_id: Uuid,
) -> ModelResult<Vec<PageWithExercises>> {
    let chapter_pages = sqlx::query_as!(
        Page,
        r#"
SELECT id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
FROM pages
WHERE chapter_id = $1
  AND deleted_at IS NULL
        "#,
        chapters_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let page_ids: Vec<Uuid> = chapter_pages.iter().map(|page| page.id).collect();
    let pages_exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE page_id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND deleted_at IS NULL
        "#,
        &page_ids
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut page_to_exercises: HashMap<Uuid, Vec<Exercise>> = pages_exercises
        .into_iter()
        .into_group_map_by(|exercise| exercise.page_id);
    let mut chapter_pages_with_exercises: Vec<PageWithExercises> = chapter_pages
        .into_iter()
        .map(|page| {
            let page_id = page.id;
            let mut exercises = match page_to_exercises.remove(&page_id) {
                Some(ex) => ex,
                None => Vec::new(),
            };

            exercises.sort_by(|a, b| a.order_number.cmp(&b.order_number));
            PageWithExercises {
                id: page.id,
                created_at: page.created_at,
                updated_at: page.updated_at,
                course_id: page.course_id,
                chapter_id: page.chapter_id,
                content: page.content,
                url_path: page.url_path,
                title: page.title,
                order_number: page.order_number,
                deleted_at: page.deleted_at,
                exercises,
            }
        })
        .collect();

    chapter_pages_with_exercises.sort_by(|a, b| a.order_number.cmp(&b.order_number));

    Ok(chapter_pages_with_exercises)
}

pub async fn get_next_page(
    conn: &mut PgConnection,
    pages_id: Uuid,
) -> ModelResult<Option<PageRoutingData>> {
    let page_metadata = get_current_page_metadata(conn, pages_id).await?;
    let next_page = get_next_page_by_order_number(conn, &page_metadata).await?;

    match next_page {
        Some(next_page) => Ok(Some(next_page)),
        None => {
            let first_page = get_next_page_by_chapter_number(conn, &page_metadata).await?;
            Ok(first_page)
        }
    }
}

async fn get_current_page_metadata(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<PageMetadata> {
    let page_metadata = sqlx::query_as!(
        PageMetadata,
        r#"
SELECT p.id as page_id,
  p.order_number as order_number,
  p.course_id as course_id,
  c.id as "chapter_id?",
  c.chapter_number as "chapter_number?"
FROM pages p
  LEFT JOIN chapters c ON p.chapter_id = c.id
WHERE p.id = $1;
"#,
        page_id
    )
    .fetch_one(conn)
    .await?;

    if page_metadata.chapter_number.is_none() {
        return Err(ModelError::InvalidRequest(
            "Page is not related to any chapter".to_string(),
        ));
    }

    Ok(page_metadata)
}

async fn get_next_page_by_order_number(
    conn: &mut PgConnection,
    current_page_metadata: &PageMetadata,
) -> ModelResult<Option<PageRoutingData>> {
    let next_page = sqlx::query_as!(
        PageRoutingData,
        "
SELECT p.url_path as url_path,
  p.title as title,
  c.chapter_number as chapter_number,
  c.id as chapter_id
FROM pages p
  LEFT JOIN chapters c ON p.chapter_id = c.id
WHERE p.order_number = (
    SELECT MIN(pa.order_number)
    FROM pages pa
    WHERE pa.order_number > $1
      AND pa.deleted_at IS NULL
  )
  AND p.course_id = $2
  AND c.chapter_number = $3;
        ",
        current_page_metadata.order_number,
        current_page_metadata.course_id,
        current_page_metadata.chapter_number
    )
    .fetch_optional(conn)
    .await?;

    Ok(next_page)
}

async fn get_next_page_by_chapter_number(
    conn: &mut PgConnection,
    current_page_metadata: &PageMetadata,
) -> ModelResult<Option<PageRoutingData>> {
    let next_page = sqlx::query_as!(
        PageRoutingData,
        "
SELECT p.url_path as url_path,
  p.title as title,
  c.chapter_number as chapter_number,
  c.id as chapter_id
FROM chapters c
  INNER JOIN pages p on c.id = p.chapter_id
WHERE c.chapter_number = (
    SELECT MIN(ca.chapter_number)
    FROM chapters ca
    WHERE ca.chapter_number > $1
      AND ca.deleted_at IS NULL
  )
  AND c.course_id = $2
ORDER BY p.order_number
LIMIT 1;
        ",
        current_page_metadata.chapter_number,
        current_page_metadata.course_id
    )
    .fetch_optional(conn)
    .await?;

    Ok(next_page)
}

async fn get_next_page_order_number_in_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<i32> {
    let next_order_number = sqlx::query!(
        "
select max(p.order_number) as order_number
from pages p
where p.chapter_id = $1
  and p.deleted_at is null;
",
        chapter_id
    )
    .fetch_one(conn)
    .await?;

    match next_order_number.order_number {
        Some(order_number) => Ok(order_number + 1),
        None => Ok(0),
    }
}

async fn get_next_order_number_for_courses_top_level_pages(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<i32> {
    let next_order_number = sqlx::query!(
        "
select max(p.order_number) as order_number
from pages p
where p.course_id = $1
  and p.chapter_id is null
  and p.deleted_at is null;
",
        course_id
    )
    .fetch_one(conn)
    .await?;

    match next_order_number.order_number {
        Some(order_number) => Ok(order_number + 1),
        None => Ok(0),
    }
}

pub async fn get_chapters_pages_exclude_main_frontpage(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
        Page,
        "
SELECT id,
  created_at,
  updated_at,
  course_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number
FROM pages p
WHERE p.chapter_id = $1
  AND p.deleted_at IS NULL
  AND p.id NOT IN (
    SELECT front_page_id
    FROM chapters c
    WHERE c.front_page_id = p.id
  );
    ",
        chapter_id
    )
    .fetch_all(conn)
    .await?;

    Ok(pages)
}

/**
Returns search results for a phrase i.e. looks for matches where the words come up right after each other
*/
pub async fn get_page_search_results_for_phrase(
    conn: &mut PgConnection,
    course_id: Uuid,
    page_search_request: &PageSearchRequest,
) -> ModelResult<Vec<PageSearchResult>> {
    let course = crate::models::courses::get_course(&mut *conn, course_id).await?;

    // Last word of the search term needed so that the sql statement can change it to a prefix match.
    // Allows the last word to not be fully typed.
    let last_word_option = page_search_request
        .query
        .trim()
        .split_ascii_whitespace()
        .last();

    let res = if let Some(last_word) = last_word_option {
        sqlx::query_as!(
            PageSearchResult,
            "
-- common table expression for the search term tsquery so that we don't have to repeat it many times
WITH cte as (
    -- Converts the search term to a phrase search with phraseto_tsquery but appends ':*' to the last word so that it
    -- becomes a prefix match. This way the search will also contain results when the last word in the search term
    -- is only partially typed. Note that if to_tsquery($4) decides to stem the word, the replacement will be skipped.
    SELECT ts_rewrite(
        phraseto_tsquery($2::regconfig, $3),
        to_tsquery($4),
        to_tsquery($4 || ':*')
    ) as query
)
SELECT id,
    ts_rank(
    content_search,
    (
        SELECT query
        from cte
    )
    ) as rank,
    ts_headline(
    $2::regconfig,
    title,
    (
        SELECT query
        from cte
    )
    ) as title_headline,
    ts_headline(
    $2::regconfig,
    content_search_original_text,
    (
        SELECT query
        from cte
    )
    ) as content_headline,
    url_path
FROM pages
WHERE course_id = $1
    AND deleted_at IS NULL
    AND content_search @@ (
    SELECT query
    from cte
    )
ORDER BY rank DESC
LIMIT 50;
        ",
            course_id,
            course.content_search_language as _,
            page_search_request.query,
            last_word
        )
        .fetch_all(conn)
        .await?
    } else {
        // If last word not found the search query is empty and we can return an empty vec
        Vec::new()
    };

    Ok(add_course_url_prefix_to_search_results(res, &course))
}

/**
Returns search results for the given words. The words can appear in the source document in any order.
*/
pub async fn get_page_search_results_for_words(
    conn: &mut PgConnection,
    course_id: Uuid,
    page_search_request: &PageSearchRequest,
) -> ModelResult<Vec<PageSearchResult>> {
    let course = crate::models::courses::get_course(&mut *conn, course_id).await?;

    // Last word of the search term needed so that the sql statement can change it to a prefix match.
    // Allows the last word to not be fully typed.
    let last_word_option = page_search_request
        .query
        .trim()
        .split_ascii_whitespace()
        .last();

    let res = if let Some(last_word) = last_word_option {
        sqlx::query_as!(
            PageSearchResult,
            "
-- common table expression for the search term tsquery so that we don't have to repeat it many times
WITH cte as (
    -- Converts the search term to a word search with ands between the words with plainto_tsquery but appends ':*' to the
    -- last word so that it  becomes a prefix match. This way the search will also contain results when the last word in
    -- the search term is only partially typed. Note that if to_tsquery($4) decides to stem the word, the replacement
    -- will be skipped.
    SELECT ts_rewrite(
        plainto_tsquery($2::regconfig, $3),
        to_tsquery($4),
        to_tsquery($4 || ':*')
    ) as query
)
SELECT id,
    ts_rank(
    content_search,
    (
        SELECT query
        from cte
    )
    ) as rank,
    ts_headline(
    $2::regconfig,
    title,
    (
        SELECT query
        from cte
    )
    ) as title_headline,
    ts_headline(
    $2::regconfig,
    content_search_original_text,
    (
        SELECT query
        from cte
    )
    ) as content_headline,
    url_path
FROM pages
WHERE course_id = $1
    AND deleted_at IS NULL
    AND content_search @@ (
    SELECT query
    from cte
    )
ORDER BY rank DESC
LIMIT 50;
        ",
            course_id,
            course.content_search_language as _,
            page_search_request.query,
            last_word
        )
        .fetch_all(conn)
        .await?
    } else {
        // If last word not found the search query is empty and we can return an empty vec
        Vec::new()
    };

    Ok(add_course_url_prefix_to_search_results(res, &course))
}

fn add_course_url_prefix_to_search_results(
    search_results: Vec<PageSearchResult>,
    course: &Course,
) -> Vec<PageSearchResult> {
    search_results
        .into_iter()
        .map(|mut sr| {
            let optional_slash = if sr.url_path.starts_with('/') {
                ""
            } else {
                "/"
            };
            sr.url_path = format!("/{}{}{}", course.slug, optional_slash, sr.url_path);
            sr
        })
        .collect()
}
