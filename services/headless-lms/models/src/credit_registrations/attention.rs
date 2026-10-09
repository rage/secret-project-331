//! The Needs attention queue: which live rows want a person, why, and which of them a blocking
//! problem, a dismissal or a timing threshold alone accounts for.
//!
//! One query finds every row any detector picks; [`AttentionStanding`] then sorts each into
//! exactly one section. Every count of "needs attention" (tab badge, overview, Courses column,
//! Registrations filter, daily snapshot) is [`count_needing_attention`] or a grouping of the same
//! rows, so none can disagree.

use chrono::TimeDelta;
use utoipa::ToSchema;

use super::metrics::StuckThresholds;
use super::state::{CreditRegistrationErrorCode, CreditRegistrationState, ResubmissionFacts};
use crate::credit_registration_enrolment_routes::CreditRegistrationEnrolmentRoute;
use crate::library::credit_registration::PendingPreconditions;
use crate::library::credit_registration::backoff::{
    NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD, PARTIAL_REGISTRATION_ADMIN_AFTER, VERIFY_MAX_AGE,
};
use crate::library::credit_registration::classification::{Retryability, retryability};
use crate::library::credit_registration::timeline::{Engagement, TimelinePosition};
use crate::prelude::*;

/// Resends after which retrying is not the answer. Verify polls do not count: confirming routinely
/// takes many.
pub const TOO_MANY_SUBMIT_RETRIES: i32 = 5;

/// How long after an "I have enrolled" press a fetch of the code's enrolment list must have started
/// for a missing linking email to mean the student is stuck. Above the longest press-to-list delay
/// seen in production (56 min).
pub const STUDENT_NUMBER_STUCK_AFTER_PRESS: TimeDelta = TimeDelta::minutes(60);

/// Why a row is picked. A row can carry several.
#[derive(
    Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, Hash, Type, ToSchema,
)]
#[sqlx(
    type_name = "credit_registration_attention_reason",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
// The API has always called it this; the short name is for Rust callers, who have the module.
#[schema(as = CreditRegistrationAttentionReason)]
pub enum AttentionReason {
    /// Past its state's threshold with the pipeline still owning it. The only reason with no
    /// person-level cause: a row carrying nothing else is running late, not needing attention.
    StuckInState,
    /// `failed_permanent` with the pipeline's flag up, for any code but `retry_window_expired`.
    PermanentError,
    RetryWindowExpired,
    Misregistered,
    /// Resent [`TOO_MANY_SUBMIT_RETRIES`] times and not finished.
    TooManyAttempts,
    /// `submission_uncertain`: never retried automatically, and never in bulk.
    OutcomeUncertain,
    PartlyRegisteredOverdue,
    /// Verify has polled past its window without the course unit attainment showing up.
    VerificationGaveUp,
    /// Suotar has lost the submission [`NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD`] times.
    RepeatedlyNotRegistered,
    /// Pressed "I have enrolled", and a fetch of the code's enrolment list that could have claimed
    /// a linking email started [`STUDENT_NUMBER_STUCK_AFTER_PRESS`] after the press, yet no linking
    /// email has gone out on the code since, or that fetch found people who enrolled before account
    /// linking began and were never mailed, whom the student may be among. Measured in fetches so a
    /// paused pipeline does not count against the student.
    StudentNumberStuck,
    /// The pipeline's flag is up and no other reason explains it.
    FlaggedByPipeline,
}

impl AttentionReason {
    /// Whether the reason puts a row in the Needs attention count; see [`AttentionStanding`].
    pub fn is_person_level(self) -> bool {
        self != Self::StuckInState
    }
}

/// Which section of the Needs attention tab a picked row belongs to. Exactly one per row.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AttentionStanding {
    /// Counted in the badge.
    NeedsAttention,
    /// Over a timing threshold with no person-level cause; not in the badge.
    RunningLate,
    /// Every reason it carries is one an admin dismissed.
    Dismissed,
    /// A blocking problem accounts for every reason it carries, so it is listed under that problem
    /// instead of in the badge.
    ExplainedByProblem,
}

/// What kind of thing a [`BlockingProblem`] is, which decides what its `subject` names.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum BlockingProblemKind {
    /// A processing phase is paused or its heartbeat is late. The subject is the phase name.
    ProcessingPhaseStopped,
    /// The course code's enrolment list keeps failing to arrive. The subject is the course code.
    CourseCodeFailing,
    /// The module fails its configuration check. The subject is the course module id.
    ModuleMisconfigured,
}

