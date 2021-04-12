use std::collections::HashMap;

use anyhow::Result;
use chrono::NaiveDateTime;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, FromRow, PgConnection, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Page {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    course_id: Uuid,
    content: serde_json::Value,
    url_path: String,
    title: String,
    deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageWithExercises {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    course_id: Uuid,
    content: serde_json::Value,
    url_path: String,
    title: String,
    deleted: bool,
    exercises: Vec<ExerciseWithExerciseItems>,
}

// Represents the subset of page fields that are required to create a new page.
#[derive(Debug, Serialize, Deserialize)]
pub struct NewPage {
    content: serde_json::Value,
    url_path: String,
    title: String,
    course_id: Uuid,
    exercises: Vec<PageUpdateExercise>,
}

// Represents the subset of page fields that the user is allowed to modify.
#[derive(Debug, Serialize, Deserialize)]
pub struct PageUpdate {
    content: serde_json::Value,
    url_path: String,
    title: String,
    exercises: Vec<PageUpdateExercise>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageUpdateExercise {
    // The id will be validated so that the client can't change it on us.
    id: Uuid,
    name: String,
    exercise_items: Vec<PageUpdateExerciseItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageUpdateExerciseItem {
    id: Uuid,
    exercise_type: String,
    assignment: serde_json::Value,
    spec: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageExerciseItem {
    exercise_type: String,
    assignment: serde_json::Value,
    spec: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
struct Exercise {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    course_id: Uuid,
    deleted: bool,
    name: String,
    deadline: Option<NaiveDateTime>,
    page_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
struct ExerciseWithExerciseItems {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    course_id: Uuid,
    deleted: bool,
    name: String,
    deadline: Option<NaiveDateTime>,
    page_id: Uuid,
    exercise_items: Vec<ExerciseItem>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
struct ExerciseItem {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    exercise_id: Uuid,
    exercise_type: String,
    assignment: Option<serde_json::Value>,
    deleted: bool,
    spec: Option<serde_json::Value>,
    spec_file_id: Option<Uuid>,
}

pub async fn course_pages(pool: &PgPool, course_id: Uuid) -> Result<Vec<Page>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let pages = sqlx::query_as!(
        Page,
        "SELECT * FROM pages WHERE course_id = $1 AND deleted = false;",
        course_id
    )
    .fetch_all(connection)
    .await?;
    return Ok(pages);
}

pub async fn get_page(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let pages = sqlx::query_as!(Page, "SELECT * FROM pages WHERE id = $1;", page_id)
        .fetch_one(connection)
        .await?;
    return Ok(pages);
}

pub async fn get_page_by_path(pool: &PgPool, course_id: Uuid, url_path: &str) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let page = sqlx::query_as!(
        Page,
        "SELECT * FROM pages WHERE course_id = $1 AND url_path = $2 AND deleted = false;",
        course_id,
        url_path
    )
    .fetch_one(connection)
    .await?;
    return Ok(page);
}

pub async fn get_page_with_exercises(pool: &PgPool, page_id: Uuid) -> Result<PageWithExercises> {
    let mut connection = pool.acquire().await?;

    let page = sqlx::query_as!(Page, "SELECT * FROM pages WHERE id = $1;", page_id)
        .fetch_one(&mut connection)
        .await?;

    let exercises: Vec<Exercise> = sqlx::query_as!(
        Exercise,
        "SELECT * FROM exercises WHERE page_id = $1;",
        page_id
    )
    .fetch_all(&mut connection)
    .await?;

    let exercise_items: Vec<ExerciseItem> = sqlx::query_as!(
        ExerciseItem,
        "SELECT * FROM exercise_items WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1);",
        page_id
    )
    .fetch_all(&mut connection)
    .await?;

    let mut exercise_items_by_exercise: HashMap<Uuid, Vec<ExerciseItem>> = exercise_items
        .into_iter()
        .into_group_map_by(|ei| ei.exercise_id);
    let page_with_exercises = PageWithExercises {
        id: page.id,
        created_at: page.created_at,
        updated_at: page.updated_at,
        content: page.content,
        course_id: page.course_id,
        deleted: page.deleted,
        title: page.title,
        url_path: page.url_path,
        exercises: exercises
            .into_iter()
            .map(|e| {
                let items = match exercise_items_by_exercise.remove(&e.id) {
                    Some(ei) => ei,
                    None => Vec::new(),
                };
                ExerciseWithExerciseItems {
                    id: e.id,
                    page_id: e.page_id,
                    created_at: e.created_at,
                    updated_at: e.updated_at,
                    course_id: e.course_id,
                    deadline: e.deadline,
                    name: e.name,
                    deleted: e.deleted,
                    exercise_items: items,
                }
            })
            .collect(),
    };
    return Ok(page_with_exercises);
}

// This has 3 stages: updating page, updating exercises, updating exercise items.
// This is currently implemented with multiple sql queries, but it could be optimized
// with data-modifying common table expressions if necessary.
pub async fn update_page(
    pool: &PgPool,
    page_id: Uuid,
    page_update: PageUpdate,
) -> Result<PageWithExercises> {
    let mut tx = pool.begin().await?;
    // Updating page
    let page = sqlx::query_as!(
        Page,
        r#"
UPDATE pages
SET
    content = $2,
    url_path = $3,
    title = $4
WHERE id = $1
RETURNING *
            "#,
        page_id,
        page_update.content,
        page_update.url_path.trim(),
        page_update.title.trim()
    )
    .fetch_one(&mut tx)
    .await?;

    let (result_exercises, new_content) =
        upsert_exercises_and_exercise_items(&page_update.exercises, &page, &mut tx).await?;

    tx.commit().await?;

    return Ok(PageWithExercises {
        content: new_content,
        course_id: page.course_id,
        created_at: page.created_at,
        updated_at: page.updated_at,
        deleted: page.deleted,
        id: page.id,
        title: page.title,
        url_path: page.url_path,
        exercises: result_exercises,
    });
}

/// Used by page inserts and page updates. The logic can be shared since the allowed inputs are the same.
async fn upsert_exercises_and_exercise_items(
    exercises: &Vec<PageUpdateExercise>,
    page: &Page,
    connection: &mut PgConnection,
) -> Result<(Vec<ExerciseWithExerciseItems>, serde_json::Value)> {
    // All related exercises and items should be deleted if not included in the update
    // We accomplish this by deleting everyting first in the transaction and then
    // undeleting the necessary items when doing the actual updates
    // We need existing exercise ids to check which ids are client generated and need to be replaced.
    sqlx::query!(
        r#"
        UPDATE exercises SET deleted = true WHERE page_id = $1
            "#,
        page.id
    )
    .execute(&mut *connection)
    .await?;

    sqlx::query!(
        r#"
        UPDATE exercise_items SET deleted = true WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1)
            "#,
        page.id
    )
    .execute(&mut *connection)
    .await?;

    // We need existing exercise ids to check which ids are client generated and need to be replaced.
    let existing_exercise_ids = sqlx::query!(
        r#"
    SELECT id from exercises WHERE page_id = $1
        "#,
        page.id
    )
    .fetch_all(&mut *connection)
    .await?;

    let existing_exercise_item_ids = sqlx::query!(
            r#"
    SELECT exercise_items.id from exercise_items JOIN exercises e ON (e.id = exercise_items.exercise_id) WHERE page_id = $1
        "#,
            page.id
        )
        .fetch_all(&mut *connection)
        .await?;
    // for returning the inserted values
    let mut result_exercises: Vec<ExerciseWithExerciseItems> = Vec::new();
    let mut changed_ids: HashMap<Uuid, Uuid> = HashMap::new();
    for exercise_update in exercises.iter() {
        let mut exercise_exercise_items: Vec<ExerciseItem> = Vec::new();
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
INSERT INTO exercises(id, course_id, name, page_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET course_id=$2, name=$3, page_id=$4, deleted=false
RETURNING *;
        "#,
            safe_for_db_exercise_id,
            page.course_id,
            exercise_update.name,
            page.id
        )
        .fetch_one(&mut *connection)
        .await?;
        for item_update in exercise_update.exercise_items.iter() {
            let safe_for_db_exercise_item_id = if existing_exercise_item_ids
                .iter()
                .any(|o| o.id == item_update.id)
            {
                item_update.id
            } else {
                // No need to add this to changed ids because exercise item ids
                // are not supposed to appear in the content json.
                Uuid::new_v4()
            };
            // Upsert
            let exercise_item: ExerciseItem = sqlx::query_as!(
                ExerciseItem,
                r#"
INSERT INTO exercise_items(id, exercise_id, exercise_type, assignment, spec)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET exercise_id=$2, exercise_type=$3, assignment=$4, spec=$5, deleted=false
RETURNING *;
        "#,
                safe_for_db_exercise_item_id,
                safe_for_db_exercise_id,
                item_update.exercise_type,
                item_update.assignment,
                item_update.spec
            )
            .fetch_one(&mut *connection)
            .await?;
            exercise_exercise_items.push(exercise_item);
        }
        result_exercises.push(ExerciseWithExerciseItems {
            course_id: exercise.course_id,
            created_at: exercise.created_at,
            updated_at: exercise.updated_at,
            deadline: exercise.deadline,
            deleted: exercise.deleted,
            id: exercise.id,
            name: exercise.name,
            page_id: exercise.page_id,
            exercise_items: exercise_exercise_items,
        })
    }

    // Now, we might have changed some of the exercise ids and need to do the same changes in the page content as well
    let new_content = update_ids_in_content(&page.content, changed_ids)?;
    sqlx::query!(
        r#"UPDATE pages SET content = $1 WHERE id = $2;"#,
        new_content,
        page.id
    )
    .execute(connection)
    .await?;
    return Ok((result_exercises, new_content));
}

fn update_ids_in_content(
    content: &serde_json::Value,
    chaged_ids: HashMap<Uuid, Uuid>,
) -> Result<serde_json::Value> {
    // naive implementation for now because the structure of the content was not decided at the time of writing this.
    // In the future we could only edit the necessary fields.
    let mut content_str = serde_json::to_string(content)?;
    for (k, v) in chaged_ids.into_iter() {
        content_str = content_str.replace(&k.to_string(), &v.to_string());
    }
    Ok(serde_json::from_str(&content_str)?)
}

pub async fn insert_page(pool: &PgPool, new_page: NewPage) -> Result<PageWithExercises> {
    let mut tx = pool.begin().await?;
    // For sharing the transaction between functions
    // let transaction_holder = RefCell::new(transaction);
    let page = sqlx::query_as!(
        Page,
        r#"
  INSERT INTO
    pages(course_id, content, url_path, title)
  VALUES($1, $2, $3, $4)
  RETURNING *
          "#,
        new_page.course_id,
        new_page.content,
        new_page.url_path.trim(),
        new_page.title.trim()
    )
    .fetch_one(&mut tx)
    .await?;

    let (result_exercises, new_content) =
        upsert_exercises_and_exercise_items(&new_page.exercises, &page, &mut tx).await?;
    tx.commit().await?;
    return Ok(PageWithExercises {
        content: new_content,
        course_id: page.course_id,
        created_at: page.created_at,
        updated_at: page.updated_at,
        deleted: page.deleted,
        id: page.id,
        title: page.title,
        url_path: page.url_path,
        exercises: result_exercises,
    });
}

pub async fn delete_page_and_exercises(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut trx = pool.begin().await?;
    let page = sqlx::query_as!(
        Page,
        r#"
  UPDATE pages
  SET
    deleted = true
  WHERE id = $1
  RETURNING *
          "#,
        page_id,
    )
    .fetch_one(&mut trx)
    .await?;

    sqlx::query!(
        r#"
  UPDATE exercises
  SET deleted = true
  WHERE page_id = $1
          "#,
        page_id,
    )
    .execute(&mut trx)
    .await?;

    sqlx::query!(
        r#"
  UPDATE exercise_items
  SET deleted = true
  WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1)
          "#,
        page_id,
    )
    .execute(&mut trx)
    .await?;

    trx.commit().await?;
    return Ok(page);
}
