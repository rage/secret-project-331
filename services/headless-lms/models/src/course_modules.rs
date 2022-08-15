use std::collections::HashMap;

use crate::{chapters, prelude::*};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModule {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: Option<String>,
    pub course_id: Uuid,
    pub order_number: i32,
    pub copied_from: Option<Uuid>,
    pub uh_course_code: Option<String>,
    pub automatic_completion: bool,
    pub automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    pub automatic_completion_number_of_points_treshold: Option<i32>,
    pub ects_credits: Option<i32>,
}

pub struct CompletionRequirementUpdate {
    uh_course_code: String,
    ects_credits: Option<i32>,
    automatic_completion: bool,
    automatic_completion_points_treshold: Option<i32>,
    automatic_completion_exercises_attempted_treshold: Option<i32>,
}

impl CourseModule {
    pub fn is_default_module(&self) -> bool {
        self.name.is_none()
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    name: Option<&str>,
    order_number: i32,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModule,
        "
INSERT INTO course_modules (course_id, name, order_number)
VALUES ($1, $2, $3)
RETURNING *
",
        course_id,
        name,
        order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_default_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseModule> {
    insert(conn, course_id, None, 0).await
}

pub async fn rename(conn: &mut PgConnection, id: Uuid, name: &str) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_modules
SET name = $1
WHERE id = $2
",
        name,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    let associated_chapters = chapters::get_for_module(conn, id).await?;
    if !associated_chapters.is_empty() {
        return Err(ModelError::InvalidRequest(format!(
            "Cannot remove module {id} because it has {} chapters associated with it",
            associated_chapters.len()
        )));
    }
    sqlx::query!(
        "
UPDATE course_modules
SET deleted_at = now()
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModule,
        "
SELECT *
FROM course_modules
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModule>> {
    let modules = sqlx::query_as!(
        CourseModule,
        "
SELECT *
FROM course_modules
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(modules)
}

/// Gets course module where the given exercise belongs to. This will result in an error in the case
/// of an exam exercise.
pub async fn get_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModule,
        "
SELECT course_modules.*
FROM exercises
  LEFT JOIN chapters ON (exercises.chapter_id = chapters.id)
  LEFT JOIN course_modules ON (chapters.course_module_id = course_modules.id)
WHERE exercises.id = $1
        ",
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_default_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModule,
        "
SELECT *
FROM course_modules
WHERE course_id = $1
  AND name IS NULL
  AND order_number = 0
  AND deleted_at IS NULL
        ",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Gets all course modules with a matching `uh_course_code` or course `slug`.
///
/// In the latter case only one record at most is returned, but there is no way to distinguish between
/// these two scenarios in advance.
pub async fn get_ids_by_course_slug_or_uh_course_code(
    conn: &mut PgConnection,
    course_slug_or_code: &str,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT course_modules.id
FROM course_modules
  LEFT JOIN courses ON (course_modules.course_id = courses.id)
WHERE (
    course_modules.uh_course_code = $1
    OR courses.slug = $1
  )
  AND course_modules.deleted_at IS NULL
        ",
        course_slug_or_code,
    )
    .map(|record| record.id)
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Gets course modules for the given course as a map, indexed by the `id` field.
pub async fn get_by_course_id_as_map(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<HashMap<Uuid, CourseModule>> {
    let res = get_by_course_id(conn, course_id)
        .await?
        .into_iter()
        .map(|course_module| (course_module.id, course_module))
        .collect();
    Ok(res)
}

pub async fn get_all_uh_course_codes(conn: &mut PgConnection) -> ModelResult<Vec<String>> {
    let res = sqlx::query!(
        "
SELECT DISTINCT uh_course_code
FROM course_modules
WHERE uh_course_code IS NOT NULL
  AND deleted_at IS NULL
"
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .filter_map(|x| x.uh_course_code)
    .collect();
    Ok(res)
}

pub struct AutomaticCompletionCriteria {
    pub number_of_exercises_attempted_treshold: Option<i32>,
    pub number_of_points_treshold: Option<i32>,
}

pub enum AutomaticCompletionPolicy {
    AutomaticCompletion(AutomaticCompletionCriteria),
    NoAutomaticCompletion,
}

pub async fn update_automatic_completion_status(
    conn: &mut PgConnection,
    id: Uuid,
    automatic_completion_policy: &AutomaticCompletionPolicy,
) -> ModelResult<CourseModule> {
    let (automatic_completion, exercises_treshold, points_treshold) =
        match automatic_completion_policy {
            AutomaticCompletionPolicy::AutomaticCompletion(criteria) => (
                true,
                criteria.number_of_exercises_attempted_treshold,
                criteria.number_of_points_treshold,
            ),
            AutomaticCompletionPolicy::NoAutomaticCompletion => (false, None, None),
        };
    let res = sqlx::query_as!(
        CourseModule,
        "
UPDATE course_modules
SET automatic_completion = $1,
  automatic_completion_number_of_exercises_attempted_treshold = $2,
  automatic_completion_number_of_points_treshold = $3
WHERE id = $4
  AND deleted_at IS NULL
RETURNING *
        ",
        automatic_completion,
        exercises_treshold,
        points_treshold,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_completion_requirement(
    conn: &mut PgConnection,
    uh_course_code: Uuid,
    payload: CompletionRequirementUpdate,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModule,
        r#"
    UPDATE course_modules
    SET ects_credits = $2,
        automatic_completion = $3,
        automatic_completion_number_of_exercises_attempted_treshold = $4,
        automatic_completion_number_of_points_treshold = $5
    WHERE uh_course_code = $1
    AND deleted_at IS NULL
    "#,
        payload.uh_course_code,
        payload.ects_credits,
        payload.automatic_completion,
        payload.automatic_completion_points_treshold,
        payload.automatic_completion_exercises_attempted_treshold
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_uh_course_code(
    conn: &mut PgConnection,
    id: Uuid,
    uh_course_code: Option<String>,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModule,
        "
UPDATE course_modules
SET uh_course_code = $1
WHERE id = $2
  AND deleted_at IS NULL
RETURNING *
        ",
        uh_course_code,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewModule {
    name: String,
    order_number: i32,
    chapters: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ModifiedModule {
    id: Uuid,
    name: Option<String>,
    order_number: i32,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ModuleUpdates {
    new_modules: Vec<NewModule>,
    deleted_modules: Vec<Uuid>,
    modified_modules: Vec<ModifiedModule>,
    moved_chapters: Vec<(Uuid, Uuid)>,
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    name: Option<&str>,
    order_number: i32,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_modules
SET name = COALESCE($1, name),
  order_number = $2
WHERE id = $3
",
        name,
        order_number,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_modules(
    conn: &mut PgConnection,
    course_id: Uuid,
    updates: ModuleUpdates,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;

    // scramble order of modified and deleted modules
    for module_id in updates
        .modified_modules
        .iter()
        .map(|m| m.id)
        .chain(updates.deleted_modules.iter().copied())
    {
        update(&mut tx, module_id, None, rand::random()).await?;
    }
    let mut modified_and_new_modules = updates.modified_modules;
    for new in updates.new_modules {
        // insert with a random order number to avoid conflicts
        let module = insert(&mut tx, course_id, Some(&new.name), rand::random()).await?;
        for chapter in new.chapters {
            chapters::set_module(&mut tx, chapter, module.id).await?;
        }
        // modify the order number with the rest
        modified_and_new_modules.push(ModifiedModule {
            id: module.id,
            name: None,
            order_number: new.order_number,
        })
    }
    // update modified and new modules
    for module in modified_and_new_modules {
        update(
            &mut tx,
            module.id,
            module.name.as_deref(),
            module.order_number,
        )
        .await?;
    }
    for (chapter, module) in updates.moved_chapters {
        chapters::set_module(&mut tx, chapter, module).await?;
    }
    for deleted in updates.deleted_modules {
        delete(&mut tx, deleted).await?;
    }

    tx.commit().await?;
    Ok(())
}
