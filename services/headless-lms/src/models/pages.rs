use std::collections::HashMap;

use crate::{
    models::chapters::Chapter,
    models::exercise_items::ExerciseItem,
    utils::document_schema_processor::{denormalize, normalize_from_json, NormalizedDocument},
};
use anyhow::Result;
use chrono::{DateTime, Utc};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, FromRow, PgConnection, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Page {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    course_id: Uuid,
    chapter_id: Option<Uuid>,
    url_path: String,
    title: String,
    deleted_at: Option<DateTime<Utc>>,
    content: serde_json::Value,
    order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct PageWithExercises {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    course_id: Uuid,
    chapter_id: Option<Uuid>,
    content: serde_json::Value,
    url_path: String,
    title: String,
    deleted_at: Option<DateTime<Utc>>,
    exercises: Vec<Exercise>,
}

// Represents the subset of page fields that are required to create a new page.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewPage {
    content: serde_json::Value,
    url_path: String,
    title: String,
    course_id: Uuid,
    chapter_id: Option<Uuid>,
    /// If set, set this page to be the front page of this course part.
    front_page_of_chapter_id: Option<Uuid>,
}

// Represents the subset of page fields that the user is allowed to modify.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct PageUpdate {
    content: serde_json::Value,
    url_path: String,
    title: String,
    chapter_id: Option<Uuid>,
    /// If set, set this page to be the front page of this course part.
    front_page_of_chapter_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct PageUpdateExercise {
    // The id will be validated so that the client can't change it on us.
    pub id: Uuid,
    pub name: String,
    pub exercise_items: Vec<PageUpdateExerciseItem>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct PageUpdateExerciseItem {
    pub id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct PageUpdateExerciseItemWithExerciseId {
    pub id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
    pub exercise_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct PageExerciseItem {
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NextPage {
    url_path: String,
    title: String,
    chapter_number: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
struct Exercise {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    course_id: Uuid,
    deleted_at: Option<DateTime<Utc>>,
    name: String,
    deadline: Option<DateTime<Utc>>,
    page_id: Uuid,
    score_maximum: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
struct ExerciseWithExerciseItems {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    course_id: Uuid,
    deleted_at: Option<DateTime<Utc>>,
    name: String,
    deadline: Option<DateTime<Utc>>,
    page_id: Uuid,
    exercise_items: Vec<ExerciseItem>,
    score_maximum: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
struct NextPageOrderNumber {
    order_number: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
struct NextChapterChapterNumber {
    chapter_number: Option<i32>,
}

pub async fn course_pages(pool: &PgPool, course_id: Uuid) -> Result<Vec<Page>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let pages = sqlx::query_as!(
        Page,
        "SELECT * FROM pages WHERE course_id = $1 AND deleted_at IS NULL;",
        course_id
    )
    .fetch_all(connection)
    .await?;
    Ok(pages)
}

pub async fn chapter_pages(pool: &PgPool, chapter_id: Uuid) -> Result<Vec<Page>> {
    let mut connection = pool.acquire().await?;
    let pages = sqlx::query_as!(
        Page,
        "SELECT * FROM pages WHERE chapter_id = $1 AND deleted_at IS NULL;",
        chapter_id
    )
    .fetch_all(&mut connection)
    .await?;
    Ok(pages)
}

pub async fn get_page(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let pages = sqlx::query_as!(Page, "SELECT * FROM pages WHERE id = $1;", page_id)
        .fetch_one(connection)
        .await?;
    Ok(pages)
}

pub async fn get_page_by_path(pool: &PgPool, course_slug: String, url_path: &str) -> Result<Page> {
    let mut connection = pool.acquire().await?;
    let page = sqlx::query_as!(
        Page,
        "SELECT pages.* FROM pages
        JOIN courses ON (pages.course_id = courses.id)
        WHERE courses.slug = $1
        AND url_path = $2
        AND courses.deleted_at IS NULL
        AND pages.deleted_at IS NULL;",
        course_slug,
        url_path
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(page)
}

pub async fn get_page_with_exercises(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut connection = pool.acquire().await?;

    let mut page = sqlx::query_as!(Page, "SELECT * FROM pages WHERE id = $1;", page_id)
        .fetch_one(&mut connection)
        .await?;

    let exercises: Vec<Exercise> = sqlx::query_as!(
        Exercise,
        "SELECT * FROM exercises WHERE page_id = $1;",
        page_id
    )
    .fetch_all(&mut connection)
    .await?;

    let exercise_items: Vec<PageUpdateExerciseItemWithExerciseId> = sqlx::query_as!(
        PageUpdateExerciseItemWithExerciseId,
        "SELECT id, exercise_type, assignment, public_spec, private_spec, exercise_id FROM exercise_items WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1);",
        page_id
    )
    .fetch_all(&mut connection)
    .await?;

    let mut exercise_items_by_exercise: HashMap<Uuid, Vec<PageUpdateExerciseItem>> = exercise_items
        .into_iter()
        .into_group_map_by(|ei| ei.exercise_id)
        .into_iter()
        .map(|(key, value)| {
            (
                key,
                value
                    .into_iter()
                    .map(|i| PageUpdateExerciseItem {
                        id: i.id,
                        exercise_type: i.exercise_type,
                        assignment: i.assignment,
                        public_spec: i.public_spec,
                        private_spec: i.private_spec,
                    })
                    .collect(),
            )
        })
        .collect();

    let exercises_with_items: Vec<PageUpdateExercise> = exercises
        .into_iter()
        .map(|e| {
            let items = match exercise_items_by_exercise.remove(&e.id) {
                Some(ei) => ei,
                None => Vec::new(),
            };
            PageUpdateExercise {
                id: e.id,
                name: e.name,
                exercise_items: items,
            }
        })
        .collect();
    // This is for cms so we need to put exercises back inside the content
    let normalized_document = NormalizedDocument {
        content: serde_json::from_value(page.content)?,
        exercises: exercises_with_items,
    };

    let denormalized_content = denormalize(normalized_document)?;
    let content_json = serde_json::to_value(denormalized_content)?;
    page.content = content_json;

    Ok(page)
}

// This has 3 stages: updating page, updating exercises, updating exercise items.
// This is currently implemented with multiple sql queries, but it could be optimized
// with data-modifying common table expressions if necessary.
pub async fn update_page(pool: &PgPool, page_id: Uuid, page_update: PageUpdate) -> Result<Page> {
    let normalized_document = normalize_from_json(page_update.content)?;
    let NormalizedDocument { content, exercises } = normalized_document;
    let content_as_json = serde_json::to_value(content)?;
    let mut tx = pool.begin().await?;
    // Updating page
    let page = sqlx::query_as!(
        Page,
        r#"
UPDATE pages
SET
    content = $2,
    url_path = $3,
    title = $4,
    chapter_id = $5
WHERE id = $1
RETURNING *
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
        upsert_exercises_and_exercise_items(&exercises, &page, &mut tx).await?;

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

    return Ok(Page {
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
    });
}

/// Used by page inserts and page updates. The logic can be shared since the allowed inputs are the same.
async fn upsert_exercises_and_exercise_items(
    exercises: &[PageUpdateExercise],
    page: &Page,
    connection: &mut PgConnection,
) -> Result<(Vec<PageUpdateExercise>, serde_json::Value)> {
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
    .execute(&mut *connection)
    .await?;

    sqlx::query!(
        r#"
        UPDATE exercise_items SET deleted_at = now() WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1)
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
    let mut result_exercises: Vec<PageUpdateExercise> = Vec::new();
    let mut changed_ids: HashMap<Uuid, Uuid> = HashMap::new();
    for exercise_update in exercises.iter() {
        let mut exercise_exercise_items: Vec<PageUpdateExerciseItem> = Vec::new();
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
SET course_id=$2, name=$3, page_id=$4, deleted_at=NULL
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
            let exercise_item: PageUpdateExerciseItem = sqlx::query_as!(
                PageUpdateExerciseItem,
                r#"
INSERT INTO exercise_items(id, exercise_id, exercise_type, assignment, public_spec, private_spec)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (id) DO UPDATE
SET exercise_id=$2, exercise_type=$3, assignment=$4, public_spec=$5, private_spec=$6, deleted_at=NULL
RETURNING id, exercise_type, assignment, public_spec, private_spec;
        "#,
                safe_for_db_exercise_item_id,
                safe_for_db_exercise_id,
                item_update.exercise_type,
                item_update.assignment,
                item_update.public_spec,
                item_update.private_spec,
            )
            .fetch_one(&mut *connection)
            .await?;
            exercise_exercise_items.push(exercise_item);
        }
        result_exercises.push(PageUpdateExercise {
            id: exercise.id,
            name: exercise.name,
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
    Ok((result_exercises, new_content))
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

pub async fn insert_page(pool: &PgPool, new_page: NewPage) -> Result<Page> {
    let normalized_document = normalize_from_json(new_page.content)?;
    let NormalizedDocument { content, exercises } = normalized_document;
    let content_as_json = serde_json::to_value(content.clone())?;
    let mut tx = pool.begin().await?;
    // For sharing the transaction between functions
    // let transaction_holder = RefCell::new(transaction);
    let page = sqlx::query_as!(
        Page,
        r#"
  INSERT INTO
    pages(course_id, content, url_path, title, chapter_id)
  VALUES($1, $2, $3, $4, $5)
  RETURNING *
          "#,
        new_page.course_id,
        content_as_json,
        new_page.url_path.trim(),
        new_page.title.trim(),
        new_page.chapter_id
    )
    .fetch_one(&mut tx)
    .await?;

    let (result_exercises, new_content) =
        upsert_exercises_and_exercise_items(&exercises, &page, &mut tx).await?;

    let denormalized_content = denormalize(NormalizedDocument {
        content: serde_json::from_value(new_content)?,
        exercises: result_exercises,
    })?;

    if let Some(front_page_of_chapter_id) = new_page.front_page_of_chapter_id {
        dbg!(&front_page_of_chapter_id);
        let _res = sqlx::query_as!(
            Chapter,
            r#"
UPDATE chapters SET front_page_id = $1 WHERE id = $2 RETURNING *
        "#,
            page.id,
            front_page_of_chapter_id
        )
        // this should fail if no rows returned
        .fetch_one(&mut tx)
        .await?;
    }

    tx.commit().await?;
    return Ok(Page {
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
    });
}

pub async fn delete_page_and_exercises(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut trx = pool.begin().await?;
    let page = sqlx::query_as!(
        Page,
        r#"
  UPDATE pages
  SET
    deleted_at = now()
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
  SET deleted_at = now()
  WHERE page_id = $1
          "#,
        page_id,
    )
    .execute(&mut trx)
    .await?;

    sqlx::query!(
        r#"
  UPDATE exercise_items
  SET deleted_at = now()
  WHERE exercise_id IN (SELECT id FROM exercises WHERE page_id = $1)
          "#,
        page_id,
    )
    .execute(&mut trx)
    .await?;

    trx.commit().await?;
    Ok(page)
}

pub async fn get_chapters_pages_with_exercises(
    pool: &PgPool,
    chapters_id: Uuid,
) -> Result<Vec<PageWithExercises>> {
    let mut connection = pool.acquire().await?;
    let chapter_pages = sqlx::query_as!(
        Page,
        r#"
SELECT *
FROM pages
WHERE chapter_id = $1
  AND deleted_at IS NULL
        "#,
        chapters_id
    )
    .fetch_all(&mut connection)
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
    .fetch_all(&mut connection)
    .await?;

    let mut page_to_exercises: HashMap<Uuid, Vec<Exercise>> = pages_exercises
        .into_iter()
        .into_group_map_by(|exercise| exercise.page_id);
    let chapter_pages_with_exercises = chapter_pages
        .into_iter()
        .map(|page| {
            let page_id = page.id;
            let exercises = match page_to_exercises.remove(&page_id) {
                Some(ex) => ex,
                None => Vec::new(),
            };
            PageWithExercises {
                id: page.id,
                created_at: page.created_at,
                updated_at: page.updated_at,
                course_id: page.course_id,
                chapter_id: page.chapter_id,
                content: page.content,
                url_path: page.url_path,
                title: page.title,
                deleted_at: page.deleted_at,
                exercises,
            }
        })
        .collect();
    Ok(chapter_pages_with_exercises)
}

pub async fn get_next_page(pool: &PgPool, pages_id: Uuid) -> Result<NextPage> {
    let next_order_number = get_next_page_order_number(pool, pages_id).await?;

    let next_page_data = match next_order_number.order_number {
        Some(order_number) => {
            get_next_page_with_next_order_number(pool, pages_id, order_number).await?
        }
        None => {
            let next_chapter_number = get_next_chapters_chapter_number(pool, pages_id).await?;
            let next_chapters_front_page = match next_chapter_number.chapter_number {
                Some(chapter_number) => get_next_chapters_front_page(pool, chapter_number).await?,
                None => panic!("No more pages :("),
            };
            next_chapters_front_page
        }
    };

    Ok(next_page_data)
}

async fn get_next_page_order_number(
    pool: &PgPool,
    current_page_id: Uuid,
) -> Result<NextPageOrderNumber> {
    let mut connection = pool.acquire().await?;

    let next_page_order_number = sqlx::query_as!(
        NextPageOrderNumber,
        "
select min(p1.order_number) as order_number
from pages p1
where p1.order_number > (
    select p.order_number
    from pages p
    where p.id = $1);
    ",
        current_page_id
    )
    .fetch_one(&mut connection)
    .await?;

    Ok(next_page_order_number)
}

async fn get_next_chapters_chapter_number(
    pool: &PgPool,
    current_page_id: Uuid,
) -> Result<NextChapterChapterNumber> {
    let mut connection = pool.acquire().await?;

    let next_chapter_number = sqlx::query_as!(
        NextChapterChapterNumber,
        "
select min(c.chapter_number) as chapter_number
from pages p
  left join chapters c on p.chapter_id = c.id
where c.chapter_number > (
    select c2.chapter_number
    from pages p
      left join chapters c2 on p.chapter_id = c2.id
    where p.id = $1
  )
  and c.course_id = (
    select p.course_id
    from pages p
    where p.id = $1
  );
    ",
        current_page_id
    )
    .fetch_one(&mut connection)
    .await?;

    Ok(next_chapter_number)
}

async fn get_next_page_with_next_order_number(
    pool: &PgPool,
    current_page_id: Uuid,
    next_order_number: i32,
) -> Result<NextPage> {
    let mut connection = pool.acquire().await?;

    let next_page = sqlx::query_as!(
        NextPage,
        "
select p.url_path,
  p.title,
  c.chapter_number
from pages p
  left join chapters c on p.chapter_id = c.id
where p.order_number = $1
  and p.chapter_id = (
    select p1.chapter_id
    from pages p1
    where p1.id = $2
  );
    ",
        next_order_number,
        current_page_id,
    )
    .fetch_one(&mut connection)
    .await?;

    Ok(next_page)
}

async fn get_next_chapters_front_page(pool: &PgPool, next_chapter_number: i32) -> Result<NextPage> {
    let mut connection = pool.acquire().await?;

    let next_chapters_front_page = sqlx::query_as!(
        NextPage,
        "
select p.url_path,
  p.title,
  c.chapter_number
from pages p
  left join chapters c on p.chapter_id = c.id
where c.chapter_number = $1
  and p.id = c.front_page_id;
        ",
        next_chapter_number,
    )
    .fetch_one(&mut connection)
    .await?;

    Ok(next_chapters_front_page)
}
