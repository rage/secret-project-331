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
    /// If set, use this link rather than the default one when registering course completions.
    pub completion_registration_link_override: Option<String>,
    pub ects_credits: Option<i32>,
}

impl CourseModule {
    pub fn new(id: Uuid, course_id: Uuid) -> Self {
        Self {
            id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            name: None,
            course_id,
            order_number: 0,
            copied_from: None,
            uh_course_code: None,
            automatic_completion: false,
            automatic_completion_number_of_exercises_attempted_treshold: None,
            automatic_completion_number_of_points_treshold: None,
            completion_registration_link_override: None,
            ects_credits: None,
        }
    }
    pub fn set_timestamps(
        mut self,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
        deleted_at: Option<DateTime<Utc>>,
    ) -> Self {
        self.created_at = created_at;
        self.updated_at = updated_at;
        self.deleted_at = deleted_at;
        self
    }

    /// order_number == 0 in and only if name == None
    pub fn set_name_and_order_number(mut self, name: Option<String>, order_number: i32) -> Self {
        self.name = name;
        self.order_number = order_number;
        self
    }

    pub fn set_completion_policy(
        mut self,
        automatic_completion_policy: &AutomaticCompletionPolicy,
    ) -> Self {
        let (automatic_completion, exercises_treshold, points_treshold) =
            automatic_completion_policy.to_database_fields();
        self.automatic_completion = automatic_completion;
        self.automatic_completion_number_of_exercises_attempted_treshold = exercises_treshold;
        self.automatic_completion_number_of_points_treshold = points_treshold;
        self
    }

    pub fn set_registration_info(
        mut self,
        uh_course_code: Option<String>,
        ects_credits: Option<i32>,
        completion_registration_link_override: Option<String>,
    ) -> Self {
        self.uh_course_code = uh_course_code;
        self.ects_credits = ects_credits;
        self.completion_registration_link_override = completion_registration_link_override;
        self
    }

    pub fn is_default_module(&self) -> bool {
        self.name.is_none()
    }
}

pub struct AutomaticCompletionRequirements {
    pub uh_course_code: Option<String>,
    pub automatic_completion: Option<bool>,
    pub automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    pub automatic_completion_number_of_points_treshold: Option<i32>,
    pub ects_credits: Option<i32>,
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
        order_number,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_with_automatic_completion(
    conn: &mut PgConnection,
    course_id: Uuid,
    name: Option<&str>,
    order_number: i32,
    completion_requirements: AutomaticCompletionRequirements,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModule,
        "
INSERT INTO course_modules (course_id, name, order_number, uh_course_code, ects_credits, automatic_completion, automatic_completion_number_of_exercises_attempted_treshold, automatic_completion_number_of_points_treshold)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
",
        course_id,
        name,
        order_number,
        completion_requirements.uh_course_code,
        completion_requirements.ects_credits,
        completion_requirements.automatic_completion,
        completion_requirements.automatic_completion_number_of_exercises_attempted_treshold,
        completion_requirements.automatic_completion_number_of_points_treshold,
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
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            format!(
                "Cannot remove module {id} because it has {} chapters associated with it",
                associated_chapters.len()
            ),
            None,
        ));
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

impl AutomaticCompletionPolicy {
    fn to_database_fields(&self) -> (bool, Option<i32>, Option<i32>) {
        match self {
            AutomaticCompletionPolicy::AutomaticCompletion(criteria) => (
                true,
                criteria.number_of_exercises_attempted_treshold,
                criteria.number_of_points_treshold,
            ),
            AutomaticCompletionPolicy::NoAutomaticCompletion => (false, None, None),
        }
    }
}

pub async fn update_automatic_completion_status(
    conn: &mut PgConnection,
    id: Uuid,
    automatic_completion_policy: &AutomaticCompletionPolicy,
) -> ModelResult<CourseModule> {
    let (automatic_completion, exercises_treshold, points_treshold) =
        automatic_completion_policy.to_database_fields();
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewModule {
    name: String,
    order_number: i32,
    chapters: Vec<Uuid>,
    uh_course_code: Option<String>,
    ects_credits: Option<i32>,
    automatic_completion: Option<bool>,
    automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    automatic_completion_number_of_points_treshold: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ModifiedModule {
    id: Uuid,
    name: Option<String>,
    order_number: i32,
    uh_course_code: Option<String>,
    ects_credits: Option<i32>,
    automatic_completion: Option<bool>,
    automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    automatic_completion_number_of_points_treshold: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ModuleUpdates {
    new_modules: Vec<NewModule>,
    deleted_modules: Vec<Uuid>,
    modified_modules: Vec<ModifiedModule>,
    moved_chapters: Vec<(Uuid, Uuid)>,
}

pub async fn update_with_order_number(
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
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    name: Option<&str>,
    order_number: i32,
    completion_requirements: AutomaticCompletionRequirements,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_modules
SET name = COALESCE($1, name),
  order_number = $2,
  uh_course_code = $4,
  ects_credits = $5,
  automatic_completion = $6,
  automatic_completion_number_of_exercises_attempted_treshold = $7,
  automatic_completion_number_of_points_treshold = $8
WHERE id = $3
",
        name,
        order_number,
        id,
        completion_requirements.uh_course_code,
        completion_requirements.ects_credits,
        completion_requirements.automatic_completion,
        completion_requirements.automatic_completion_number_of_exercises_attempted_treshold,
        completion_requirements.automatic_completion_number_of_points_treshold
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
        // do not scramble the default module, it should always be first
        .filter(|m| m.order_number != 0)
        .map(|m| m.id)
        .chain(updates.deleted_modules.iter().copied())
    {
        update_with_order_number(&mut tx, module_id, None, rand::random()).await?;
    }
    let mut modified_and_new_modules = updates.modified_modules;
    for new in updates.new_modules {
        // insert with a random order number to avoid conflicts
        let module = insert_with_automatic_completion(
            &mut tx,
            course_id,
            Some(&new.name),
            rand::random(),
            AutomaticCompletionRequirements {
                uh_course_code: new.uh_course_code,
                ects_credits: new.ects_credits,
                automatic_completion: new.automatic_completion,
                automatic_completion_number_of_exercises_attempted_treshold: new
                    .automatic_completion_number_of_exercises_attempted_treshold,
                automatic_completion_number_of_points_treshold: new
                    .automatic_completion_number_of_points_treshold,
            },
        )
        .await?;
        for chapter in new.chapters {
            chapters::set_module(&mut tx, chapter, module.id).await?;
        }
        //modify the order number with the rest
        modified_and_new_modules.push(ModifiedModule {
            id: module.id,
            name: None,
            order_number: new.order_number,
            uh_course_code: module.uh_course_code,
            ects_credits: new.ects_credits,
            automatic_completion: new.automatic_completion,
            automatic_completion_number_of_exercises_attempted_treshold: new
                .automatic_completion_number_of_exercises_attempted_treshold,
            automatic_completion_number_of_points_treshold: new
                .automatic_completion_number_of_points_treshold,
        })
    }
    // update modified and new modules
    for module in modified_and_new_modules {
        update(
            &mut tx,
            module.id,
            module.name.as_deref(),
            module.order_number,
            AutomaticCompletionRequirements {
                uh_course_code: module.uh_course_code,
                ects_credits: module.ects_credits,
                automatic_completion: module.automatic_completion,
                automatic_completion_number_of_exercises_attempted_treshold: module
                    .automatic_completion_number_of_exercises_attempted_treshold,
                automatic_completion_number_of_points_treshold: module
                    .automatic_completion_number_of_points_treshold,
            },
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
