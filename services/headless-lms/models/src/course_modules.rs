use std::collections::HashMap;

use itertools::multiunzip;
use utoipa::ToSchema;

use crate::{
    chapters,
    entity_history::{self, HistoryAuthor},
    error::missing_model_error,
    library::entity_snapshots::ModuleSnapshot,
    library::entity_snapshots::{ContentEntityType, EntityKey},
    prelude::*,
};

/// The subset of `course_modules` columns [`CourseModule`] is built from; the credit-registration
/// ones are read through [`CourseModuleCreditRegistrationConfig`], hence no `SELECT *` here.
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
    completion_method: CompletionMethod,
    automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    automatic_completion_number_of_points_treshold: Option<i32>,
    exam_requirement: ExamRequirement,
    exam_location_description: Option<String>,
    completion_registration_link_override: Option<String>,
    ects_credits: Option<f32>,
    certification_enabled: bool,
    credit_registration_route: CreditRegistrationRoute,
}
/// Like [CourseModulesSchema], but the completion method and its thresholds are collapsed into
/// `completion_policy`.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
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
    pub exam_requirement: ExamRequirement,
    /// Where the exam is held, when `exam_requirement` is [`ExamRequirement::Elsewhere`].
    pub exam_location_description: Option<String>,
    /// If set, use this link rather than the default one when registering course completions.
    pub completion_registration_link_override: Option<String>,
    pub ects_credits: Option<f32>,
    pub certification_enabled: bool,
    pub credit_registration_route: CreditRegistrationRoute,
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
            completion_policy: CompletionPolicy::NotDecided,
            exam_requirement: ExamRequirement::None,
            exam_location_description: None,
            completion_registration_link_override: None,
            ects_credits: None,
            certification_enabled: false,
            credit_registration_route: CreditRegistrationRoute::Platform,
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
    ) -> Self {
        self.uh_course_code = uh_course_code;
        self.ects_credits = ects_credits;
        self.completion_registration_link_override = completion_registration_link_override;
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
        let requirements = CompletionRequirements {
            course_module_id: schema.id,
            number_of_exercises_attempted_treshold: schema
                .automatic_completion_number_of_exercises_attempted_treshold,
            number_of_points_treshold: schema.automatic_completion_number_of_points_treshold,
        };
        let completion_policy = match schema.completion_method {
            CompletionMethod::NotDecided => CompletionPolicy::NotDecided,
            CompletionMethod::ByRequirements => CompletionPolicy::ByRequirements(requirements),
            CompletionMethod::ByExam => CompletionPolicy::ByExam(requirements),
            CompletionMethod::TeacherAdds => CompletionPolicy::TeacherAdds,
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
            exam_requirement: schema.exam_requirement,
            exam_location_description: schema.exam_location_description,
            completion_registration_link_override: schema.completion_registration_link_override,
            ects_credits: schema.ects_credits,
            certification_enabled: schema.certification_enabled,
            credit_registration_route: schema.credit_registration_route,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct NewCourseModule {
    completion_policy: CompletionPolicy,
    exam_requirement: ExamRequirement,
    exam_location_description: Option<String>,
    completion_registration_link_override: Option<String>,
    course_id: Uuid,
    ects_credits: Option<f32>,
    name: Option<String>,
    order_number: i32,
    uh_course_code: Option<String>,
    credit_registration_route: CreditRegistrationRoute,
}

impl NewCourseModule {
    pub fn new(course_id: Uuid, name: Option<String>, order_number: i32) -> Self {
        Self {
            completion_policy: CompletionPolicy::NotDecided,
            exam_requirement: ExamRequirement::None,
            exam_location_description: None,
            completion_registration_link_override: None,
            course_id,
            ects_credits: None,
            name,
            order_number,
            uh_course_code: None,
            credit_registration_route: CreditRegistrationRoute::Platform,
        }
    }

    pub fn new_course_default(course_id: Uuid) -> Self {
        Self::new(course_id, None, 0)
    }

    /// The module this creates, as a snapshot under `id`.
    pub(crate) fn into_snapshot(self, id: Uuid) -> ModuleSnapshot {
        ModuleSnapshot {
            id,
            course_id: self.course_id,
            name: self.name,
            order_number: self.order_number,
            completion_policy: self.completion_policy,
            exam_requirement: self.exam_requirement,
            exam_location_description: self.exam_location_description,
            certification_enabled: false,
            uh_course_code: self.uh_course_code,
            ects_credits: self.ects_credits,
            completion_registration_link_override: self.completion_registration_link_override,
            credit_registration_route: self.credit_registration_route,
        }
    }

    pub fn set_uh_course_code(mut self, uh_course_code: Option<String>) -> Self {
        self.uh_course_code = uh_course_code;
        self
    }

    pub fn set_credit_registration_route(
        mut self,
        credit_registration_route: CreditRegistrationRoute,
    ) -> Self {
        self.credit_registration_route = credit_registration_route;
        self
    }

    pub fn set_exam_requirement(
        mut self,
        exam_requirement: ExamRequirement,
        exam_location_description: Option<String>,
    ) -> Self {
        self.exam_requirement = exam_requirement;
        self.exam_location_description = exam_location_description;
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
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct NewModule {
    name: String,
    order_number: i32,
    chapters: Vec<Uuid>,
    uh_course_code: Option<String>,
    ects_credits: Option<f32>,
    completion_policy: CompletionPolicy,
    exam_requirement: ExamRequirement,
    exam_location_description: Option<String>,
    completion_registration_link_override: Option<String>,
    credit_registration_route: CreditRegistrationRoute,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ModifiedModule {
    id: Uuid,
    name: Option<String>,
    order_number: i32,
    uh_course_code: Option<String>,
    ects_credits: Option<f32>,
    completion_policy: CompletionPolicy,
    exam_requirement: ExamRequirement,
    exam_location_description: Option<String>,
    completion_registration_link_override: Option<String>,
    credit_registration_route: CreditRegistrationRoute,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CourseAuditingModuleUpdate {
    pub id: Uuid,
    pub name: Option<String>,
    pub order_number: i32,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub completion_registration_link_override: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ModuleUpdates {
    new_modules: Vec<NewModule>,
    deleted_modules: Vec<Uuid>,
    modified_modules: Vec<ModifiedModule>,
    moved_chapters: Vec<(Uuid, Uuid)>,
}

/// How many chapters and exercises a course module contains. Used for deciding whether the module
/// is small enough to be exempt from the minimum cheater threshold.
pub struct ModuleSizeCounts {
    pub chapters: i64,
    pub exercises: i64,
}

/// Stores a blank course code as `None` and a real one trimmed, so every reader can test for presence.
pub fn normalize_uh_course_code(uh_course_code: Option<String>) -> Option<String> {
    uh_course_code
        .map(|code| code.trim().to_owned())
        .filter(|code| !code.is_empty())
}

/// Whether an optional text setting, such as a course code or link, holds more than whitespace.
pub fn is_non_blank(value: Option<&str>) -> bool {
    value.is_some_and(|value| !value.trim().is_empty())
}

/// Whether this platform registers a module's completions at all: it needs a course code and the
/// [`CreditRegistrationRoute::Platform`] route. Mirrors the SQL side's
/// `TRIM(cm.uh_course_code) <> '' AND cm.credit_registration_route = 'platform'` predicates.
pub fn registers_credits(
    uh_course_code: Option<&str>,
    credit_registration_route: CreditRegistrationRoute,
) -> bool {
    credit_registration_route == CreditRegistrationRoute::Platform && is_non_blank(uh_course_code)
}

/// Per-module credit-registration configuration: the module's own fields merged with its
/// `course_module_suotar_configurations` row. Every field of that row is optional
/// here because a module with no configuration row is a valid, unconfigured module.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseModuleCreditRegistrationConfig {
    pub course_module_id: Uuid,
    pub course_id: Uuid,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub credit_registration_paused_at: Option<DateTime<Utc>>,
    pub credit_registration_paused_by_user_id: Option<Uuid>,
    pub credit_registration_pause_reason: Option<String>,
    pub credit_registration_config_checked_at: Option<DateTime<Utc>>,
    /// `None` means never checked, which is not the same as a failed check.
    pub credit_registration_course_code_allowed: Option<bool>,
    pub credit_registration_config_check_message: Option<String>,
    /// Whether `completion_registration_link_override` is set, which is also the enrolment link for
    /// students without a usable enrolment.
    pub credit_registration_has_enrolment_link: bool,
    pub credit_registration_route: CreditRegistrationRoute,
}

/// Whether passing a module requires an exam, and where it is held.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "course_module_exam_requirement",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum ExamRequirement {
    None,
    /// An exam linked to the course on this platform.
    Platform,
    Examinarium,
    /// Described in the module's `exam_location_description`.
    Elsewhere,
}

impl ExamRequirement {
    /// Held outside this platform, which then knows nothing about it.
    pub fn is_outside_platform(self) -> bool {
        matches!(self, Self::Examinarium | Self::Elsewhere)
    }
}

/// How students get a module's completion; [`CompletionPolicy`] is the same with its thresholds.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "course_module_completion_method",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CompletionMethod {
    /// Grants nothing until the teacher decides.
    NotDecided,
    ByRequirements,
    ByExam,
    TeacherAdds,
}

/// How a module's completions turn into credits.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "course_module_credit_registration_route",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationRoute {
    /// This platform registers the completions in Sisu.
    Platform,
    /// The teacher registers the credits outside this platform, e.g. straight from Examinarium.
    External,
    /// Nothing is registered anywhere.
    CertificateOnly,
}

/// Thresholds of [`CompletionPolicy::ByRequirements`] and [`CompletionPolicy::ByExam`], as exact counts.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CompletionRequirements {
    /// Course module associated with these requirements.
    pub course_module_id: Uuid,
    pub number_of_exercises_attempted_treshold: Option<i32>,
    pub number_of_points_treshold: Option<i32>,
}

impl CompletionRequirements {
    /// Whether any threshold is set; without one, passing by requirements would pass everyone and
    /// the exam is open to everyone.
    pub fn has_any_threshold(&self) -> bool {
        self.number_of_exercises_attempted_treshold.is_some()
            || self.number_of_points_treshold.is_some()
    }

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

/// How students get a module's completion, with the thresholds the method uses.
#[derive(Debug, PartialEq, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum CompletionPolicy {
    NotDecided,
    /// Completed automatically once the student reaches the thresholds.
    ByRequirements(CompletionRequirements),
    /// Completed when the student reaches the pass mark of an ended exam linked to the course; the
    /// thresholds are the condition for taking the exam.
    ByExam(CompletionRequirements),
    TeacherAdds,
}

impl CompletionPolicy {
    /// The policy without its thresholds, as stored in `completion_method`.
    pub fn method(&self) -> CompletionMethod {
        match self {
            CompletionPolicy::NotDecided => CompletionMethod::NotDecided,
            CompletionPolicy::ByRequirements(_) => CompletionMethod::ByRequirements,
            CompletionPolicy::ByExam(_) => CompletionMethod::ByExam,
            CompletionPolicy::TeacherAdds => CompletionMethod::TeacherAdds,
        }
    }

    /// The thresholds, for the methods that have them.
    pub fn requirements(&self) -> Option<&CompletionRequirements> {
        match self {
            CompletionPolicy::ByRequirements(requirements)
            | CompletionPolicy::ByExam(requirements) => Some(requirements),
            CompletionPolicy::NotDecided | CompletionPolicy::TeacherAdds => None,
        }
    }

    /// The `completion_method` column and the exercises-attempted and points threshold columns.
    fn to_database_fields(&self) -> (CompletionMethod, Option<i32>, Option<i32>) {
        let requirements = self.requirements();
        (
            self.method(),
            requirements.and_then(|r| r.number_of_exercises_attempted_treshold),
            requirements.and_then(|r| r.number_of_points_treshold),
        )
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_course_module: &NewCourseModule,
) -> ModelResult<CourseModule> {
    let (completion_method, exercises_treshold, points_treshold) =
        new_course_module.completion_policy.to_database_fields();
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
INSERT INTO course_modules (
    id,
    course_id,
    name,
    order_number,
    completion_method,
    automatic_completion_number_of_exercises_attempted_treshold,
    automatic_completion_number_of_points_treshold,
    exam_requirement,
    exam_location_description,
    ects_credits,
    uh_course_code,
    completion_registration_link_override,
    credit_registration_route
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
        ",
        pkey_policy.into_uuid(),
        new_course_module.course_id,
        new_course_module.name,
        new_course_module.order_number,
        completion_method,
        exercises_treshold,
        points_treshold,
        new_course_module.exam_requirement,
        new_course_module.exam_location_description,
        new_course_module.ects_credits,
        normalize_uh_course_code(new_course_module.uh_course_code.clone()),
        new_course_module.completion_registration_link_override,
        new_course_module.credit_registration_route,
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

/// Deletes the module without recording history. Errors with `InvalidRequest` if chapters still
/// belong to it.
pub(crate) async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
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
AND deleted_at IS NULL
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_all_modules(conn: &mut PgConnection) -> ModelResult<Vec<CourseModule>> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
FROM course_modules
WHERE deleted_at IS NULL
        ",
    )
    .map(|x| x.into())
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CourseModule> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
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

pub async fn get_by_ids(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<Vec<CourseModule>> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
FROM course_modules
WHERE id = ANY($1)
  AND deleted_at IS NULL
        ",
        ids,
    )
    .map(|x| x.into())
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModule>> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
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

/// Batched [`get_by_course_id`]: modules for many courses in one query, to group in memory instead
/// of one query per course.
pub async fn get_by_course_ids(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
) -> ModelResult<Vec<CourseModule>> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
FROM course_modules
WHERE course_id = ANY($1)
AND deleted_at IS NULL
",
        course_ids
    )
    .map(|x| x.into())
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_course_id_only_with_open_chapters(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModule>> {
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
SELECT cm.id,
  cm.created_at,
  cm.updated_at,
  cm.deleted_at,
  cm.name,
  cm.course_id,
  cm.order_number,
  cm.copied_from,
  cm.uh_course_code,
  cm.completion_method,
  cm.automatic_completion_number_of_exercises_attempted_treshold,
  cm.automatic_completion_number_of_points_treshold,
  cm.exam_requirement,
  cm.exam_location_description,
  cm.completion_registration_link_override,
  cm.ects_credits,
  cm.certification_enabled,
  cm.credit_registration_route
FROM course_modules as cm
WHERE EXISTS (
  SELECT 1
  FROM chapters as ch
  WHERE ch.course_module_id = cm.id
    AND ((ch.opens_at < now()) OR ch.opens_at IS NULL)
    AND ch.deleted_at IS NULL
)
  AND cm.course_id = $1
  AND cm.deleted_at IS NULL
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
        r#"
SELECT course_modules.id AS "id!",
  course_modules.created_at AS "created_at!",
  course_modules.updated_at AS "updated_at!",
  course_modules.deleted_at,
  course_modules.name,
  course_modules.course_id AS "course_id!",
  course_modules.order_number AS "order_number!",
  course_modules.copied_from,
  course_modules.uh_course_code,
  course_modules.completion_method AS "completion_method!",
  course_modules.automatic_completion_number_of_exercises_attempted_treshold,
  course_modules.automatic_completion_number_of_points_treshold,
  course_modules.exam_requirement AS "exam_requirement!",
  course_modules.exam_location_description,
  course_modules.completion_registration_link_override,
  course_modules.ects_credits,
  course_modules.certification_enabled AS "certification_enabled!",
  course_modules.credit_registration_route AS "credit_registration_route!"
FROM exercises
  LEFT JOIN chapters ON (exercises.chapter_id = chapters.id)
  LEFT JOIN course_modules ON (chapters.course_module_id = course_modules.id)
WHERE exercises.id = $1
  AND chapters.deleted_at IS NULL
  AND course_modules.deleted_at IS NULL
        "#,
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

pub async fn get_chapter_and_exercise_counts(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> ModelResult<ModuleSizeCounts> {
    let res = sqlx::query_as!(
        ModuleSizeCounts,
        r#"
SELECT COUNT(DISTINCT c.id) AS "chapters!",
  COUNT(e.id) AS "exercises!"
FROM chapters c
  LEFT JOIN exercises e ON e.chapter_id = c.id
  AND e.deleted_at IS NULL
WHERE c.course_module_id = $1
  AND c.deleted_at IS NULL
        "#,
        course_module_id
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
        CourseModulesSchema,
        "
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
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
        r#"
SELECT course_modules.id AS "id!"
FROM course_modules
  LEFT JOIN courses ON (course_modules.course_id = courses.id)
WHERE (
    course_modules.uh_course_code = $1
    OR courses.slug = $1
  )
  AND course_modules.deleted_at IS NULL
        "#,
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

/// Shared by the two getters below, so the join lives in one place.
async fn credit_registration_configs(
    conn: &mut PgConnection,
    course_module_id: Option<Uuid>,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<CourseModuleCreditRegistrationConfig>> {
    let res = sqlx::query_as!(
        CourseModuleCreditRegistrationConfig,
        r#"
SELECT cm.id AS course_module_id,
  cm.course_id,
  cm.uh_course_code,
  cm.ects_credits,
  c.paused_at AS "credit_registration_paused_at?",
  c.paused_by_user_id AS "credit_registration_paused_by_user_id?",
  c.pause_reason AS "credit_registration_pause_reason?",
  c.config_checked_at AS "credit_registration_config_checked_at?",
  c.course_code_allowed AS "credit_registration_course_code_allowed?",
  c.config_check_message AS "credit_registration_config_check_message?",
  COALESCE(TRIM(cm.completion_registration_link_override) <> '', FALSE) AS "credit_registration_has_enrolment_link!",
  cm.credit_registration_route
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
WHERE ($1::uuid IS NULL OR cm.id = $1)
  AND ($2::uuid IS NULL OR cm.course_id = $2)
  AND cm.deleted_at IS NULL
ORDER BY cm.course_id,
  cm.order_number
        "#,
        course_module_id,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_credit_registration_config(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> ModelResult<CourseModuleCreditRegistrationConfig> {
    credit_registration_configs(conn, Some(course_module_id), None)
        .await?
        .into_iter()
        .next()
        .ok_or_else(missing_model_error(
            ModelErrorType::RecordNotFound,
            "Course module not found".to_string(),
        ))
}

/// Every module of one course with its Suotar configuration, configured or not.
pub async fn get_credit_registration_configs_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModuleCreditRegistrationConfig>> {
    credit_registration_configs(conn, None, Some(course_id)).await
}

/// One module's completion and credit settings with its Suotar state and whether anyone has
/// completed it, for the course's completion overview.
pub struct CourseModuleCompletionSetup {
    pub id: Uuid,
    pub name: Option<String>,
    pub order_number: i32,
    pub completion_method: CompletionMethod,
    /// Stored for every method, but only meaningful for those [`CompletionPolicy::requirements`]
    /// returns thresholds for.
    pub automatic_completion_number_of_points_treshold: Option<i32>,
    pub automatic_completion_number_of_exercises_attempted_treshold: Option<i32>,
    pub exam_requirement: ExamRequirement,
    pub credit_registration_route: CreditRegistrationRoute,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub certification_enabled: bool,
    pub completion_registration_link_override: Option<String>,
    pub has_completions: bool,
    pub credit_registration_course_code_allowed: Option<bool>,
    pub credit_registration_paused_at: Option<DateTime<Utc>>,
    pub credit_registration_pause_reason: Option<String>,
}

/// The course's modules in order, each with what [`CourseModuleCompletionSetup`] carries.
pub async fn get_completion_setups_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModuleCompletionSetup>> {
    let res = sqlx::query_as!(
        CourseModuleCompletionSetup,
        r#"
SELECT cm.id,
  cm.name,
  cm.order_number,
  cm.completion_method,
  cm.automatic_completion_number_of_points_treshold,
  cm.automatic_completion_number_of_exercises_attempted_treshold,
  cm.exam_requirement,
  cm.credit_registration_route,
  cm.uh_course_code,
  cm.ects_credits,
  cm.certification_enabled,
  cm.completion_registration_link_override,
  EXISTS (
    SELECT 1
    FROM course_module_completions cmc
    WHERE cmc.course_module_id = cm.id
      AND cmc.course_id = cm.course_id
      AND cmc.deleted_at IS NULL
  ) AS "has_completions!",
  c.course_code_allowed AS "credit_registration_course_code_allowed?",
  c.paused_at AS "credit_registration_paused_at?",
  c.pause_reason AS "credit_registration_pause_reason?"
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
WHERE cm.course_id = $1
  AND cm.deleted_at IS NULL
ORDER BY cm.order_number
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Sets how students pass the module, without recording history. `exam_requirement` must fit
/// the policy (see the `course_module_completion_method_fits_exam` constraint).
pub async fn update_completion_policy(
    conn: &mut PgConnection,
    id: Uuid,
    completion_policy: &CompletionPolicy,
    exam_requirement: ExamRequirement,
) -> ModelResult<CourseModule> {
    let (completion_method, exercises_treshold, points_treshold) =
        completion_policy.to_database_fields();
    let res = sqlx::query_as!(
        CourseModulesSchema,
        "
UPDATE course_modules
SET completion_method = $1,
  automatic_completion_number_of_exercises_attempted_treshold = $2,
  automatic_completion_number_of_points_treshold = $3,
  exam_requirement = $4
WHERE id = $5
  AND deleted_at IS NULL
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
        ",
        completion_method,
        exercises_treshold,
        points_treshold,
        exam_requirement,
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
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  name,
  course_id,
  order_number,
  copied_from,
  uh_course_code,
  completion_method,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  exam_requirement,
  exam_location_description,
  completion_registration_link_override,
  ects_credits,
  certification_enabled,
  credit_registration_route
        ",
        normalize_uh_course_code(uh_course_code),
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.into())
}

/// Sets the UH course codes, ECTS credits and registration link overrides of the course's modules
/// as the course auditing view edits them, leaving their other fields alone. Modules of other
/// courses are ignored. Returns the ids of the updated modules.
pub async fn update_auditing_fields(
    conn: &mut PgConnection,
    course_id: Uuid,
    modules: Vec<CourseAuditingModuleUpdate>,
) -> ModelResult<Vec<Uuid>> {
    for module in &modules {
        validate_completion_registration_link(
            module.completion_registration_link_override.as_deref(),
        )?;
    }
    let (ids, uh_course_codes, completion_registration_link_overrides, ects_credits): (
        Vec<_>,
        Vec<_>,
        Vec<_>,
        Vec<_>,
    ) = multiunzip(modules.into_iter().map(|m| {
        (
            m.id,
            normalize_uh_course_code(m.uh_course_code),
            m.completion_registration_link_override,
            m.ects_credits,
        )
    }));
    let updated_ids = sqlx::query_scalar!(
        r#"
UPDATE course_modules cm
SET uh_course_code = v.uh_course_code,
  completion_registration_link_override = v.completion_registration_link_override,
  ects_credits = v.ects_credits
FROM (
    SELECT *
    FROM UNNEST(
        $1::uuid [],
        $2::TEXT [],
        $3::TEXT [],
        $4::FLOAT8 []
      ) AS v(
        id,
        uh_course_code,
        completion_registration_link_override,
        ects_credits
      )
  ) AS v
WHERE cm.id = v.id
  AND cm.course_id = $5
  AND cm.deleted_at IS NULL
RETURNING cm.id
"#,
        &ids,
        &uh_course_codes as &[Option<String>],
        &completion_registration_link_overrides as &[Option<String>],
        &ects_credits as &[Option<f32>],
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(updated_ids)
}

/// Errors with `InvalidRequest` unless `link` is empty or an absolute `https://` URL. Students get
/// the link as an `href`, so no other scheme may be stored.
pub fn validate_completion_registration_link(link: Option<&str>) -> ModelResult<()> {
    let Some(link) = link.map(str::trim).filter(|link| !link.is_empty()) else {
        return Ok(());
    };
    match Url::parse(link) {
        Ok(url) if url.scheme() == "https" && url.host().is_some() => Ok(()),
        _ => Err(model_err!(
            InvalidRequest,
            "The completion registration link must be an absolute https:// URL.".to_string()
        )),
    }
}

/// Errors with `InvalidRequest` naming the first rule a module's completion and credit settings
/// break: the exam, completion method and credit registration route must fit together, an exam
/// elsewhere needs a description, the course code and credits are always required, and the
/// registration link is required when this platform registers the credits.
///
/// Teacher-facing edits only; seeding and copying write whatever they are given.
pub fn validate_completion_settings(module: &ModuleSnapshot) -> ModelResult<()> {
    let invalid = |message: &str| {
        let name = module.name.as_deref().unwrap_or("the default module");
        Err(model_err!(InvalidRequest, format!("{name}: {message}")))
    };
    let exam = module.exam_requirement;
    match (&module.completion_policy, exam) {
        (CompletionPolicy::ByExam(_), ExamRequirement::None) => {
            return invalid("students can't pass by the exam when no exam is required.");
        }
        (CompletionPolicy::ByExam(_), _) if exam.is_outside_platform() => {
            return invalid(
                "students can't pass by an exam held outside this platform; the teacher adds the completions.",
            );
        }
        (CompletionPolicy::ByRequirements(_), ExamRequirement::None) => {}
        (CompletionPolicy::ByRequirements(_), _) => {
            return invalid("students can't pass by requirements alone when an exam is required.");
        }
        _ => {}
    }
    if let Some(requirements) = module.completion_policy.requirements() {
        let thresholds = [
            requirements.number_of_exercises_attempted_treshold,
            requirements.number_of_points_treshold,
        ];
        if thresholds.iter().flatten().any(|threshold| *threshold < 0) {
            return invalid("requirements can't be negative.");
        }
        if matches!(
            module.completion_policy,
            CompletionPolicy::ByRequirements(_)
        ) && !requirements.has_any_threshold()
        {
            return invalid("passing by requirements needs at least one requirement.");
        }
    }
    if exam == ExamRequirement::Elsewhere
        && !is_non_blank(module.exam_location_description.as_deref())
    {
        return invalid("describe where the exam is held.");
    }
    if module.credit_registration_route == CreditRegistrationRoute::External
        && !exam.is_outside_platform()
    {
        return invalid(
            "credits can be registered outside this platform only when the exam is held outside it.",
        );
    }
    if module.credit_registration_route == CreditRegistrationRoute::CertificateOnly
        && exam.is_outside_platform()
    {
        return invalid(
            "a module with an exam outside this platform can't be certificate only; either this platform or the teacher registers its credits.",
        );
    }
    if !is_non_blank(module.uh_course_code.as_deref()) {
        return invalid("the course code is required.");
    }
    if module.ects_credits.is_none_or(|credits| credits <= 0.0) {
        return invalid("the credits are required.");
    }
    if module.credit_registration_route == CreditRegistrationRoute::Platform
        && !is_non_blank(module.completion_registration_link_override.as_deref())
    {
        return invalid(
            "the registration link is required when this platform registers the credits.",
        );
    }
    Ok(())
}

/// Holds an edit of a module to the editor's rules when it touches the completion or credit settings
/// (see [`validate_completion_settings`]). `previous` is `None` for a new module. Reordering or
/// renaming alone must not force filling in settings the module has lacked so far.
pub fn validate_completion_settings_if_changed(
    previous: Option<&ModuleSnapshot>,
    next: &ModuleSnapshot,
) -> ModelResult<()> {
    if previous.is_some_and(|previous| previous.completion_settings() == next.completion_settings())
    {
        return Ok(());
    }
    validate_completion_registration_link(next.completion_registration_link_override.as_deref())?;
    validate_completion_settings(next)
}

/// Errors with `InvalidRequest` unless every module and chapter id is a live row of `course_id`.
async fn ensure_belong_to_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    module_ids: &[Uuid],
    chapter_ids: &[Uuid],
) -> ModelResult<()> {
    let res = sqlx::query!(
        r#"
SELECT NOT EXISTS (
    SELECT 1
    FROM UNNEST($2::uuid []) AS ids(id)
    WHERE NOT EXISTS (
        SELECT 1
        FROM course_modules cm
        WHERE cm.id = ids.id
          AND cm.course_id = $1
          AND cm.deleted_at IS NULL
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM UNNEST($3::uuid []) AS ids(id)
    WHERE NOT EXISTS (
        SELECT 1
        FROM chapters c
        WHERE c.id = ids.id
          AND c.course_id = $1
          AND c.deleted_at IS NULL
      )
  ) AS "all_belong!"
"#,
        course_id,
        module_ids,
        chapter_ids,
    )
    .fetch_one(conn)
    .await?;
    if !res.all_belong {
        return Err(model_err!(
            InvalidRequest,
            "Every module and chapter in the update must belong to the course.".to_string()
        ));
    }
    Ok(())
}

/// Applies the module editor's changes to `course_id` in one transaction, through
/// [`upsert_from_snapshot`], and records the modules and chapters it changed in their history.
///
/// Rejects the whole update if any referenced module or chapter is not in the course, or if a
/// module fails [`upsert_from_snapshot`]'s checks. `actor_user_id` is the author of the history rows
/// and of the registrations [`upsert_from_snapshot`] cancels.
pub async fn update_modules(
    conn: &mut PgConnection,
    course_id: Uuid,
    updates: ModuleUpdates,
    actor_user_id: Uuid,
) -> ModelResult<()> {
    let author = HistoryAuthor::user(actor_user_id);
    let mut tx = conn.begin().await?;
    crate::courses::defer_structure_constraints(&mut tx).await?;

    let module_ids: Vec<Uuid> = updates
        .modified_modules
        .iter()
        .map(|m| m.id)
        .chain(updates.deleted_modules.iter().copied())
        .chain(updates.moved_chapters.iter().map(|(_, module)| *module))
        .collect();
    let chapter_ids: Vec<Uuid> = updates
        .new_modules
        .iter()
        .flat_map(|m| m.chapters.iter().copied())
        .chain(updates.moved_chapters.iter().map(|(chapter, _)| *chapter))
        .collect();
    ensure_belong_to_course(&mut tx, course_id, &module_ids, &chapter_ids).await?;

    let mut written_module_ids = Vec::new();
    for module in updates.modified_modules {
        // destructure so new fields cause a compilation error here
        let ModifiedModule {
            id,
            name,
            order_number,
            uh_course_code,
            ects_credits,
            completion_policy,
            exam_requirement,
            exam_location_description,
            completion_registration_link_override,
            credit_registration_route,
        } = module;
        let current = ModuleSnapshot::from(get_by_id(&mut tx, id).await?);
        let snapshot = ModuleSnapshot {
            name: name.or(current.name.clone()),
            order_number,
            completion_policy,
            exam_requirement,
            exam_location_description,
            uh_course_code,
            ects_credits,
            completion_registration_link_override,
            credit_registration_route,
            ..current.clone()
        };
        validate_completion_settings_if_changed(Some(&current), &snapshot)?;
        upsert_from_snapshot(&mut tx, &snapshot, actor_user_id).await?;
        written_module_ids.push(id);
    }
    for new in updates.new_modules {
        // destructure so new fields cause a compilation error here
        let NewModule {
            name,
            order_number,
            chapters,
            uh_course_code,
            ects_credits,
            completion_policy,
            exam_requirement,
            exam_location_description,
            completion_registration_link_override,
            credit_registration_route,
        } = new;
        let snapshot = NewCourseModule::new(course_id, Some(name), order_number)
            .set_completion_policy(completion_policy)
            .set_exam_requirement(exam_requirement, exam_location_description)
            .set_uh_course_code(uh_course_code)
            .set_ects_credits(ects_credits)
            .set_completion_registration_link_override(completion_registration_link_override)
            .set_credit_registration_route(credit_registration_route)
            .into_snapshot(Uuid::new_v4());
        validate_completion_settings_if_changed(None, &snapshot)?;
        upsert_from_snapshot(&mut tx, &snapshot, actor_user_id).await?;
        for chapter in chapters {
            chapters::set_module(&mut tx, chapter, snapshot.id).await?;
        }
        written_module_ids.push(snapshot.id);
    }
    for (chapter, module) in &updates.moved_chapters {
        chapters::set_module(&mut tx, *chapter, *module).await?;
    }
    for deleted in updates.deleted_modules {
        entity_history::record_deleted(&mut tx, ContentEntityType::Module, deleted, author).await?;
        delete(&mut tx, deleted).await?;
    }

    let changed: Vec<_> = written_module_ids
        .into_iter()
        .map(|id| EntityKey::new(ContentEntityType::Module, id))
        .chain(
            chapter_ids
                .into_iter()
                .map(|id| EntityKey::new(ContentEntityType::Chapter, id)),
        )
        .collect();
    entity_history::record_current_many(&mut tx, &changed, author).await?;
    tx.commit().await?;
    Ok(())
}

/// Turns certificate generation on or off and records the result in the module's history.
pub async fn update_certification_enabled(
    conn: &mut PgConnection,
    id: Uuid,
    enabled: bool,
    author_user_id: Uuid,
) -> ModelResult<()> {
    entity_history::save_recording(
        conn,
        ContentEntityType::Module,
        id,
        HistoryAuthor::user(author_user_id),
        async |tx| {
            let module = ModuleSnapshot {
                certification_enabled: enabled,
                ..ModuleSnapshot::from(get_by_id(&mut *tx, id).await?)
            };
            upsert_from_snapshot(tx, &module, author_user_id).await
        },
    )
    .await
}

/// Writes every field of the snapshot to the module, creating it with the snapshot's id if it does
/// not exist and bringing it back if it is deleted. Does not record history.
///
/// Errors with `InvalidRequest` if the completion registration link fails
/// [`validate_completion_registration_link`]. Moving the module off the
/// [`CreditRegistrationRoute::Platform`] route cancels its registrations not yet sent, on behalf
/// of `actor_user_id`.
pub async fn upsert_from_snapshot(
    conn: &mut PgConnection,
    snapshot: &ModuleSnapshot,
    actor_user_id: Uuid,
) -> ModelResult<()> {
    validate_completion_registration_link(
        snapshot.completion_registration_link_override.as_deref(),
    )?;
    let previous_route = get_by_id(conn, snapshot.id)
        .await
        .optional()?
        .map(|module| module.credit_registration_route);
    let (completion_method, exercises_treshold, points_treshold) =
        snapshot.completion_policy.to_database_fields();
    sqlx::query!(
        "
INSERT INTO course_modules (
    id,
    course_id,
    name,
    order_number,
    completion_method,
    automatic_completion_number_of_exercises_attempted_treshold,
    automatic_completion_number_of_points_treshold,
    exam_requirement,
    exam_location_description,
    certification_enabled,
    uh_course_code,
    ects_credits,
    completion_registration_link_override,
    credit_registration_route
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO
UPDATE
SET name = EXCLUDED.name,
  order_number = EXCLUDED.order_number,
  completion_method = EXCLUDED.completion_method,
  automatic_completion_number_of_exercises_attempted_treshold = EXCLUDED.automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold = EXCLUDED.automatic_completion_number_of_points_treshold,
  exam_requirement = EXCLUDED.exam_requirement,
  exam_location_description = EXCLUDED.exam_location_description,
  certification_enabled = EXCLUDED.certification_enabled,
  uh_course_code = EXCLUDED.uh_course_code,
  ects_credits = EXCLUDED.ects_credits,
  completion_registration_link_override = EXCLUDED.completion_registration_link_override,
  credit_registration_route = EXCLUDED.credit_registration_route,
  deleted_at = NULL
WHERE course_modules.course_id = EXCLUDED.course_id
        ",
        snapshot.id,
        snapshot.course_id,
        snapshot.name,
        snapshot.order_number,
        completion_method,
        exercises_treshold,
        points_treshold,
        snapshot.exam_requirement,
        snapshot.exam_location_description,
        snapshot.certification_enabled,
        normalize_uh_course_code(snapshot.uh_course_code.clone()),
        snapshot.ects_credits,
        snapshot.completion_registration_link_override,
        snapshot.credit_registration_route,
    )
    .execute(&mut *conn)
    .await?;
    if previous_route == Some(CreditRegistrationRoute::Platform)
        && snapshot.credit_registration_route != CreditRegistrationRoute::Platform
    {
        crate::credit_registrations::cancel_unsent_for_course_module(
            conn,
            snapshot.id,
            actor_user_id,
        )
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {

    mod completion_requirements {
        use uuid::Uuid;

        use super::super::CompletionRequirements;

        #[test]
        fn passes_exercise_tresholds() {
            let requirements1 = CompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(10),
                number_of_points_treshold: Some(50),
            };
            let requirements2 = CompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(50),
                number_of_points_treshold: Some(10),
            };

            let requirements3 = CompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(0),
                number_of_points_treshold: Some(0),
            };

            let requirements4 = CompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: Some(10),
                number_of_points_treshold: None,
            };

            let requirements5 = CompletionRequirements {
                course_module_id: Uuid::parse_str("66d98fc6-784a-4b39-a494-24ae9b1c9b14").unwrap(),
                number_of_exercises_attempted_treshold: None,
                number_of_points_treshold: Some(10),
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