/// A problem that holds up many registrations at once.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Hash, ToSchema)]
pub struct BlockingProblem {
    pub kind: BlockingProblemKind,
    pub subject: String,
}

/// A processing phase that is paused or late.
#[derive(Debug, Clone, PartialEq)]
pub struct StoppedPhase {
    pub phase: String,
    /// The states whose rows wait on the phase to move.
    pub owned_states: Vec<CreditRegistrationState>,
    /// Whether it is one of the phases a waiting student's linking email goes out through.
    pub sends_linking_emails: bool,
}

/// The problems currently holding up many rows at once, as the alert rules see them.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct BlockingProblems {
    pub stopped_phases: Vec<StoppedPhase>,
    pub failing_course_codes: Vec<String>,
    pub misconfigured_module_ids: Vec<Uuid>,
}

/// Whether what stopped a row carrying `error_code` is the module's configuration rather than
/// anything support can fix.
pub fn needs_course_setup(error_code: Option<CreditRegistrationErrorCode>) -> bool {
    error_code.is_some_and(|code| retryability(code) == Retryability::PermanentNeedsConfig)
}

/// Everything that decides which rows are picked and where each lands.
#[derive(Debug, Clone, PartialEq)]
pub struct AttentionRules {
    pub thresholds: StuckThresholds,
    /// Only completions since then can be stuck waiting for a student number; `None` means account
    /// linking is off and nobody can.
    pub account_linking_since: Option<DateTime<Utc>>,
    pub blocking: BlockingProblems,
}

/// One live row at least one detector picked.
#[derive(Debug, Clone)]
pub struct AttentionRegistration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    /// The module's code now, trimmed; not the one frozen on the row.
    pub uh_course_code: Option<String>,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_changed_at: DateTime<Utc>,
    pub phase_started_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub attempt_count: i32,
    /// The pipeline's own flag. On its own it is only [`AttentionReason::FlaggedByPipeline`].
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub resubmit_not_before: Option<DateTime<Utc>>,
    pub student_number: Option<DbSecret>,
    pub completion_eligible: bool,
    pub has_verified_student_number: bool,
    pub course_code_allowed: bool,
    pub enrolment_resolved: bool,
    /// The student's latest "I have enrolled" press.
    pub pressed_at: Option<DateTime<Utc>>,
    pub enrolment_route: Option<CreditRegistrationEnrolmentRoute>,
    pub last_visited_at: Option<DateTime<Utc>>,
    /// When the code's latest fetch that could claim linking mail started.
    pub last_mailing_fetch_started_at: Option<DateTime<Utc>>,
    /// The code's last enrolment list listed nobody.
    pub is_enrolment_list_empty: bool,
    /// See [`crate::credit_registration_roster_schedules::RosterSchedule::unlinked_enrolled_before_count`].
    pub unlinked_enrolled_before_count: Option<i32>,
    pub reasons: Vec<AttentionReason>,
    pub dismissed_reasons: Option<Vec<AttentionReason>>,
    pub dismissed_at: Option<DateTime<Utc>>,
    pub dismissed_by_user_id: Option<Uuid>,
    pub dismissal_reason: Option<String>,
}

impl AttentionRegistration {
    /// What decides whether a human may move this row; see [`ResubmissionFacts`]. The queue never
    /// holds a superseded row.
    pub fn resubmission_facts(&self) -> ResubmissionFacts {
        ResubmissionFacts {
            state: self.state,
            is_superseded: false,
            error_code: self.error_code,
            resubmit_not_before: self.resubmit_not_before,
            submitted_at: self.submitted_at,
        }
    }

    /// Where the row stands on the admin timeline.
    pub fn position(&self) -> TimelinePosition {
        TimelinePosition::of(
            self.state,
            PendingPreconditions {
                completion_eligible: self.completion_eligible,
                has_verified_student_number: self.has_verified_student_number,
                course_code_allowed: self.course_code_allowed,
            },
            self.enrolment_resolved,
            Engagement::of(self.pressed_at, self.last_visited_at),
        )
    }

    /// See [`needs_course_setup`].
    pub fn needs_course_setup(&self) -> bool {
        needs_course_setup(self.error_code)
    }

