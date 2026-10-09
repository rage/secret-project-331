//! The ledger as the admin explorer and the reconciliation detectors read it, across courses.

use std::collections::BTreeMap;

use super::registration::{CreditRegistration, is_waiting_for_enrolment};
use super::state::{CreditRegistrationErrorCode, CreditRegistrationState, ResubmissionFacts};
use super::teacher_view::search_pattern_of;
use crate::credit_registration_enrolment_routes::CreditRegistrationEnrolmentRoute;
use crate::library::credit_registration::enrolment_check_schedule::EnrolmentCheckSource;
use crate::library::credit_registration::timeline::{
    Engagement, StepMatch, TimelinePosition, TimelineStep,
};
use crate::library::credit_registration::{CreditRegistrationPendingReason, PendingPreconditions};
use crate::prelude::*;
use crate::verified_student_numbers::StudentNumberVerificationMethod;

/// One ledger row as an admin sees it: every identifier support needs to answer "what happened to
/// this student", across courses.
///
/// Not the study registry's own error text: it is written for an integrator, may name a person and
/// is untranslated. The error code and the scrubbed call bodies stand in for it.
#[derive(Debug, Clone)]
pub struct AdminCreditRegistration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// In full: the admin view exists to resolve support cases, which starts from the address.
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub state_changed_at: DateTime<Utc>,
    pub phase_started_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
    /// Frozen on the row when it left `checking_enrolment`, so it is what we actually sent.
    pub student_number: Option<DbSecret>,
    pub sisu_person_id: Option<DbSecret>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub submitted_attainment_id: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    /// The account's live link now, which may differ from the number frozen on the row.
    pub verified_student_number: Option<DbSecret>,
    pub verified_student_number_at: Option<DateTime<Utc>>,
    pub verified_student_number_via: Option<StudentNumberVerificationMethod>,
    pub resubmit_not_before: Option<DateTime<Utc>>,
    pub partially_registered_at: Option<DateTime<Utc>>,
    pub not_registered_reimport_count: i32,
    pub no_usable_enrolment_since: Option<DateTime<Utc>>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    pub enrolment_check_anchor_at: Option<DateTime<Utc>>,
    pub enrolment_check_due_at: Option<DateTime<Utc>>,
    pub enrolment_checks_stopped_at: Option<DateTime<Utc>>,
    pub completion_eligible: bool,
    pub has_verified_student_number: bool,
    pub course_code_allowed: bool,
    /// The student's latest "I have enrolled" press for the completion.
    pub pressed_at: Option<DateTime<Utc>>,
    pub enrolment_route: Option<CreditRegistrationEnrolmentRoute>,
    pub last_visited_at: Option<DateTime<Utc>>,
    /// The page's total row count, so a caller can read it off the first row instead of a second
    /// query.
    pub total_count: i64,
}

impl AdminCreditRegistration {
    /// What decides whether a human may move this row; see [`ResubmissionFacts`].
    pub fn resubmission_facts(&self) -> ResubmissionFacts {
        ResubmissionFacts {
            state: self.state,
            is_superseded: self.superseded_by_id.is_some(),
            error_code: self.error_code,
            resubmit_not_before: self.resubmit_not_before,
            submitted_at: self.submitted_at,
        }
    }

    /// See [`is_waiting_for_enrolment`].
    pub fn is_waiting_for_enrolment(&self) -> bool {
        is_waiting_for_enrolment(
            self.state,
            self.enrolment_check_anchor_at,
            self.no_usable_enrolment_since,
        )
    }

    /// What a `pending` row is waiting on, as the row's precondition flags say.
    pub fn preconditions(&self) -> PendingPreconditions {
        PendingPreconditions {
            completion_eligible: self.completion_eligible,
            has_verified_student_number: self.has_verified_student_number,
            course_code_allowed: self.course_code_allowed,
        }
    }

