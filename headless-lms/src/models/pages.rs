use std::cell::RefCell;

use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, FromRow, PgPool, Postgres, Transaction};
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

// This has 3 stages: updating page, updating exercises, updating exercise items.
// This is currently implemented with multiple sql queries, but it could be optimized
// with data-modifying common table expressions if necessary.
pub async fn update_page(
    pool: &PgPool,
    page_id: Uuid,
    page_update: PageUpdate,
) -> Result<PageWithExercises> {
    let transaction = pool.begin().await?;
    // For sharing the transaction between functions
    let transaction_holder = RefCell::new(transaction);
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
    .fetch_one(&mut *transaction_holder.borrow_mut())
    .await?;

    let result_exercises: Vec<ExerciseWithExerciseItems> =
        upsert_exercises_and_exercise_items(&page_update.exercises, &page, &transaction_holder)
            .await?;

    transaction_holder.into_inner().commit().await?;

    return Ok(PageWithExercises {
        content: page.content,
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
    transaction_holder: &RefCell<Transaction<'_, Postgres>>,
) -> Result<Vec<ExerciseWithExerciseItems>> {
    // We need existing exercise ids to check which ids are client generated and need to be replaced.
    let existing_exercise_ids = sqlx::query!(
        r#"
    SELECT id from exercises WHERE page_id = $1
        "#,
        page.id
    )
    .fetch_all(&mut *transaction_holder.borrow_mut())
    .await?;

    let existing_exercise_item_ids = sqlx::query!(
            r#"
    SELECT exercise_items.id from exercise_items JOIN exercises e ON (e.id = exercise_items.exercise_id) WHERE page_id = $1
        "#,
            page.id
        )
        .fetch_all(&mut *transaction_holder.borrow_mut())
        .await?;
    // for returning the inserted values
    let mut result_exercises: Vec<ExerciseWithExerciseItems> = Vec::new();
    for exercise_update in exercises.iter() {
        let mut exercise_exercise_items: Vec<ExerciseItem> = Vec::new();
        let safe_for_db_exercise_id = if existing_exercise_ids
            .iter()
            .any(|o| o.id == exercise_update.id)
        {
            exercise_update.id
        } else {
            Uuid::new_v4()
        };
        // Upsert
        let exercise: Exercise = sqlx::query_as!(
            Exercise,
            r#"
INSERT INTO exercises(id, course_id, name, page_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET course_id=$2, name=$3, page_id=$4
RETURNING *;
        "#,
            safe_for_db_exercise_id,
            page.course_id,
            exercise_update.name,
            page.id
        )
        .fetch_one(&mut *transaction_holder.borrow_mut())
        .await?;
        for item_update in exercise_update.exercise_items.iter() {
            let safe_for_db_exercise_item_id = if existing_exercise_item_ids
                .iter()
                .any(|o| o.id == item_update.id)
            {
                exercise_update.id
            } else {
                Uuid::new_v4()
            };
            // Upsert
            let exercise_item: ExerciseItem = sqlx::query_as!(
                ExerciseItem,
                r#"
INSERT INTO exercise_items(id, exercise_id, exercise_type, assignment, spec)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET exercise_id=$2, exercise_type=$3, assignment=$4, spec=$5
RETURNING *;
        "#,
                safe_for_db_exercise_item_id,
                safe_for_db_exercise_id,
                item_update.exercise_type,
                item_update.assignment,
                item_update.spec
            )
            .fetch_one(&mut *transaction_holder.borrow_mut())
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
    // TODO: handle delete
    return Ok(result_exercises);
}

pub async fn insert_page(pool: &PgPool, new_page: NewPage) -> Result<PageWithExercises> {
    let transaction = pool.begin().await?;
    // For sharing the transaction between functions
    let transaction_holder = RefCell::new(transaction);
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
    .fetch_one(&mut *transaction_holder.borrow_mut())
    .await?;

    let result_exercises: Vec<ExerciseWithExerciseItems> =
        upsert_exercises_and_exercise_items(&new_page.exercises, &page, &transaction_holder)
            .await?;
    transaction_holder.into_inner().commit().await?;
    return Ok(PageWithExercises {
        content: page.content,
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

pub async fn delete_page(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
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
    .fetch_one(connection)
    .await?;
    return Ok(page);
}