    /// The problem that accounts for every reason this row carries, if one does.
    pub fn blocking_problem(&self, problems: &BlockingProblems) -> Option<BlockingProblem> {
        let explains_all = |explains: &dyn Fn(AttentionReason) -> bool| {
            !self.reasons.is_empty() && self.reasons.iter().all(|reason| explains(*reason))
        };
        for phase in &problems.stopped_phases {
            let explains = |reason: AttentionReason| match reason {
                AttentionReason::StuckInState => phase.owned_states.contains(&self.state),
                AttentionReason::StudentNumberStuck => phase.sends_linking_emails,
                _ => false,
            };
            if explains_all(&explains) {
                return Some(BlockingProblem {
                    kind: BlockingProblemKind::ProcessingPhaseStopped,
                    subject: phase.phase.clone(),
                });
            }
        }
        if let Some(code) = self
            .uh_course_code
            .as_ref()
            .filter(|code| problems.failing_course_codes.contains(code))
            && explains_all(&|reason| reason == AttentionReason::StudentNumberStuck)
        {
            return Some(BlockingProblem {
                kind: BlockingProblemKind::CourseCodeFailing,
                subject: code.clone(),
            });
        }
        if problems
            .misconfigured_module_ids
            .contains(&self.course_module_id)
            && self.needs_course_setup()
            && explains_all(&|reason| {
                matches!(
                    reason,
                    AttentionReason::PermanentError | AttentionReason::FlaggedByPipeline
                )
            })
        {
            return Some(BlockingProblem {
                kind: BlockingProblemKind::ModuleMisconfigured,
                subject: self.course_module_id.to_string(),
            });
        }
        None
    }

    /// A dismissal holds while every reason the row carries is one it covered.
    pub fn is_dismissed(&self) -> bool {
        self.dismissed_reasons
            .as_ref()
            .is_some_and(|dismissed| self.reasons.iter().all(|reason| dismissed.contains(reason)))
    }

    /// Which Needs attention section the row is listed in under `problems`.
    pub fn standing(&self, problems: &BlockingProblems) -> AttentionStanding {
        if self.is_dismissed() {
            AttentionStanding::Dismissed
        } else if self.blocking_problem(problems).is_some() {
            AttentionStanding::ExplainedByProblem
        } else if self.reasons.iter().any(|reason| reason.is_person_level()) {
            AttentionStanding::NeedsAttention
        } else {
            AttentionStanding::RunningLate
        }
    }
}