    /// Where the row stands on the admin timeline.
    pub fn position(&self) -> TimelinePosition {
        TimelinePosition::of(
            self.state,
            self.preconditions(),
            self.selected_enrolment_id.is_some(),
            Engagement::of(self.pressed_at, self.last_visited_at),
        )
    }

    /// When the row entered its current phase. A row held for its course code moved there from
    /// waiting for a student number when the number was linked, which changed no state.
    pub fn phase_started_at(&self) -> DateTime<Utc> {
        match self.position().step {
            TimelineStep::HeldForCourseCode => self
                .verified_student_number_at
                .map_or(self.phase_started_at, |linked_at| {
                    linked_at.max(self.phase_started_at)
                }),
            _ => self.phase_started_at,
        }
    }

    /// What this row is waiting on, or `None` where it is not waiting at all: outside `pending` the
    /// preconditions say nothing about why the row is where it is.
    pub fn pending_reason(&self) -> Option<CreditRegistrationPendingReason> {
        (self.state == CreditRegistrationState::Pending)
            .then(|| self.preconditions().reason())
            .flatten()
    }
}

/// How the explorer orders a page. Descending only: an ops table is read newest-worst first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AdminCreditRegistrationSort {
    #[default]
    LastActivity,
    Created,
    TimeInState,
    Attempts,
}

impl AdminCreditRegistrationSort {
    /// Bound into the query's `ORDER BY` as a `text` parameter.
    fn as_str(self) -> &'static str {
        match self {
            Self::LastActivity => "last_activity",
            Self::Created => "created",
            Self::TimeInState => "time_in_state",
            Self::Attempts => "attempts",
        }
    }
}

/// The narrowings the admin explorer applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct AdminCreditRegistrationFilters<'a> {
    pub states: Option<&'a [CreditRegistrationState]>,
    pub error_codes: Option<&'a [CreditRegistrationErrorCode]>,
    pub course_id: Option<Uuid>,
    pub course_module_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub student_number: Option<&'a str>,
    /// Rows at one of these timeline steps. Empty means no narrowing. A row waiting for a student
    /// number matches only if it completed since `account_linking_since`, as the linking page and
    /// [`count_by_step_and_engagement`] count them.
    pub steps: &'a [TimelineStep],
    /// Rows with one of these engagements, at steps that wait on the student. Empty means no
    /// narrowing.
    pub engagements: &'a [Engagement],
    /// Leaves out not-started rows at steps that wait on the student.
    pub hide_not_started: bool,
    pub account_linking_since: Option<DateTime<Utc>>,
    /// Listed first, in the sort order among themselves.
    pub first_ids: Option<&'a [Uuid]>,
    pub submitted_after: Option<DateTime<Utc>>,
    pub submitted_before: Option<DateTime<Utc>>,
    /// Matched against the student's name and email, either student number, the attainment ids and
    /// the stored error text. Searching that text is not rendering it.
    pub search: Option<&'a str>,
    /// A uuid typed into the search box: a registration, a user or a completion id. Ambiguous by
    /// design, for a human's paste. A caller that already knows which single field it means should
    /// use `id` or `course_module_completion_id` instead, not this plus a Rust-side filter.
    pub search_id: Option<Uuid>,
    /// Exactly one registration.
    pub id: Option<Uuid>,
    /// Every attempt against one completion.
    pub course_module_completion_id: Option<Uuid>,
    /// An exact set of rows, for a caller that already knows which ones it wants.
    pub credit_registration_ids: Option<&'a [Uuid]>,
    /// Off by default, or a course that regrades shows two rows per student.
    pub include_superseded: bool,
}

