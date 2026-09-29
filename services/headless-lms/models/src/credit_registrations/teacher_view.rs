//! The ledger as a course's teacher surfaces show it, and what a teacher's bulk retry may move.

use super::state::{CreditRegistrationErrorCode, CreditRegistrationState, ResubmissionFacts};
use crate::library::credit_registration::{
    PendingPreconditions, StageMatch, StudentFacingCreditRegistrationStatus,
};
use crate::library::students_view::escape_like_pattern;
use crate::prelude::*;
use crate::verified_student_numbers::StudentNumberVerificationMethod;

/// The course's live rows a bulk retry can actually move: failed for good, and not held open by
/// Suotar. Oldest first, capped by `limit`.
///
/// Deliberately only these. A row a retry always refuses keeps matching for as long as it exists,
/// so letting one into the batch would spend a slot of the cap on it forever: a course holding
/// `limit` of them could never retry anything again. [`count_submission_uncertain_by_course_id`] is
/// what reports them.
pub async fn get_retryable_ids_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    limit: i64,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT id
FROM credit_registrations cr
WHERE cr.course_id = $1
  AND cr.state = 'failed_permanent'
  AND (
    cr.resubmit_not_before IS NULL
    OR cr.resubmit_not_before <= now()
  )
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
ORDER BY cr.state_entered_at
LIMIT $2
        "#,
        course_id,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// How many of a course's live rows a bulk retry has to refuse, all for the one remaining reason:
/// the submission may have landed, so only a human may move that row.
///
/// Counts the whole course, not a capped window: these are the rows
/// [`get_retryable_ids_by_course_id`] leaves out, and a teacher clicking again will never work
/// through them.
pub async fn count_submission_uncertain_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations cr
WHERE cr.course_id = $1
  AND cr.state = 'submission_uncertain'
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
        "#,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Live rows of one course grouped by module and state, with the preconditions a `pending` row is
/// waiting on and how many of each group the pipeline handed to support.
///
/// The preconditions travel with the group so a caller can classify it via
/// [`crate::library::credit_registration::StudentFacingCreditRegistrationStatus::of`] instead of
/// reimplementing that mapping in SQL — keeping per-module columns and per-row badges in sync.
#[derive(Debug, Clone, PartialEq)]
pub struct CourseModuleStateCount {
    pub course_module_id: Uuid,
    pub state: CreditRegistrationState,
    pub completion_eligible: bool,
    pub has_verified_student_number: bool,
    pub course_code_allowed: bool,
    pub enrolment_resolved: bool,
    pub count: i64,
    /// Of `count`, how many carry the pipeline's flag.
    pub needs_admin_attention_count: i64,
}

