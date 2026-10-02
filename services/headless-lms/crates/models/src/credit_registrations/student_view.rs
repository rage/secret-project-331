//! The ledger as the student surfaces show it.

use super::registration::is_waiting_for_enrolment;
use super::state::{CreditRegistrationErrorCode, CreditRegistrationState};
use crate::library::credit_registration::PendingPreconditions;
use crate::library::credit_registration::enrolment_check_schedule::EnrolmentCheckSource;
use crate::prelude::*;

/// One ledger row with the course, module and enrolment facts every student view needs, so a status
/// page is one query rather than a fan-out per row.
#[derive(Debug, Clone)]
pub struct StudentCreditRegistration {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_slug: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    /// The number frozen on the row before it was sent, which is the one a student would check a
    /// registration against; `None` until the row leaves `checking_enrolment`.
    pub student_number: Option<DbSecret>,
    pub credits: Option<f32>,
    pub grade_id: Option<String>,
    /// Needed to read `grade_id`: "1" is a pass on the pass/fail scale and a one out of five on the
    /// numeric one.
    pub grade_scale_id: Option<String>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    pub superseded_at: Option<DateTime<Utc>>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    /// When a check was last asked for; with `enrolment_checked_at`, what the limit on asking again
    /// counts from.
    pub enrolment_check_requested_at: Option<DateTime<Utc>>,
    pub no_usable_enrolment_since: Option<DateTime<Utc>>,
    pub enrolment_check_anchor_at: Option<DateTime<Utc>>,
    pub enrolment_check_source: EnrolmentCheckSource,
    /// Whether an enrolment has been settled on. True without `enrolment_realisation_name` where
    /// Suotar gave the realisation no name, so the step list ticks from this rather than the name.
    pub enrolment_resolved: bool,
    /// The name of the realisation we submitted against, not a Sisu id.
    pub enrolment_realisation_name: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    /// Sisu holds the assessment item attainment but not yet the course unit attainment.
    pub is_partially_registered: bool,
    /// Where a student with no usable enrolment is sent to enrol.
    pub enrolment_link: Option<String>,
    pub completion_eligible: bool,
    pub has_verified_student_number: bool,
    pub course_code_allowed: bool,
}

impl StudentCreditRegistration {
    /// What a `pending` row is waiting on, which is what its student-facing status is derived from.
    pub fn preconditions(&self) -> PendingPreconditions {
        PendingPreconditions {
            completion_eligible: self.completion_eligible,
            has_verified_student_number: self.has_verified_student_number,
            course_code_allowed: self.course_code_allowed,
        }
    }

    /// Whether the row has settled on an enrolment it can actually be registered against, which is
    /// the point past which the student's own answers about enrolling change nothing.
    ///
    /// Not `enrolment_resolved` on its own: an import the registry refused leaves the row in
    /// `no_usable_enrolment` still holding the enrolment it tried, and nothing ever clears
    /// `selected_enrolment_id`, so a student who has to go and enrol reads as resolved.
    pub fn has_usable_enrolment(&self) -> bool {
        self.enrolment_resolved && self.state != CreditRegistrationState::NoUsableEnrolment
    }

    /// See [`is_waiting_for_enrolment`].
    pub fn is_waiting_for_enrolment(&self) -> bool {
        is_waiting_for_enrolment(
            self.state,
            self.enrolment_check_anchor_at,
            self.no_usable_enrolment_since,
        )
    }

    /// Whether the row is parked with a check someone asked for still unanswered. The row stays in
    /// `no_usable_enrolment` for its checks, so this is what tells the asker one is under way.
    pub fn is_requested_check_unanswered(&self) -> bool {
        self.state == CreditRegistrationState::NoUsableEnrolment
            && self.enrolment_check_source.is_request()
    }
}

/// Narrows [`get_student_facing_by_user_id`]; the default returns every row of the user's.
#[derive(Debug, Default, Clone, Copy)]
pub struct StudentRegistrationFilter {
    pub course_module_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    /// Only rows the in-course re-enrol banner is owed: parked on a missing enrolment and not yet
    /// dismissed.
    pub enrolment_banner_due: bool,
}

/// The user's registrations as the student surfaces show them, newest completion first. Superseded
/// attempts are included: the student is entitled to see an earlier attempt Sisu may still hold.
pub async fn get_student_facing_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    filter: StudentRegistrationFilter,
) -> ModelResult<Vec<StudentCreditRegistration>> {
    let res = sqlx::query_as!(
        StudentCreditRegistration,
        r#"
SELECT cr.id,
  cr.course_id,
  c.name AS course_name,
  c.slug AS course_slug,
  cr.course_module_id,
  cm.name AS course_module_name,
  cm.uh_course_code,
  cm.ects_credits,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state,
  cr.error_code AS "error_code?",
  cr.next_attempt_at,
  cr.registered_at,
  cr.sisu_attainment_id,
  cr.student_number,
  cr.credits,
  cr.grade_id,
  cr.grade_scale_id,
  cr.attempt_number,
  cr.superseded_by_id,
  cr.superseded_at,
  cr.enrolment_checked_at,
  cr.enrolment_check_requested_at,
  cr.no_usable_enrolment_since,
  cr.enrolment_check_anchor_at,
  cr.enrolment_check_source,
  cr.selected_enrolment_id IS NOT NULL AS "enrolment_resolved!",
  COALESCE(
    cr.selected_enrolment_realisation_name->>'fi',
    cr.selected_enrolment_realisation_name->>'en',
    cr.selected_enrolment_realisation_name->>'sv'
  ) AS "enrolment_realisation_name?",
  cr.submitted_at,
  cr.partially_registered_at IS NOT NULL AS "is_partially_registered!",
  NULLIF(TRIM(cm.completion_registration_link_override), '') AS "enrolment_link?",
  p.completion_eligible AS "completion_eligible!",
  p.has_verified_student_number AS "has_verified_student_number!",
  p.course_code_allowed AS "course_code_allowed!"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id AND c.deleted_at IS NULL
  JOIN course_modules cm ON cm.id = cr.course_module_id AND cm.deleted_at IS NULL
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id AND cmc.deleted_at IS NULL
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
WHERE cr.user_id = $1
  AND cr.deleted_at IS NULL
  AND ($2::uuid IS NULL OR cr.course_module_id = $2)
  AND ($3::uuid IS NULL OR cr.course_id = $3)
  AND (
    NOT $4::boolean
    OR (
      cr.state = 'no_usable_enrolment'
      AND cr.enrolment_banner_dismissed_at IS NULL
    )
  )
ORDER BY cmc.completion_date DESC,
  cr.attempt_number DESC
        "#,
        user_id,
        filter.course_module_id,
        filter.course_id,
        filter.enrolment_banner_due,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The student dismissed the in-course-material re-enrol banner for this registration.
pub async fn dismiss_enrolment_banner(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET enrolment_banner_dismissed_at = now()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
        "#,
        id,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