/// Every live row at least one detector picks, oldest phase start first, narrowed to `only_ids`
/// when given. Superseded rows are outside every detector: acting on a replaced attempt is never
/// right.
pub async fn get_attention_items(
    conn: &mut PgConnection,
    rules: &AttentionRules,
    only_ids: Option<&[Uuid]>,
) -> ModelResult<Vec<AttentionRegistration>> {
    let (state_thresholds, threshold_secs) = rules.thresholds.state_seconds_arrays();
    let res = sqlx::query_as!(
        AttentionRegistration,
        r#"
SELECT cr.id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  cr.course_module_id,
  cm.name AS course_module_name,
  NULLIF(TRIM(cm.uh_course_code), '') AS uh_course_code,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state,
  cr.state_changed_at,
  cr.phase_started_at,
  cr.error_code AS "error_code?",
  cr.submit_retry_count + cr.verify_attempt_count AS "attempt_count!",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.submitted_at,
  cr.resubmit_not_before,
  cr.student_number,
  p.completion_eligible AS "completion_eligible!",
  p.has_verified_student_number AS "has_verified_student_number!",
  p.course_code_allowed AS "course_code_allowed!",
  cr.selected_enrolment_id IS NOT NULL AS "enrolment_resolved!",
  route.enrolment_confirmed_at AS "pressed_at?",
  route.route AS "enrolment_route?: CreditRegistrationEnrolmentRoute",
  sig.last_visited_at AS "last_visited_at?",
  s.last_mailing_fetch_started_at AS "last_mailing_fetch_started_at?",
  COALESCE(s.last_listed_person_count = 0, FALSE) AS "is_enrolment_list_empty!",
  s.linking_unlinked_enrolled_before_count AS "unlinked_enrolled_before_count?",
  ARRAY_REMOVE(
    ARRAY [
      CASE WHEN d.stuck_in_state THEN 'stuck_in_state'::credit_registration_attention_reason END,
      CASE WHEN d.permanent_error THEN 'permanent_error'::credit_registration_attention_reason END,
      CASE WHEN d.retry_window_expired THEN 'retry_window_expired'::credit_registration_attention_reason END,
      CASE WHEN d.misregistered THEN 'misregistered'::credit_registration_attention_reason END,
      CASE WHEN d.too_many_attempts THEN 'too_many_attempts'::credit_registration_attention_reason END,
      CASE WHEN d.outcome_uncertain THEN 'outcome_uncertain'::credit_registration_attention_reason END,
      CASE WHEN d.partly_registered_overdue THEN 'partly_registered_overdue'::credit_registration_attention_reason END,
      CASE WHEN d.verification_gave_up THEN 'verification_gave_up'::credit_registration_attention_reason END,
      CASE WHEN d.repeatedly_not_registered THEN 'repeatedly_not_registered'::credit_registration_attention_reason END,
      CASE WHEN d.student_number_stuck THEN 'student_number_stuck'::credit_registration_attention_reason END,
      CASE WHEN flagged.only_flag THEN 'flagged_by_pipeline'::credit_registration_attention_reason END
    ],
    NULL
  ) AS "reasons!: Vec<AttentionReason>",
  dis.dismissed_reasons AS "dismissed_reasons?: Vec<AttentionReason>",
  dis.created_at AS "dismissed_at?",
  dis.dismissed_by_user_id AS "dismissed_by_user_id?",
  dis.reason AS "dismissal_reason?"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN credit_registration_enrolment_routes route ON route.course_module_completion_id = cr.course_module_completion_id
  AND route.deleted_at IS NULL
  LEFT JOIN credit_registration_enrolment_check_signals sig ON sig.course_module_completion_id = cr.course_module_completion_id
  AND sig.deleted_at IS NULL
  LEFT JOIN credit_registration_roster_schedules s ON s.course_code = TRIM(cm.uh_course_code)
  LEFT JOIN credit_registration_attention_dismissals dis ON dis.credit_registration_id = cr.id
  AND dis.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT u.threshold_secs
    FROM UNNEST($1::credit_registration_state [], $2::double precision []) AS u(state, threshold_secs)
    WHERE u.state = cr.state
  ) t ON TRUE
  CROSS JOIN LATERAL (
    SELECT cr.terminal_at IS NULL
      AND t.threshold_secs IS NOT NULL
      AND now() - cr.state_changed_at > MAKE_INTERVAL(secs => t.threshold_secs) AS stuck_in_state,
      cr.state = 'failed_permanent'
      AND cr.needs_admin_attention
      AND cr.error_code IS DISTINCT FROM 'retry_window_expired' AS permanent_error,
      COALESCE(cr.error_code = 'retry_window_expired', FALSE) AS retry_window_expired,
      cr.state = 'misregistered' AS misregistered,
      cr.submit_retry_count >= $3
      AND cr.terminal_at IS NULL AS too_many_attempts,
      cr.state = 'submission_uncertain' AS outcome_uncertain,
      COALESCE(
        cr.state = 'partially_registered'
        AND cr.partially_registered_at <= now() - ($4::bigint * INTERVAL '1 second'),
        FALSE
      ) AS partly_registered_overdue,
      COALESCE(
        cr.state IN ('awaiting_verification', 'partially_registered')
        AND cr.submitted_at <= now() - ($5::bigint * INTERVAL '1 second'),
        FALSE
      ) AS verification_gave_up,
      cr.not_registered_reimport_count >= $6
      AND cr.terminal_at IS NULL AS repeatedly_not_registered,
      COALESCE(
        cr.state = 'pending'
        AND p.completion_eligible
        AND NOT p.has_verified_student_number
        AND cmc.completion_date >= $7::timestamptz
        AND s.last_mailing_fetch_started_at >= route.enrolment_confirmed_at + ($8::bigint * INTERVAL '1 second')
        AND (
          s.linking_unlinked_enrolled_before_count > 0
          OR NOT EXISTS (
            SELECT 1
            FROM credit_registration_account_linking_emails e
              JOIN course_modules code_module ON code_module.course_id = e.course_id
              AND code_module.deleted_at IS NULL
            WHERE TRIM(code_module.uh_course_code) = s.course_code
              AND e.sent_at >= route.enrolment_confirmed_at
              AND e.deleted_at IS NULL
          )
        ),
        FALSE
      ) AS student_number_stuck
  ) d
  CROSS JOIN LATERAL (
    SELECT cr.needs_admin_attention
      AND NOT (
        d.stuck_in_state
        OR d.permanent_error
        OR d.retry_window_expired
        OR d.misregistered
        OR d.too_many_attempts
        OR d.outcome_uncertain
        OR d.partly_registered_overdue
        OR d.verification_gave_up
        OR d.repeatedly_not_registered
        OR d.student_number_stuck
      ) AS only_flag
  ) flagged
WHERE cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND (
    $9::uuid [] IS NULL
    OR cr.id = ANY($9)
  )
  AND (
    cr.needs_admin_attention
    OR d.stuck_in_state
    OR d.permanent_error
    OR d.retry_window_expired
    OR d.misregistered
    OR d.too_many_attempts
    OR d.outcome_uncertain
    OR d.partly_registered_overdue
    OR d.verification_gave_up
    OR d.repeatedly_not_registered
    OR d.student_number_stuck
  )
ORDER BY cr.phase_started_at,
  cr.id
        "#,
        &state_thresholds as &[CreditRegistrationState],
        &threshold_secs as &[f64],
        TOO_MANY_SUBMIT_RETRIES,
        PARTIAL_REGISTRATION_ADMIN_AFTER.num_seconds(),
        VERIFY_MAX_AGE.num_seconds(),
        NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD,
        rules.account_linking_since,
        STUDENT_NUMBER_STUCK_AFTER_PRESS.num_seconds(),
        only_ids as Option<&[Uuid]>,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The canonical Needs attention count: what the tab badge, the overview and the daily snapshot
/// show.
pub async fn count_needing_attention(
    conn: &mut PgConnection,
    rules: &AttentionRules,
) -> ModelResult<i64> {
    let rows = get_attention_items(conn, rules, None).await?;
    Ok(rows
        .iter()
        .filter(|row| row.standing(&rules.blocking) == AttentionStanding::NeedsAttention)
        .count() as i64)
}

/// One dismissal still in force or recently made, for the "Dismissed recently" section.
#[derive(Debug, Clone, PartialEq)]
pub struct AttentionDismissal {
    pub credit_registration_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub dismissed_reasons: Vec<AttentionReason>,
    pub dismissed_at: DateTime<Utc>,
    pub dismissed_by_user_id: Uuid,
    pub dismissed_by_first_name: Option<String>,
    pub dismissed_by_last_name: Option<String>,
    pub reason: String,
}

/// Dismissals made since `since`, newest first.
pub async fn get_dismissals_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
    limit: i64,
) -> ModelResult<Vec<AttentionDismissal>> {
    let res = sqlx::query_as!(
        AttentionDismissal,
        r#"
SELECT dis.credit_registration_id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  dis.dismissed_reasons AS "dismissed_reasons: Vec<AttentionReason>",
  dis.created_at AS dismissed_at,
  dis.dismissed_by_user_id,
  actor.first_name AS "dismissed_by_first_name?",
  actor.last_name AS "dismissed_by_last_name?",
  dis.reason
FROM credit_registration_attention_dismissals dis
  JOIN credit_registrations cr ON cr.id = dis.credit_registration_id
  JOIN courses c ON c.id = cr.course_id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN user_details actor ON actor.user_id = dis.dismissed_by_user_id
WHERE dis.deleted_at IS NULL
  AND dis.created_at >= $1
ORDER BY dis.created_at DESC
LIMIT $2
        "#,
        since,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Takes a row off the queue for as long as it carries only `reasons`, replacing any earlier
/// dismissal of it. Call in the transaction that records the audit action.
pub async fn dismiss_attention(
    conn: &mut PgConnection,
    credit_registration_id: Uuid,
    reasons: &[AttentionReason],
    dismissed_by_user_id: Uuid,
    reason: &str,
) -> ModelResult<Uuid> {
    sqlx::query!(
        r#"
UPDATE credit_registration_attention_dismissals
SET deleted_at = now()
WHERE credit_registration_id = $1
  AND deleted_at IS NULL
        "#,
        credit_registration_id,
    )
    .execute(&mut *conn)
    .await?;
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO credit_registration_attention_dismissals (
    credit_registration_id,
    dismissed_reasons,
    dismissed_by_user_id,
    reason
  )
VALUES ($1, $2, $3, $4)
RETURNING id
        "#,
        credit_registration_id,
        reasons as &[AttentionReason],
        dismissed_by_user_id,
        reason,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}