/// The course's live rows per module and state, narrowed to one instance where the caller names
/// one.
pub async fn count_by_module_and_state_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_instance_id: Option<Uuid>,
) -> ModelResult<Vec<CourseModuleStateCount>> {
    let res = sqlx::query_as!(
        CourseModuleStateCount,
        r#"
SELECT cr.course_module_id,
  cr.state,
  p.completion_eligible AS "completion_eligible!",
  p.has_verified_student_number AS "has_verified_student_number!",
  p.course_code_allowed AS "course_code_allowed!",
  cr.selected_enrolment_id IS NOT NULL AS "enrolment_resolved!",
  COUNT(*) AS "count!",
  COUNT(*) FILTER (
    WHERE cr.needs_admin_attention
  ) AS "needs_admin_attention_count!"
FROM credit_registrations cr
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
WHERE cr.course_id = $1
  AND (
    $2::uuid IS NULL
    OR cr.course_instance_id = $2
  )
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
GROUP BY cr.course_module_id,
  cr.state,
  p.completion_eligible,
  p.has_verified_student_number,
  p.course_code_allowed,
  (cr.selected_enrolment_id IS NOT NULL)
        "#,
        course_id,
        course_instance_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One ledger row as a teacher sees it: the raw state, the student's identity and the unmasked
/// verified student number, but never the study registry's own error text.
#[derive(Debug, Clone)]
pub struct TeacherCreditRegistration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub resubmit_not_before: Option<DateTime<Utc>>,
    /// Live only: a soft-deleted link is no longer a number we hold for this student.
    pub student_number: Option<DbSecret>,
    pub student_number_verified_at: Option<DateTime<Utc>>,
    pub student_number_verified_via: Option<StudentNumberVerificationMethod>,
    /// Needed to find the account's linking mails, which are keyed on the Sisu person.
    pub sisu_person_id: Option<DbSecret>,
    pub enrolment_resolved: bool,
    pub enrolment_realisation_name: Option<String>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    pub enrolment_check_requested_at: Option<DateTime<Utc>>,
    pub completion_eligible: bool,
    pub course_code_allowed: bool,
    /// The page's total row count, so a caller can read it off the first row instead of a second
    /// query.
    pub total_count: i64,
}

impl TeacherCreditRegistration {
    /// What decides whether a human may move this row; see [`ResubmissionFacts`].
    pub fn resubmission_facts(&self) -> ResubmissionFacts {
        ResubmissionFacts {
            state: self.state,
            is_superseded: self.superseded_by_id.is_some(),
            resubmit_not_before: self.resubmit_not_before,
            submitted_at: self.submitted_at,
        }
    }

    /// What a `pending` row is waiting on. The linked number is the row's own `student_number`,
    /// which is the live link rather than the one a submitted payload froze.
    pub fn preconditions(&self) -> PendingPreconditions {
        PendingPreconditions {
            completion_eligible: self.completion_eligible,
            has_verified_student_number: self.student_number.is_some(),
            course_code_allowed: self.course_code_allowed,
        }
    }
}

/// The optional narrowings a teacher surface applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct TeacherCreditRegistrationFilters<'a> {
    pub id: Option<Uuid>,
    pub user_ids: Option<&'a [Uuid]>,
    pub state: Option<CreditRegistrationState>,
    /// Rows whose student-facing stage is one of these. Empty means no narrowing. The stage set the
    /// teacher surfaces filter by, so a row this returns always carries a badge the filter named.
    pub stages: &'a [StudentFacingCreditRegistrationStatus],
    /// Matched against the student's name, email or verified student number.
    pub search: Option<&'a str>,
    pub course_instance_id: Option<Uuid>,
    /// Narrows to every attempt of one completion.
    pub course_module_completion_id: Option<Uuid>,
}

