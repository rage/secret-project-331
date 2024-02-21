use std::collections::HashMap;

use crate::{chapters, prelude::*};

/// Matches the columns in the database.
struct CourseModulesSchema {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
    name: Option<String>,
    course_id: Uuid,
    order_number: i32,
    copied_from: Option<Uuid>,
    uh_course_code: Option<String>,
    automatic_completion: bool,
    automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    automatic_completion_number_of_points_treshold: Option<i32>,
    automatic_completion_requires_exam: bool,
    completion_registration_link_override: Option<String>,
    ects_credits: Option<f32>,
    enable_registering_completion_to_uh_open_university: bool,
    certification_enabled: bool,
}
/**
 * Based on [CourseModulesSchema] but completion_policy parsed and addded (and some not needeed fields removed).
 */
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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
    pub completion_policy: CompletionPolicy,
    /// If set, use this link rather than the default one when registering course completions.
    pub completion_registration_link_override: Option<String>,
    pub ects_credits: Option<f32>,
    pub enable_registering_completion_to_uh_open_university: bool,
    pub certification_enabled: bool,
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
            completion_policy: CompletionPolicy::Manual,
            completion_registration_link_override: None,
            ects_credits: None,
            enable_registering_completion_to_uh_open_university: false,
            certification_enabled: false,
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

    pub fn set_completion_policy(mut self, completion_policy: CompletionPolicy) -> Self {
        self.completion_policy = completion_policy;
        self
    }

    pub fn set_registration_info(
        mut self,
        uh_course_code: Option<String>,
        ects_credits: Option<f32>,
        completion_registration_link_override: Option<String>,
        enable_registering_completion_to_uh_open_university: bool,
    ) -> Self {
        self.uh_course_code = uh_course_code;
        self.ects_credits = ects_credits;
        self.completion_registration_link_override = completion_registration_link_override;
        self.enable_registering_completion_to_uh_open_university =
            enable_registering_completion_to_uh_open_university;
        self
    }

    pub fn set_certification_enabled(mut self, certification_enabled: bool) -> Self {
        self.certification_enabled = certification_enabled;
        self
    }

    pub fn is_default_module(&self) -> bool {
        self.name.is_none()
    }
}

