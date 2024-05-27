use std::collections::HashMap;

use futures::Stream;

use crate::{prelude::*, study_registry_registrars::StudyRegistryRegistrar};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModuleCompletion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
    pub course_module_id: Uuid,
    pub user_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    pub completion_language: String,
    pub eligible_for_ects: bool,
    pub email: String,
    pub grade: Option<i32>,
    pub passed: bool,
    pub prerequisite_modules_completed: bool,
    pub completion_granter_user_id: Option<Uuid>,
    // pub needs_to_be_reviewed: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModuleAverage {
    pub id: Uuid,
    pub course_instance_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub average_duration: Option<u64>,
    pub average_points: i32,
    pub total_points: i32,
    pub total_student: i32,
}

// Define the CourseModulePointsAverage struct to match the result of the SQL query
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModulePointsAverage {
    pub course_instance_id: Uuid,
    pub average_points: Option<f32>,
    pub total_points: Option<i32>,
    pub total_student: Option<i32>,
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub enum CourseModuleCompletionGranter {
    Automatic,
    User(Uuid),
}

impl CourseModuleCompletionGranter {
    fn to_database_field(&self) -> Option<Uuid> {
        match self {
            CourseModuleCompletionGranter::Automatic => None,
            CourseModuleCompletionGranter::User(user_id) => Some(*user_id),
        }
    }
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewCourseModuleCompletion {
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
    pub course_module_id: Uuid,
    pub user_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    pub completion_language: String,
    pub eligible_for_ects: bool,
    pub email: String,
    pub grade: Option<i32>,
    pub passed: bool,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_course_module_completion: &NewCourseModuleCompletion,
    completion_granter: CourseModuleCompletionGranter,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_module_completions (
    id,
    course_id,
    course_instance_id,
    course_module_id,
    user_id,
    completion_date,
    completion_registration_attempt_date,
    completion_language,
    eligible_for_ects,
    email,
    grade,
    passed,
    completion_granter_user_id
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13
  )
RETURNING id
        ",
        pkey_policy.into_uuid(),
        new_course_module_completion.course_id,
        new_course_module_completion.course_instance_id,
        new_course_module_completion.course_module_id,
        new_course_module_completion.user_id,
        new_course_module_completion.completion_date,
        new_course_module_completion.completion_registration_attempt_date,
        new_course_module_completion.completion_language,
        new_course_module_completion.eligible_for_ects,
        new_course_module_completion.email,
        new_course_module_completion.grade,
        new_course_module_completion.passed,
        completion_granter.to_database_field(),
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CourseModuleCompletion> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        r#"
SELECT *
FROM course_module_completions
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_ids(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<Vec<CourseModuleCompletion>> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
WHERE id = ANY($1)
  AND deleted_at IS NULL
        ",
        ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_ids_as_map(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, CourseModuleCompletion>> {
    let res = get_by_ids(conn, ids)
        .await?
        .into_iter()
        .map(|x| (x.id, x))
        .collect();
    Ok(res)
}

pub async fn get_all_by_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<CourseModuleCompletion>> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
WHERE course_instance_id = $1
  AND deleted_at IS NULL
        ",
        course_instance_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModuleCompletionWithRegistrationInfo {
    /// When the student has attempted to register the completion.
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    /// ID of the course module.
    pub course_module_id: Uuid,
    /// When the record was created
    pub created_at: DateTime<Utc>,
    /// Grade that the student received for the completion.
    pub grade: Option<i32>,
    /// Whether or not the student is eligible for credit for the completion.
    pub passed: bool,
    /// Whether or not the student is qualified for credit based on other modules in the course.
    pub prerequisite_modules_completed: bool,
    /// Whether or not the completion has been registered to a study registry.
    pub registered: bool,
    /// ID of the user for the completion.
    pub user_id: Uuid,
    // When the user completed the course
    pub completion_date: DateTime<Utc>,
}

/// Gets summaries for all completions on the given course instance.
pub async fn get_all_with_registration_information_by_course_instance_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<CourseModuleCompletionWithRegistrationInfo>> {
    let res = sqlx::query_as!(
        CourseModuleCompletionWithRegistrationInfo,
        r#"
SELECT completions.completion_registration_attempt_date,
  completions.course_module_id,
  completions.created_at,
  completions.grade,
  completions.passed,
  completions.prerequisite_modules_completed,
  (registered.id IS NOT NULL) AS "registered!",
  completions.user_id,
  completions.completion_date
FROM course_module_completions completions
  LEFT JOIN course_module_completion_registered_to_study_registries registered ON (
    completions.id = registered.course_module_completion_id
  )
WHERE completions.course_instance_id = $1
  AND completions.deleted_at IS NULL
  AND registered.deleted_at IS NULL
        "#,
        course_instance_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Gets all module completions for the user on a single course instance. There can be multiple modules
/// in a single course, so the result is a `Vec`.
pub async fn get_all_by_course_instance_and_user_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<CourseModuleCompletion>> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
WHERE course_instance_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
        ",
        course_instance_id,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<CourseModuleCompletion>> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
WHERE user_id = $1
  AND deleted_at IS NULL
        ",
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_by_course_module_instance_and_user_ids(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<CourseModuleCompletion>> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
WHERE course_module_id = $1
  AND course_instance_id = $2
  AND user_id = $3
  AND deleted_at IS NULL
        ",
        course_module_id,
        course_instance_id,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Gets latest created completion for the given user on the specified course instance.
pub async fn get_latest_by_course_module_instance_and_user_ids(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseModuleCompletion> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
WHERE course_module_id = $1
  AND course_instance_id = $2
  AND user_id = $3
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
        ",
        course_module_id,
        course_instance_id,
        user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Get the number of students that have completed the course
pub async fn get_count_of_distinct_completors_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<i64> {
    let res = sqlx::query!(
        "
SELECT COUNT(DISTINCT user_id) as count
FROM course_module_completions
WHERE course_id = $1
  AND deleted_at IS NULL
",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.count.unwrap_or(0))
}

/// Gets automatically granted course module completion for the given user on the specified course
/// instance. This entry is quaranteed to be unique in database by the index
/// `course_module_automatic_completion_uniqueness`.
pub async fn get_automatic_completion_by_course_module_instance_and_user_ids(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CourseModuleCompletion> {
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        "
SELECT *
FROM course_module_completions
WHERE course_module_id = $1
  AND course_instance_id = $2
  AND user_id = $3
  AND completion_granter_user_id IS NULL
  AND deleted_at IS NULL
        ",
        course_module_id,
        course_instance_id,
        user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_completion_registration_attempt_date(
    conn: &mut PgConnection,
    id: Uuid,
    completion_registration_attempt_date: DateTime<Utc>,
) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
UPDATE course_module_completions
SET completion_registration_attempt_date = $1
WHERE id = $2
  AND deleted_at IS NULL
        ",
        Some(completion_registration_attempt_date),
        id,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected() > 0)
}

pub async fn update_prerequisite_modules_completed(
    conn: &mut PgConnection,
    id: Uuid,
    prerequisite_modules_completed: bool,
) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
UPDATE course_module_completions SET prerequisite_modules_completed = $1
WHERE id = $2 AND deleted_at IS NULL
    ",
        prerequisite_modules_completed,
        id
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected() > 0)
}

// pub async fn update_needs_to_be_reviewed(
//     conn: &mut PgConnection,
//     id: Uuid,
//     needs_to_be_updated: bool,
// ) -> ModelResult<bool> {
//     let res = sqlx::query!(
//         "
// UPDATE course_module_completions SET needs_to_be_reviewed = $1
// WHERE id = $2 AND deleted_at IS NULL
//         ",
//         needs_to_be_reviewed,
//         id
//     )
//     .execute(conn)
//     .await?;
//     Ok(res.rows_affected() > 0)
// }

/// Checks whether the user has any completions for the given course module on the specified
/// course instance.
pub async fn user_has_completed_course_module_on_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_module_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<bool> {
    let res = get_all_by_course_module_instance_and_user_ids(
        conn,
        course_module_id,
        course_instance_id,
        user_id,
    )
    .await?;
    Ok(!res.is_empty())
}

/// Completion in the form that is recognized by authorized third party study registry registrars.
#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudyRegistryCompletion {
    /// The date when the student completed the course. The value of this field is the date that will
    /// end up in the user's study registry as the completion date. If the completion is created
    /// automatically, it is the date when the student passed the completion thresholds. If the teacher
    /// creates these completions manually, the teacher inputs this value. Usually the teacher would in
    /// this case input the date of the exam.
    pub completion_date: DateTime<Utc>,
    /// The language used in the completion of the course.
    pub completion_language: String,
    /// Date when the student opened the form to register their credits to the open university.
    pub completion_registration_attempt_date: Option<DateTime<Utc>>,
    /// Email at the time of completing the course. Used to match the student to the data that they will
    /// fill to the open university and it will remain unchanged in the event of email change because
    /// changing this would break the matching.
    pub email: String,
    /// The grade to be passed to the study registry. Uses the sisu format. See the struct documentation for details.
    pub grade: StudyRegistryGrade,
    /// ID of the completion.
    pub id: Uuid,
    /// User id in courses.mooc.fi for received registered completions.
    pub user_id: Uuid,
    /// Tier of the completion. Currently always null. Historically used for example to distinguish between
    /// intermediate and advanced versions of the Building AI course.
    pub tier: Option<i32>,
}

impl From<CourseModuleCompletion> for StudyRegistryCompletion {
    fn from(completion: CourseModuleCompletion) -> Self {
        Self {
            completion_date: completion.completion_date,
            completion_language: completion.completion_language,
            completion_registration_attempt_date: completion.completion_registration_attempt_date,
            email: completion.email,
            grade: StudyRegistryGrade::new(completion.passed, completion.grade),
            id: completion.id,
            user_id: completion.user_id,
            tier: None,
        }
    }
}

/// Grading object that maps the system grading information to Sisu's grading scales.
///
/// Currently only `sis-0-5` and `sis-hyv-hyl` scales are supported in the system.
///
/// All grading scales can be found from <https://sis-helsinki-test.funidata.fi/api/graphql> using
/// the following query:
///
/// ```graphql
/// query {
///   grade_scales {
///     id
///     name {
///       fi
///       en
///       sv
///     }
///     grades {
///       name {
///         fi
///         en
///         sv
///       }
///       passed
///       localId
///       abbreviation {
///         fi
///         en
///         sv
///       }
///     }
///     abbreviation {
///       fi
///       en
///       sv
///     }
///   }
/// }
/// ```
#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudyRegistryGrade {
    pub scale: String,
    pub grade: String,
}

impl StudyRegistryGrade {
    pub fn new(passed: bool, grade: Option<i32>) -> Self {
        match grade {
            Some(grade) => Self {
                scale: "sis-0-5".to_string(),
                grade: grade.to_string(),
            },
            None => Self {
                scale: "sis-hyv-hyl".to_string(),
                grade: if passed {
                    "1".to_string()
                } else {
                    "0".to_string()
                },
            },
        }
    }
}
/// Streams completions.
///
/// If no_completions_registered_by_this_study_registry_registrar is None, then all completions are streamed.
pub fn stream_by_course_module_id<'a>(
    conn: &'a mut PgConnection,
    course_module_ids: &'a [Uuid],
    no_completions_registered_by_this_study_registry_registrar: &'a Option<StudyRegistryRegistrar>,
) -> impl Stream<Item = sqlx::Result<StudyRegistryCompletion>> + Send + 'a {
    // If this is none, we're using a null uuid, which will never match anything. Therefore, no completions will be filtered out.
    let study_module_registrar_id = no_completions_registered_by_this_study_registry_registrar
        .clone()
        .map(|o| o.id)
        .unwrap_or(Uuid::nil());
    let res = sqlx::query_as!(
        CourseModuleCompletion,
        r#"
SELECT *
FROM course_module_completions
WHERE course_module_id = ANY($1)
  AND prerequisite_modules_completed
  AND eligible_for_ects IS TRUE
  AND deleted_at IS NULL
  AND id NOT IN (
    SELECT course_module_completion_id
    FROM course_module_completion_registered_to_study_registries
    WHERE course_module_id = ANY($1)
      AND study_registry_registrar_id = $2
      AND deleted_at IS NULL
  )
        "#,
        course_module_ids,
        study_module_registrar_id,
    )
    .map(StudyRegistryCompletion::from)
    .fetch(conn);
    res
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "

UPDATE course_module_completions
SET deleted_at = now()
WHERE id = $1
        ",
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