/// The one query behind every teacher-facing read, so a filter wired into a page cannot be missed
/// in its count. `total_count` is computed before the limit, which is why the count reads it with
/// `limit = 1`.
async fn teacher_facing_page(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    filters: &TeacherCreditRegistrationFilters<'_>,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    let search_pattern = filters.search.map(search_pattern_of);
    let stages = StageMatch::of(filters.stages);
    let res = sqlx::query_as!(
        TeacherCreditRegistration,
        r#"
SELECT cr.id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.course_instance_id,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state,
  cr.state_entered_at,
  cr.error_code AS "error_code?",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.registered_at,
  cr.sisu_attainment_id,
  cr.grade_id,
  cr.credits,
  cr.attempt_number,
  cr.superseded_by_id,
  cr.submitted_at,
  cr.resubmit_not_before,
  vsn.student_number AS "student_number?",
  vsn.verified_at AS "student_number_verified_at?",
  vsn.verified_via AS "student_number_verified_via?",
  vsn.sisu_person_id AS "sisu_person_id?",
  cr.selected_enrolment_id IS NOT NULL AS "enrolment_resolved!",
  COALESCE(
    cr.selected_enrolment_realisation_name->>'fi',
    cr.selected_enrolment_realisation_name->>'en',
    cr.selected_enrolment_realisation_name->>'sv'
  ) AS "enrolment_realisation_name?",
  cr.enrolment_checked_at,
  cr.enrolment_check_requested_at,
  p.completion_eligible AS "completion_eligible!",
  p.course_code_allowed AS "course_code_allowed!",
  COUNT(*) OVER () AS "total_count!"
FROM credit_registrations cr
  JOIN course_modules cm ON cm.id = cr.course_module_id AND cm.deleted_at IS NULL
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id AND cmc.deleted_at IS NULL
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND ($1::uuid IS NULL OR cr.course_id = $1)
  AND ($2::uuid IS NULL OR cr.id = $2)
  AND ($3::uuid [] IS NULL OR cr.user_id = ANY($3))
  AND (
    $4::credit_registration_state IS NULL
    OR cr.state = $4
  )
  AND (
    $5::text IS NULL
    OR ud.name_search_helper LIKE '%' || $5 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $5 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $5 || '%' ESCAPE '\'
  )
  AND ($6::uuid IS NULL OR cr.course_instance_id = $6)
  AND ($7::uuid IS NULL OR cr.course_module_completion_id = $7)
  AND (
    CARDINALITY($10::credit_registration_state []) = 0
    OR EXISTS (
      SELECT 1
      FROM UNNEST(
          $10::credit_registration_state [],
          $11::boolean [],
          $12::boolean [],
          $13::boolean [],
          $14::boolean []
        ) AS stage(
          state,
          completion_eligible,
          has_verified_student_number,
          course_code_allowed,
          enrolment_resolved
        )
      WHERE stage.state = cr.state
        AND stage.completion_eligible = p.completion_eligible
        AND stage.has_verified_student_number = (vsn.student_number IS NOT NULL)
        AND stage.course_code_allowed = p.course_code_allowed
        AND stage.enrolment_resolved = (cr.selected_enrolment_id IS NOT NULL)
    )
  )
ORDER BY cmc.completion_date DESC,
  cr.attempt_number DESC,
  cr.id
LIMIT $8 OFFSET $9
        "#,
        course_id,
        filters.id,
        filters.user_ids,
        filters.state as Option<CreditRegistrationState>,
        search_pattern.as_deref(),
        filters.course_instance_id,
        filters.course_module_completion_id,
        limit,
        offset,
        &stages.states as &[CreditRegistrationState],
        &stages.completion_eligible as &[bool],
        &stages.has_verified_student_number as &[bool],
        &stages.course_code_allowed as &[bool],
        &stages.enrolment_resolved as &[bool],
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The course's ledger rows as the teacher surfaces show them, newest completion first.
pub async fn get_teacher_facing_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    filters: &TeacherCreditRegistrationFilters<'_>,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    teacher_facing_page(conn, Some(course_id), filters, limit, offset).await
}

/// How many rows [`get_teacher_facing_by_course_id`] would return without a page limit.
pub async fn count_teacher_facing_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    filters: &TeacherCreditRegistrationFilters<'_>,
) -> ModelResult<i64> {
    let rows = teacher_facing_page(conn, Some(course_id), filters, 1, 0).await?;
    Ok(rows.first().map_or(0, |row| row.total_count))
}

/// Lowercased and with metacharacters escaped, so a search for `%` matches a literal one.
pub(super) fn search_pattern_of(search: &str) -> String {
    escape_like_pattern(&search.to_lowercase())
}

/// One row for a teacher surface, by id. `None` when no such live row exists.
pub async fn get_teacher_facing_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<TeacherCreditRegistration>> {
    let rows = teacher_facing_page(
        conn,
        None,
        &TeacherCreditRegistrationFilters {
            id: Some(id),
            ..TeacherCreditRegistrationFilters::default()
        },
        1,
        0,
    )
    .await?;
    Ok(rows.into_iter().next())
}

/// Every attempt for the same completion as `row`, that one included, newest attempt first.
pub async fn get_teacher_facing_attempts_for_completion(
    conn: &mut PgConnection,
    row: &TeacherCreditRegistration,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    get_teacher_facing_by_course_id(
        conn,
        row.course_id,
        &TeacherCreditRegistrationFilters {
            user_ids: Some(&[row.user_id]),
            course_module_completion_id: Some(row.course_module_completion_id),
            ..TeacherCreditRegistrationFilters::default()
        },
        i64::MAX,
        0,
    )
    .await
}