impl From<CourseModulesSchema> for CourseModule {
    fn from(schema: CourseModulesSchema) -> Self {
        let completion_policy = if schema.automatic_completion {
            CompletionPolicy::Automatic(AutomaticCompletionRequirements {
                course_module_id: schema.id,
                number_of_exercises_attempted_treshold: schema
                    .automatic_completion_number_of_exercises_attempted_treshold,
                number_of_points_treshold: schema.automatic_completion_number_of_points_treshold,
                requires_exam: schema.automatic_completion_requires_exam,
            })
        } else {
            CompletionPolicy::Manual
        };
        Self {
            id: schema.id,
            created_at: schema.created_at,
            updated_at: schema.updated_at,
            deleted_at: schema.deleted_at,
            name: schema.name,
            course_id: schema.course_id,
            order_number: schema.order_number,
            copied_from: schema.copied_from,
            uh_course_code: schema.uh_course_code,
            completion_policy,
            completion_registration_link_override: schema.completion_registration_link_override,
            ects_credits: schema.ects_credits,
            enable_registering_completion_to_uh_open_university: schema
                .enable_registering_completion_to_uh_open_university,
            certification_enabled: schema.certification_enabled,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewCourseModule {
    completion_policy: CompletionPolicy,
    completion_registration_link_override: Option<String>,
    course_id: Uuid,
    ects_credits: Option<f32>,
    name: Option<String>,
    order_number: i32,
    uh_course_code: Option<String>,
    enable_registering_completion_to_uh_open_university: bool,
}

impl NewCourseModule {
    pub fn new(course_id: Uuid, name: Option<String>, order_number: i32) -> Self {
        Self {
            completion_policy: CompletionPolicy::Manual,
            completion_registration_link_override: None,
            course_id,
            ects_credits: None,
            name,
            order_number,
            uh_course_code: None,
            enable_registering_completion_to_uh_open_university: false,
        }
    }

    pub fn new_course_default(course_id: Uuid) -> Self {
        Self::new(course_id, None, 0)
    }

    pub fn set_uh_course_code(mut self, uh_course_code: Option<String>) -> Self {
        self.uh_course_code = uh_course_code;
        self
    }

    pub fn set_completion_policy(mut self, completion_policy: CompletionPolicy) -> Self {
        self.completion_policy = completion_policy;
        self
    }

    pub fn set_completion_registration_link_override(
        mut self,
        completion_registration_link_override: Option<String>,
    ) -> Self {
        self.completion_registration_link_override = completion_registration_link_override;
        self
    }

    pub fn set_ects_credits(mut self, ects_credits: Option<f32>) -> Self {
        self.ects_credits = ects_credits;
        self
    }

    pub fn set_enable_registering_completion_to_uh_open_university(
        mut self,
        enable_registering_completion_to_uh_open_university: bool,
    ) -> Self {
        self.enable_registering_completion_to_uh_open_university =
            enable_registering_completion_to_uh_open_university;
        self
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_course_module: &NewCourseModule,
) -> ModelResult<CourseModule> {
    let (automatic_completion, exercises_treshold, points_treshold, requires_exam) =
        new_course_module.completion_policy.to_database_fields();
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
INSERT INTO course_modules (
    id,
    course_id,
    name,
    order_number,
    automatic_completion,
    automatic_completion_number_of_exercises_attempted_treshold,
    automatic_completion_number_of_points_treshold,
    automatic_completion_requires_exam,
    ects_credits,
    enable_registering_completion_to_uh_open_university
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
        ",
        pkey_policy.into_uuid(),
        new_course_module.course_id,
        new_course_module.name,
        new_course_module.order_number,
        automatic_completion,
        exercises_treshold,
        points_treshold,
        requires_exam,
        new_course_module.ects_credits,
        new_course_module.enable_registering_completion_to_uh_open_university
    )
    .fetch_one(conn)
    .await?;
    Ok(res.into())
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
        CourseModulesSchema,
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
    Ok(res.into())
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModule>> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT *
FROM course_modules
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id
    )
    .map(|x| x.into())
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Gets course module where the given exercise belongs to. This will result in an error in the case
/// of an exam exercise.
pub async fn get_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT course_modules.*
FROM exercises
  LEFT JOIN chapters ON (exercises.chapter_id = chapters.id)
  LEFT JOIN course_modules ON (chapters.course_module_id = course_modules.id)
WHERE exercises.id = $1
AND chapters.deleted_at IS NULL
AND course_modules.deleted_at IS NULL
        ",
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.into())
}

pub async fn get_course_module_id_by_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<Uuid> {
    let res: Uuid = sqlx::query!(
        r#"
SELECT c.course_module_id
from chapters c
where c.id = $1
  AND deleted_at IS NULL
  "#,
        chapter_id
    )
    .map(|record| record.course_module_id)
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_default_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT *
FROM course_modules
WHERE course_id = $1
  AND name IS NULL
  AND deleted_at IS NULL
        ",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.into())
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

pub async fn get_all_uh_course_codes_for_open_university(
    conn: &mut PgConnection,
) -> ModelResult<Vec<String>> {
    let res = sqlx::query!(
        "
SELECT DISTINCT uh_course_code
FROM course_modules
WHERE uh_course_code IS NOT NULL
  AND enable_registering_completion_to_uh_open_university = true
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AutomaticCompletionRequirements {
    /// Course module associated with these requirements.
    pub course_module_id: Uuid,
    pub number_of_exercises_attempted_treshold: Option<i32>,
    pub number_of_points_treshold: Option<i32>,
    pub requires_exam: bool,
}

impl AutomaticCompletionRequirements {
    /// Shorthand for checking whether the given exercise related values pass their respective
    /// tresholds.
    pub fn passes_exercise_tresholds(
        &self,
        exercises_attempted: i32,
        exercise_points: i32,
    ) -> bool {
        self.passes_number_of_exercises_attempted_treshold(exercises_attempted)
            && self.passes_number_of_exercise_points_treshold(exercise_points)
    }

    /// Whether the given number is higher than the exercises attempted treshold. Always returns
    /// true if there is no treshold.
    pub fn passes_number_of_exercises_attempted_treshold(&self, exercises_attempted: i32) -> bool {
        self.number_of_exercises_attempted_treshold
            .map(|x| x <= exercises_attempted)
            .unwrap_or(true)
    }

    /// Whether the given number is higher than the exercise points treshold. Always returns true
    /// if there is no treshold.
    pub fn passes_number_of_exercise_points_treshold(&self, exercise_points: i32) -> bool {
        self.number_of_points_treshold
            .map(|x| x <= exercise_points)
            .unwrap_or(true)
    }
}

#[derive(Debug, PartialEq, Clone, Serialize, Deserialize)]
#[serde(tag = "policy", rename_all = "kebab-case")]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum CompletionPolicy {
    Automatic(AutomaticCompletionRequirements),
    Manual,
}

impl CompletionPolicy {
    /// Returns associated data for `Automatic` variant, if matches.
    pub fn automatic(&self) -> Option<&AutomaticCompletionRequirements> {
        match self {
            CompletionPolicy::Automatic(requirements) => Some(requirements),
            CompletionPolicy::Manual => None,
        }
    }

    fn to_database_fields(&self) -> (bool, Option<i32>, Option<i32>, bool) {
        match self {
            CompletionPolicy::Automatic(requirements) => (
                true,
                requirements.number_of_exercises_attempted_treshold,
                requirements.number_of_points_treshold,
                requirements.requires_exam,
            ),
            CompletionPolicy::Manual => (false, None, None, false),
        }
    }
}

pub async fn update_automatic_completion_status(
    conn: &mut PgConnection,
    id: Uuid,
    automatic_completion_policy: &CompletionPolicy,
) -> ModelResult<CourseModule> {
    let (automatic_completion, exercises_treshold, points_treshold, requires_exam) =
        automatic_completion_policy.to_database_fields();
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
UPDATE course_modules
SET automatic_completion = $1,
  automatic_completion_number_of_exercises_attempted_treshold = $2,
  automatic_completion_number_of_points_treshold = $3,
  automatic_completion_requires_exam = $4
WHERE id = $5
  AND deleted_at IS NULL
RETURNING *
        ",
        automatic_completion,
        exercises_treshold,
        points_treshold,
        requires_exam,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.into())
}

pub async fn update_uh_course_code(
    conn: &mut PgConnection,
    id: Uuid,
    uh_course_code: Option<String>,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
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
    Ok(res.into())
}

pub async fn update_enable_registering_completion_to_uh_open_university(
    conn: &mut PgConnection,
    id: Uuid,
    enable_registering_completion_to_uh_open_university: bool,
) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
UPDATE course_modules
SET enable_registering_completion_to_uh_open_university = $1
WHERE id = $2
  AND deleted_at IS NULL
RETURNING *
        ",
        enable_registering_completion_to_uh_open_university,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.into())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewModule {
    name: String,
    order_number: i32,
    chapters: Vec<Uuid>,
    uh_course_code: Option<String>,
    ects_credits: Option<f32>,
    completion_policy: CompletionPolicy,
    completion_registration_link_override: Option<String>,
    enable_registering_completion_to_uh_open_university: bool,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ModifiedModule {
    id: Uuid,
    name: Option<String>,
    order_number: i32,
    uh_course_code: Option<String>,
    ects_credits: Option<f32>,
    completion_policy: CompletionPolicy,
    completion_registration_link_override: Option<String>,
    enable_registering_completion_to_uh_open_university: bool,
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
    updated_course_module: &NewCourseModule,
) -> ModelResult<()> {
    // destructure so new fields cause a compilation error here
    let NewCourseModule {
        completion_policy: _,
        course_id: _,
        ects_credits,
        order_number,
        name,
        uh_course_code,
        completion_registration_link_override,
        enable_registering_completion_to_uh_open_university,
    } = updated_course_module;
    let (automatic_completion, exercises_treshold, points_treshold, requires_exam) =
        updated_course_module.completion_policy.to_database_fields();
    sqlx::query!(
        "
UPDATE course_modules
SET name = COALESCE($2, name),
  order_number = $3,
  uh_course_code = $4,
  ects_credits = $5,
  automatic_completion = $6,
  automatic_completion_number_of_exercises_attempted_treshold = $7,
  automatic_completion_number_of_points_treshold = $8,
  automatic_completion_requires_exam = $9,
  completion_registration_link_override = $10,
  enable_registering_completion_to_uh_open_university = $11
WHERE id = $1
        ",
        id,
        name.as_ref(),
        order_number,
        uh_course_code.as_ref(),
        ects_credits.as_ref(),
        automatic_completion,
        exercises_treshold,
        points_treshold,
        requires_exam,
        completion_registration_link_override.as_ref(),
        enable_registering_completion_to_uh_open_university
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
        // destructure so new fields cause a compilation error here
        let NewModule {
            name,
            order_number,
            chapters,
            uh_course_code,
            ects_credits,
            completion_policy,
            completion_registration_link_override,
            enable_registering_completion_to_uh_open_university,
        } = new;
        // insert with a random order number to avoid conflicts
        let new_course_module = NewCourseModule::new(course_id, Some(name.clone()), rand::random())
            .set_completion_policy(completion_policy.clone())
            .set_completion_registration_link_override(completion_registration_link_override)
            .set_ects_credits(ects_credits)
            .set_uh_course_code(uh_course_code)
            .set_enable_registering_completion_to_uh_open_university(
                enable_registering_completion_to_uh_open_university,
            );
        let module = insert(&mut tx, PKeyPolicy::Generate, &new_course_module).await?;
        for chapter in chapters {
            chapters::set_module(&mut tx, chapter, module.id).await?;
        }
        //modify the order number with the rest
        modified_and_new_modules.push(ModifiedModule {
            id: module.id,
            name: None,
            order_number,
            uh_course_code: module.uh_course_code,
            ects_credits,
            completion_policy,
            completion_registration_link_override: module.completion_registration_link_override,
            enable_registering_completion_to_uh_open_university: module
                .enable_registering_completion_to_uh_open_university,
        })
    }
    // update modified and new modules
    for module in modified_and_new_modules {
        // destructure so new fields cause a compilation error here
        let ModifiedModule {
            id,
            name,
            order_number,
            uh_course_code,
            ects_credits,
            completion_policy,
            completion_registration_link_override,
            enable_registering_completion_to_uh_open_university,
        } = module;
        update(
            &mut tx,
            id,
            &NewCourseModule::new(course_id, name.clone(), order_number)
                .set_completion_policy(completion_policy)
                .set_completion_registration_link_override(completion_registration_link_override)
                .set_ects_credits(ects_credits)
                .set_uh_course_code(uh_course_code)
                .set_enable_registering_completion_to_uh_open_university(
                    enable_registering_completion_to_uh_open_university,
                ),
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

pub async fn update_certification_enabled(
    conn: &mut PgConnection,
    id: Uuid,
    enabled: bool,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_modules
SET certification_enabled = $1
WHERE id = $2
",
        enabled,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {

    mod automatic_completion_requirements {
        use uuid::Uuid;

        use super::super::AutomaticCompletionRequirements;

        #[test]
        fn passes_exercise_tresholds() {
            let requirements1 = AutomaticCompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(10),
                number_of_points_treshold: Some(50),
                requires_exam: false,
            };
            let requirements2 = AutomaticCompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(50),
                number_of_points_treshold: Some(10),
                requires_exam: false,
            };

            let requirements3 = AutomaticCompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(0),
                number_of_points_treshold: Some(0),
                requires_exam: false,
            };

            let requirements4 = AutomaticCompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(10),
                number_of_points_treshold: None,
                requires_exam: false,
            };

            let requirements5 = AutomaticCompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: None,
                number_of_points_treshold: Some(10),
                requires_exam: false,
            };
            assert!(requirements1.passes_exercise_tresholds(10, 50));
            assert!(requirements2.passes_exercise_tresholds(50, 10));

            assert!(!requirements1.passes_exercise_tresholds(50, 10));
            assert!(!requirements2.passes_exercise_tresholds(10, 50));

            assert!(!requirements1.passes_exercise_tresholds(100, 0));
            assert!(!requirements2.passes_exercise_tresholds(100, 0));

            assert!(requirements3.passes_exercise_tresholds(1, 1));
            assert!(requirements3.passes_exercise_tresholds(0, 0));

            assert!(requirements4.passes_exercise_tresholds(10, 1));
            assert!(!requirements4.passes_exercise_tresholds(1, 10));

            assert!(requirements5.passes_exercise_tresholds(0, 10));
            assert!(!requirements5.passes_exercise_tresholds(10, 0));
        }
    }
}