/// The query behind [`get_admin_facing`]. `total_count` is computed before the limit, so every row
/// of a page carries the count of the whole filtered ledger.
async fn admin_facing_page(
    conn: &mut PgConnection,
    filters: &AdminCreditRegistrationFilters<'_>,
    sort: AdminCreditRegistrationSort,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<AdminCreditRegistration>> {
    let search_pattern = filters.search.map(search_pattern_of);
    let step_match = StepMatch::all();
    let res = sqlx::query_as!(
        AdminCreditRegistration,
        r#"
SELECT cr.id,
  cr.created_at,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.course_instance_id,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state,
  cr.state_entered_at,
  cr.state_changed_at,
  cr.phase_started_at,
  cr.error_code AS "error_code?",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.last_attempt_at,
  cr.submitted_at,
  cr.registered_at,
  cr.terminal_at,
  cr.student_number,
  cr.sisu_person_id,
  cr.uh_course_code,
  cr.selected_enrolment_id,
  cr.grade_scale_id,
  cr.grade_id,
  cr.credits,
  cr.submitted_attainment_id,
  cr.sisu_attainment_id,
  cr.submit_retry_count,
  cr.verify_attempt_count,
  cr.attempt_number,
  cr.superseded_by_id,
  vsn.student_number AS "verified_student_number?",
  vsn.verified_at AS "verified_student_number_at?",
  vsn.verified_via AS "verified_student_number_via?",
  cr.resubmit_not_before,
  cr.partially_registered_at,
  cr.not_registered_reimport_count,
  cr.no_usable_enrolment_since,
  cr.enrolment_checked_at,
  cr.enrolment_check_anchor_at,
  cr.enrolment_check_due_at,
  cr.enrolment_checks_stopped_at,
  p.completion_eligible AS "completion_eligible!",
  p.has_verified_student_number AS "has_verified_student_number!",
  p.course_code_allowed AS "course_code_allowed!",
  route.enrolment_confirmed_at AS "pressed_at?",
  route.route AS "enrolment_route?: CreditRegistrationEnrolmentRoute",
  sig.last_visited_at AS "last_visited_at?",
  COUNT(*) OVER () AS "total_count!"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
  LEFT JOIN credit_registration_enrolment_routes route ON route.course_module_completion_id = cr.course_module_completion_id
  AND route.deleted_at IS NULL
  LEFT JOIN credit_registration_enrolment_check_signals sig ON sig.course_module_completion_id = cr.course_module_completion_id
  AND sig.deleted_at IS NULL
  -- The step and engagement are computed exactly as in count_by_step_and_engagement, so a list
  -- filtered to a step and engagement holds as many rows as that function counts.
  LEFT JOIN LATERAL (
    SELECT m.step
    FROM UNNEST(
        $19::credit_registration_state [],
        $20::boolean [],
        $21::boolean [],
        $22::boolean [],
        $23::boolean [],
        $24::credit_registration_timeline_step []
      ) AS m(
        state,
        completion_eligible,
        has_verified_student_number,
        course_code_allowed,
        enrolment_resolved,
        step
      )
    WHERE m.state = cr.state
      AND m.completion_eligible = p.completion_eligible
      AND m.has_verified_student_number = p.has_verified_student_number
      AND m.course_code_allowed = p.course_code_allowed
      AND m.enrolment_resolved = (cr.selected_enrolment_id IS NOT NULL)
  ) ts ON TRUE
  CROSS JOIN LATERAL (
    SELECT CASE
        WHEN ts.step = ANY($25::credit_registration_timeline_step []) THEN CASE
          WHEN route.enrolment_confirmed_at IS NOT NULL THEN 'pressed'::credit_registration_engagement
          WHEN sig.last_visited_at IS NOT NULL THEN 'visited'::credit_registration_engagement
          ELSE 'not_started'::credit_registration_engagement
        END
      END AS engagement,
      ts.step = 'waiting_for_student_number'
      AND cmc.completion_date < $29::timestamptz AS is_before_linking
  ) eng
WHERE cr.deleted_at IS NULL
  AND ($1::bool OR cr.superseded_by_id IS NULL)
  AND (
    $2::credit_registration_state [] IS NULL
    OR cr.state = ANY($2)
  )
  AND (
    $3::credit_registration_error_code [] IS NULL
    OR cr.error_code = ANY($3)
  )
  AND ($4::uuid IS NULL OR cr.course_id = $4)
  AND ($5::uuid IS NULL OR cr.course_module_id = $5)
  AND ($6::uuid IS NULL OR cr.user_id = $6)
  AND (
    $7::text IS NULL
    OR cr.student_number = $7
    OR vsn.student_number = $7
  )
  AND (
    CARDINALITY($8::credit_registration_timeline_step []) = 0
    OR (
      ts.step = ANY($8)
      AND eng.is_before_linking IS NOT TRUE
    )
  )
  AND (
    CARDINALITY($26::credit_registration_engagement []) = 0
    OR eng.engagement = ANY($26)
  )
  AND (
    NOT $27::bool
    OR eng.engagement IS DISTINCT FROM 'not_started'
  )
  AND ($9::timestamptz IS NULL OR cr.submitted_at >= $9)
  AND ($10::timestamptz IS NULL OR cr.submitted_at <= $10)
  AND (
    $11::text IS NULL
    OR ud.name_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.submitted_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.sisu_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.error_message) LIKE '%' || $11 || '%' ESCAPE '\'
  )
  AND (
    $12::uuid IS NULL
    OR cr.id = $12
    OR cr.user_id = $12
    OR cr.course_module_completion_id = $12
  )
  AND (
    $13::uuid [] IS NULL
    OR cr.id = ANY($13)
  )
  AND ($17::uuid IS NULL OR cr.id = $17)
  AND (
    $18::uuid IS NULL
    OR cr.course_module_completion_id = $18
  )
ORDER BY COALESCE(cr.id = ANY($28::uuid []), FALSE) DESC,
  CASE
    WHEN $14::text = 'attempts' THEN cr.submit_retry_count + cr.verify_attempt_count
  END DESC NULLS LAST,
  CASE $14::text
    WHEN 'created' THEN cr.created_at
    WHEN 'time_in_state' THEN cr.state_changed_at
    ELSE COALESCE(cr.last_attempt_at, cr.state_entered_at)
  END DESC,
  cr.id
LIMIT $15 OFFSET $16
        "#,
        filters.include_superseded,
        filters.states as Option<&[CreditRegistrationState]>,
        filters.error_codes as Option<&[CreditRegistrationErrorCode]>,
        filters.course_id,
        filters.course_module_id,
        filters.user_id,
        filters.student_number,
        filters.steps as &[TimelineStep],
        filters.submitted_after,
        filters.submitted_before,
        search_pattern.as_deref(),
        filters.search_id,
        filters.credit_registration_ids as Option<&[Uuid]>,
        sort.as_str(),
        limit,
        offset,
        filters.id,
        filters.course_module_completion_id,
        &step_match.states as &[CreditRegistrationState],
        &step_match.completion_eligible,
        &step_match.has_verified_student_number,
        &step_match.course_code_allowed,
        &step_match.enrolment_resolved,
        &step_match.steps as &[TimelineStep],
        &TimelineStep::ENGAGEMENT_STEPS as &[TimelineStep],
        filters.engagements as &[Engagement],
        filters.hide_not_started,
        filters.first_ids as Option<&[Uuid]>,
        filters.account_linking_since,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// A page of the ledger for the admin explorer, cross-course.
pub async fn get_admin_facing(
    conn: &mut PgConnection,
    filters: &AdminCreditRegistrationFilters<'_>,
    sort: AdminCreditRegistrationSort,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<AdminCreditRegistration>> {
    admin_facing_page(conn, filters, sort, limit, offset).await
}

/// Live rows of one module at one step, with one engagement where the step waits on the student.
#[derive(Debug, Clone, PartialEq)]
pub struct StepCount {
    pub course_module_id: Uuid,
    pub step: TimelineStep,
    pub engagement: Option<Engagement>,
    pub count: i64,
}

/// Live rows per module, step and engagement: the overview's "Where registrations stand", the
/// Courses tab's per-module table and the daily snapshot.
///
/// Counts exactly what [`get_admin_facing`] lists filtered to the same step, engagement and module,
/// superseded rows left out: a row waiting for a student number is counted only if it completed
/// since `account_linking_since`.
pub async fn count_by_step_and_engagement(
    conn: &mut PgConnection,
    account_linking_since: Option<DateTime<Utc>>,
) -> ModelResult<Vec<StepCount>> {
    let step_match = StepMatch::all();
    let res = sqlx::query_as!(
        StepCount,
        r#"
SELECT cr.course_module_id,
  ts.step AS "step!: TimelineStep",
  eng.engagement AS "engagement?: Engagement",
  COUNT(*) AS "count!"
FROM credit_registrations cr
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
  LEFT JOIN credit_registration_enrolment_routes route ON route.course_module_completion_id = cr.course_module_completion_id
  AND route.deleted_at IS NULL
  LEFT JOIN credit_registration_enrolment_check_signals sig ON sig.course_module_completion_id = cr.course_module_completion_id
  AND sig.deleted_at IS NULL
  -- Computed exactly as in admin_facing_page; see there.
  JOIN LATERAL (
    SELECT m.step
    FROM UNNEST(
        $1::credit_registration_state [],
        $2::boolean [],
        $3::boolean [],
        $4::boolean [],
        $5::boolean [],
        $6::credit_registration_timeline_step []
      ) AS m(
        state,
        completion_eligible,
        has_verified_student_number,
        course_code_allowed,
        enrolment_resolved,
        step
      )
    WHERE m.state = cr.state
      AND m.completion_eligible = p.completion_eligible
      AND m.has_verified_student_number = p.has_verified_student_number
      AND m.course_code_allowed = p.course_code_allowed
      AND m.enrolment_resolved = (cr.selected_enrolment_id IS NOT NULL)
  ) ts ON TRUE
  CROSS JOIN LATERAL (
    SELECT CASE
        WHEN ts.step = ANY($7::credit_registration_timeline_step []) THEN CASE
          WHEN route.enrolment_confirmed_at IS NOT NULL THEN 'pressed'::credit_registration_engagement
          WHEN sig.last_visited_at IS NOT NULL THEN 'visited'::credit_registration_engagement
          ELSE 'not_started'::credit_registration_engagement
        END
      END AS engagement,
      ts.step = 'waiting_for_student_number'
      AND cmc.completion_date < $8::timestamptz AS is_before_linking
  ) eng
WHERE cr.deleted_at IS NULL
  AND cr.superseded_by_id IS NULL
  AND eng.is_before_linking IS NOT TRUE
GROUP BY cr.course_module_id,
  ts.step,
  eng.engagement
        "#,
        &step_match.states as &[CreditRegistrationState],
        &step_match.completion_eligible,
        &step_match.has_verified_student_number,
        &step_match.course_code_allowed,
        &step_match.enrolment_resolved,
        &step_match.steps as &[TimelineStep],
        &TimelineStep::ENGAGEMENT_STEPS as &[TimelineStep],
        account_linking_since,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// [`count_by_step_and_engagement`]'s rows summed over modules, in timeline order.
pub fn sum_step_counts_over_modules<'a>(
    rows: impl IntoIterator<Item = &'a StepCount>,
) -> BTreeMap<(TimelineStep, Option<Engagement>), i64> {
    let mut totals = BTreeMap::new();
    for row in rows {
        *totals.entry((row.step, row.engagement)).or_insert(0) += row.count;
    }
    totals
}

/// Live rows in each of the given states, newest activity first within each state, for the
/// Reconciliation lists. `limit_per_state` caps every state independently, via `ROW_NUMBER`, so one
/// state with many rows cannot crowd another out of a shared `LIMIT`.
pub async fn get_live_by_states(
    conn: &mut PgConnection,
    states: &[CreditRegistrationState],
    limit_per_state: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT cr.*
FROM credit_registrations cr
  JOIN (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY state
        ORDER BY state_entered_at DESC
      ) AS rn
    FROM credit_registrations
    WHERE state = ANY($1)
      AND superseded_by_id IS NULL
      AND deleted_at IS NULL
  ) ranked ON ranked.id = cr.id
WHERE ranked.rn <= $2
ORDER BY cr.state_entered_at DESC
        "#,
        states as &[CreditRegistrationState],
        limit_per_state,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// What the student did and when, around one registration's completion, for the admin timeline.
#[derive(Debug, Clone, PartialEq)]
pub struct AdminRegistrationJourney {
    /// When they first picked any language version of the course.
    pub course_started_at: Option<DateTime<Utc>>,
    /// When the completion's page signals were first recorded: the first visit, unless a check
    /// request came first.
    pub first_visited_at: Option<DateTime<Utc>>,
    pub last_visited_at: Option<DateTime<Utc>>,
    pub last_check_requested_at: Option<DateTime<Utc>>,
    pub check_request_source: Option<EnrolmentCheckSource>,
    pub enrolment_route: Option<CreditRegistrationEnrolmentRoute>,
    pub pressed_at: Option<DateTime<Utc>>,
    /// Sisu's own enrolment time, from the latest enrolment check that found it.
    pub checked_enrolled_at: Option<DateTime<Utc>>,
    /// Sisu's own enrolment time as the selected enrolment's lookup answer gave it, unparsed.
    pub selected_enrolment_date_time: Option<String>,
}

/// The journey around `credit_registration_id`'s completion. `None` for no such live row.
pub async fn get_registration_journey(
    conn: &mut PgConnection,
    credit_registration_id: Uuid,
) -> ModelResult<Option<AdminRegistrationJourney>> {
    let res = sqlx::query_as!(
        AdminRegistrationJourney,
        r#"
SELECT ucs.created_at AS "course_started_at?",
  CASE
    WHEN sig.last_visited_at IS NOT NULL THEN LEAST(sig.created_at, sig.last_visited_at)
  END AS "first_visited_at?",
  sig.last_visited_at AS "last_visited_at?",
  sig.last_check_requested_at AS "last_check_requested_at?",
  sig.check_request_source AS "check_request_source?: EnrolmentCheckSource",
  route.route AS "enrolment_route?: CreditRegistrationEnrolmentRoute",
  route.enrolment_confirmed_at AS "pressed_at?",
  (
    SELECT o.enrolled_at
    FROM credit_registration_enrolment_check_outcomes o
      JOIN credit_registrations attempt ON attempt.id = o.credit_registration_id
    WHERE attempt.course_module_completion_id = cr.course_module_completion_id
      AND o.is_enrolment_found
      AND o.enrolled_at IS NOT NULL
    ORDER BY o.checked_at DESC
    LIMIT 1
  ) AS "checked_enrolled_at?",
  (
    SELECT found.value #>> '{}'
    FROM credit_registration_events e
      CROSS JOIN LATERAL jsonb_path_query_first(
        e.details,
        'lax $.** ? (@.id == $id).enrolmentDateTime',
        jsonb_build_object('id', cr.selected_enrolment_id)
      ) AS found(value)
    WHERE e.credit_registration_id = cr.id
      AND e.deleted_at IS NULL
      AND cr.selected_enrolment_id IS NOT NULL
      AND found.value IS NOT NULL
    ORDER BY e.created_at DESC
    LIMIT 1
  ) AS "selected_enrolment_date_time?"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  LEFT JOIN user_course_settings ucs ON ucs.user_id = cr.user_id
  AND ucs.course_language_group_id = c.course_language_group_id
  AND ucs.deleted_at IS NULL
  LEFT JOIN credit_registration_enrolment_check_signals sig ON sig.course_module_completion_id = cr.course_module_completion_id
  AND sig.deleted_at IS NULL
  LEFT JOIN credit_registration_enrolment_routes route ON route.course_module_completion_id = cr.course_module_completion_id
  AND route.deleted_at IS NULL
WHERE cr.id = $1
  AND cr.deleted_at IS NULL
        "#,
        credit_registration_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}
