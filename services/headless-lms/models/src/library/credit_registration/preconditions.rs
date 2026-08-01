//! Moving a row along, or out of, the chain of things that must be true before we submit.
//!
//! Everything here is decided from the database alone, which is why it keeps running during a
//! Suotar outage, and why the consent endpoint can call it in the transaction that writes the
//! consent instead of waiting for a tick.

use crate::credit_registrations::{
    CreditRegistrationErrorCode, CreditRegistrationState, RegistrationScope, Transition,
};
use crate::prelude::*;

use super::classification::{SUBMIT_MAX_RETRY_AGE_SECS, SUBMITTING_RECOVERY_GRACE_SECS};
use super::outcomes::resume_state;

/// How many rows one iteration may move.
pub const PRECONDITIONS_LIMIT: i64 = 500;

/// A row the recompute wants to move, and why.
#[derive(Debug, Clone, PartialEq)]
struct PendingMove {
    id: Uuid,
    state: CreditRegistrationState,
    /// `None` for a row whose backoff has elapsed: where it resumes depends on how far it had got,
    /// which is decided in one place, [`resume_state`].
    target: Option<CreditRegistrationState>,
    consent_withdrawn: bool,
    has_submitted_attainment: bool,
    has_payload_snapshot: bool,
}

/// Recomputes preconditions for the scoped rows and applies at most `limit` moves.
///
/// Returns how many rows moved.
pub async fn recompute_preconditions(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    let moves = pending_moves(conn, scope, limit).await?;
    let mut moved = 0;
    for pending in &moves {
        let target = pending.target.unwrap_or_else(|| {
            resume_state(
                pending.has_submitted_attainment,
                pending.has_payload_snapshot,
            )
        });
        if target == pending.state {
            continue;
        }
        crate::credit_registrations::transition(conn, pending.id, &transition_for(pending, target))
            .await?;
        moved += 1;
    }
    Ok(moved)
}

/// The transition each edge writes. Kept apart from the query so every edge's error code, admin
/// flag and audit message is decided in one readable place.
fn transition_for(pending: &PendingMove, target: CreditRegistrationState) -> Transition {
    use CreditRegistrationState as State;
    let base = Transition::to(target);
    match target {
        State::SubmissionUncertain => Transition {
            error_code: Some(CreditRegistrationErrorCode::SisuTimeout),
            event_message: Some(
                "Found still submitting after a restart, so the import may or may not have been \
                 processed. Only verification may touch it from here."
                    .to_string(),
            ),
            ..base
        },
        State::AbandonedByConsentWithdrawal => Transition {
            // Not an error and not a failure: nobody should be asked to look at it, and no count
            // may treat it as either.
            needs_admin_attention: Some(false),
            event_message: Some(
                "Consent was withdrawn while this was in flight. Polling stopped, and whether the \
                 study registry recorded it is unknown."
                    .to_string(),
            ),
            ..base
        },
        State::Cancelled => Transition {
            event_message: Some(
                "The completion no longer exists and nothing had been submitted.".to_string(),
            ),
            ..base
        },
        State::Blocked => Transition {
            event_message: Some(
                if pending.consent_withdrawn {
                    "Consent was withdrawn before anything was submitted."
                } else {
                    "The completion is no longer eligible for registration."
                }
                .to_string(),
            ),
            ..base
        },
        State::FailedPermanent => Transition {
            error_code: Some(CreditRegistrationErrorCode::RetryWindowExpired),
            needs_admin_attention: Some(true),
            event_message: Some("Retried for a week without success.".to_string()),
            ..base
        },
        State::PendingStudentNumber if pending.state != State::PendingConsent => Transition {
            event_message: Some("No verified student number is linked to the account.".to_string()),
            ..base
        },
        _ => base,
    }
}

/// Returns only the rows whose facts disagree with the state they are in, so the bound cannot
/// starve a row behind ones that need nothing.
async fn pending_moves(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<PendingMove>> {
    let rows = sqlx::query!(
        r#"
WITH facts AS (
  SELECT cr.id,
    cr.state,
    cr.next_attempt_at,
    cr.state_entered_at,
    cr.first_failed_at,
    cr.submitted_attainment_id IS NOT NULL AS has_submitted_attainment,
    (
      cr.selected_enrolment_id IS NOT NULL
      AND cr.grade_id IS NOT NULL
    ) AS has_payload_snapshot,
    cmc.deleted_at IS NOT NULL AS completion_deleted,
    (
      cmc.deleted_at IS NULL
      AND cmc.passed
      AND cmc.eligible_for_ects
      AND cmc.prerequisite_modules_completed
      AND NOT cmc.needs_to_be_reviewed
    ) AS eligible,
    consent.consent_given IS TRUE AS consented,
    -- Declining and withdrawing look the same in the flag; only the timestamp tells them apart,
    -- and only withdrawal blocks a row. Declining leaves it waiting for a change of mind.
    (
      consent.consent_given IS FALSE
      AND consent.consent_given_at IS NOT NULL
    ) AS consent_withdrawn,
    vsn.id IS NOT NULL AS has_student_number
  FROM credit_registrations cr
    JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
    LEFT JOIN course_credit_registration_consents consent ON consent.user_id = cr.user_id
    AND consent.course_id = cr.course_id
    AND consent.deleted_at IS NULL
    LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
    AND vsn.deleted_at IS NULL
    LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cr.course_module_id
    AND conf.deleted_at IS NULL
  WHERE cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    AND cr.terminal_at IS NULL
    -- Only a human moves a row the study registry reversed.
    AND cr.state <> 'misregistered'
    AND conf.paused_at IS NULL
    AND ($2::uuid IS NULL OR cr.course_id = $2)
    AND ($3::uuid IS NULL OR cr.user_id = $3)
    AND (
      cardinality($4::uuid []) = 0
      OR cr.id = ANY($4::uuid [])
    )
),
targets AS (
  SELECT facts.*,
    CASE
      -- Withdrawal of something already sent. The request is out of our hands, so we stop asking.
      WHEN facts.state IN (
        'submitting',
        'submission_uncertain',
        'awaiting_verification'
      )
      AND facts.consent_withdrawn THEN 'abandoned_by_consent_withdrawal'
      -- A worker committed `submitting` and never came back with an answer. There is no way to
      -- know whether the request landed, so the row is never imported again.
      WHEN facts.state = 'submitting'
      AND facts.state_entered_at < now() - ($5::bigint * INTERVAL '1 second') THEN 'submission_uncertain'
      WHEN facts.state IN (
        'submitting',
        'submission_uncertain',
        'awaiting_verification'
      ) THEN facts.state
      WHEN facts.completion_deleted THEN 'cancelled'
      WHEN facts.consent_withdrawn THEN 'blocked'
      WHEN facts.state = 'failed_retryable'
      AND NOT facts.eligible THEN 'blocked'
      WHEN facts.state = 'failed_retryable'
      AND facts.first_failed_at < now() - ($6::bigint * INTERVAL '1 second') THEN 'failed_permanent'
      -- Resumed at whichever state matches how far it had got; decided outside this query.
      WHEN facts.state = 'failed_retryable'
      AND facts.next_attempt_at <= now() THEN NULL
      WHEN facts.state = 'failed_retryable' THEN facts.state
      -- Eligibility lost after the row had already moved on is what `blocked` is for; a row still
      -- waiting on prerequisites is simply where it belongs.
      WHEN NOT facts.eligible
      AND facts.state <> 'pending_prerequisites' THEN 'blocked'
      WHEN NOT facts.eligible THEN 'pending_prerequisites'
      WHEN NOT facts.consented THEN 'pending_consent'
      WHEN NOT facts.has_student_number THEN 'pending_student_number'
      -- The periodic look for an enrolment that may have appeared since.
      WHEN facts.state = 'no_usable_enrolment'
      AND facts.next_attempt_at > now() THEN facts.state
      -- Already queued for import with its payload frozen; sending it back would resolve again
      -- forever.
      WHEN facts.state = 'checking_enrolment' THEN facts.state
      ELSE 'ready_to_submit'
    END::credit_registration_state AS target
  FROM facts
)
SELECT id,
  state AS "state: CreditRegistrationState",
  target AS "target?: CreditRegistrationState",
  consent_withdrawn AS "consent_withdrawn!",
  has_submitted_attainment AS "has_submitted_attainment!",
  has_payload_snapshot AS "has_payload_snapshot!"
FROM targets
WHERE target IS NULL
  OR target <> state
ORDER BY state_entered_at
LIMIT $1
        "#,
        limit,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
        SUBMITTING_RECOVERY_GRACE_SECS,
        SUBMIT_MAX_RETRY_AGE_SECS,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| PendingMove {
            id: row.id,
            state: row.state,
            target: row.target,
            consent_withdrawn: row.consent_withdrawn,
            has_submitted_attainment: row.has_submitted_attainment,
            has_payload_snapshot: row.has_payload_snapshot,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course_credit_registration_consents;
    use crate::course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion,
    };
    use crate::credit_registrations::{NewCreditRegistration, get_by_id, transition};
    use crate::test_helper::*;
    use crate::verified_student_numbers::{
        NewVerifiedStudentNumber, StudentNumberVerificationMethod,
    };

    struct Fixture {
        registration: Uuid,
        completion: Uuid,
    }

    async fn fixture(
        conn: &mut PgConnection,
        user: Uuid,
        course: Uuid,
        instance: Uuid,
        course_module: Uuid,
    ) -> Fixture {
        let completion = crate::course_module_completions::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module,
                user_id: user,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en".to_string(),
                eligible_for_ects: true,
                email: "student@example.com".to_string(),
                grade: Some(4),
                passed: true,
            },
            CourseModuleCompletionGranter::Automatic,
        )
        .await
        .unwrap();
        // Defaults to false on the completion, and the recompute treats it as an unmet prerequisite.
        crate::course_module_completions::update_prerequisite_modules_completed(
            conn,
            completion.id,
            true,
        )
        .await
        .unwrap();
        let registration = crate::credit_registrations::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCreditRegistration {
                course_module_completion_id: completion.id,
                user_id: user,
                course_id: course,
                course_module_id: course_module,
                course_instance_id: instance,
                attempt_number: 1,
            },
            None,
        )
        .await
        .unwrap();
        Fixture {
            registration,
            completion: completion.id,
        }
    }

    async fn link_student_number(conn: &mut PgConnection, user: Uuid) {
        crate::verified_student_numbers::insert(
            conn,
            PKeyPolicy::Generate,
            &NewVerifiedStudentNumber {
                user_id: user,
                student_number: format!("9{:08}", rand_suffix()),
                sisu_person_id: format!("hy-hlo-{}", rand_suffix()),
                first_names: None,
                last_name: None,
                verified_via: StudentNumberVerificationMethod::EmailedLink,
                verified_via_email: Some("student@helsinki.example".to_string()),
                verified_via_email_match_field: None,
                account_email_verified_at: None,
                linked_by_user_id: None,
                link_reason: None,
                verified_from_course_id: None,
            },
        )
        .await
        .unwrap();
    }

    /// Ages the state timestamp so the stale-`submitting` rule can be exercised without waiting.
    async fn entered_state_long_ago(conn: &mut PgConnection, id: Uuid) {
        sqlx::query(
            "UPDATE credit_registrations SET state_entered_at = now() - INTERVAL '1 hour'
             WHERE id = $1",
        )
        .bind(id)
        .execute(conn)
        .await
        .unwrap();
    }

    /// Ages the first failure so the retry window can expire without waiting a week.
    async fn first_failed_long_ago(conn: &mut PgConnection, id: Uuid) {
        sqlx::query(
            "UPDATE credit_registrations SET first_failed_at = now() - INTERVAL '8 days'
             WHERE id = $1",
        )
        .bind(id)
        .execute(conn)
        .await
        .unwrap();
    }

    async fn pause_module(conn: &mut PgConnection, course_module_id: Uuid, user_id: Uuid) {
        crate::course_module_suotar_configurations::upsert(conn, course_module_id, None, None)
            .await
            .unwrap();
        sqlx::query(
            "UPDATE course_module_suotar_configurations
             SET paused_at = now(), paused_by_user_id = $2
             WHERE course_module_id = $1",
        )
        .bind(course_module_id)
        .bind(user_id)
        .execute(conn)
        .await
        .unwrap();
    }

    fn rand_suffix() -> u32 {
        use rand::RngExt;
        rand::rng().random_range(1..99_999_999)
    }

    async fn recompute(conn: &mut PgConnection, fixture: &Fixture) -> i64 {
        recompute_preconditions(
            conn,
            &RegistrationScope {
                credit_registration_ids: vec![fixture.registration],
                ..RegistrationScope::default()
            },
            PRECONDITIONS_LIMIT,
        )
        .await
        .unwrap()
    }

    async fn state(conn: &mut PgConnection, fixture: &Fixture) -> CreditRegistrationState {
        get_by_id(conn, fixture.registration).await.unwrap().state
    }

    #[tokio::test]
    async fn an_eligible_completion_walks_the_chain_as_the_student_does_their_part() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 1);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::PendingConsent
        );

        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        assert_eq!(recompute(tx.as_mut(), &fixture).await, 1);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::PendingStudentNumber
        );

        link_student_number(tx.as_mut(), user).await;
        assert_eq!(recompute(tx.as_mut(), &fixture).await, 1);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::ReadyToSubmit
        );

        // Nothing left to change, so nothing is written and the audit trail stays readable.
        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
    }

    /// Declining is not the same as withdrawing: the row waits in `pending_consent` for a change of
    /// mind rather than being blocked.
    #[tokio::test]
    async fn declining_consent_leaves_the_row_waiting_rather_than_blocked() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, false)
            .await
            .unwrap();

        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::PendingConsent
        );
    }

    #[tokio::test]
    async fn withdrawing_consent_before_anything_is_sent_blocks_the_row() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::ReadyToSubmit
        );

        course_credit_registration_consents::upsert(tx.as_mut(), user, course, false)
            .await
            .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Blocked
        );

        // Consenting again puts it back in the queue, which is only possible because withdrawal
        // blocks rather than cancels.
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::ReadyToSubmit
        );
    }

    #[tokio::test]
    async fn withdrawing_consent_on_an_item_in_flight_abandons_it() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::AwaitingVerification),
        )
        .await
        .unwrap();

        course_credit_registration_consents::upsert(tx.as_mut(), user, course, false)
            .await
            .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        let row = get_by_id(tx.as_mut(), fixture.registration).await.unwrap();
        assert_eq!(
            row.state,
            CreditRegistrationState::AbandonedByConsentWithdrawal
        );
        assert!(row.terminal_at.is_some());
        assert!(!row.needs_admin_attention);
    }

    /// The crash-safety half of the double-submission guard: a row left behind by a worker that
    /// died mid-call is uncertain, never re-imported.
    #[tokio::test]
    async fn a_row_left_submitting_by_a_dead_worker_becomes_uncertain() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::Submitting),
        )
        .await
        .unwrap();

        // A request that may still be in flight is left alone.
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Submitting
        );

        entered_state_long_ago(tx.as_mut(), fixture.registration).await;
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::SubmissionUncertain
        );
    }

    /// Nothing may move an uncertain row back towards import, whatever else is true about it.
    #[tokio::test]
    async fn an_uncertain_row_is_never_moved_back_towards_import() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::SubmissionUncertain),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::SubmissionUncertain
        );
    }

    #[tokio::test]
    async fn losing_eligibility_blocks_a_row_and_regaining_it_unblocks_it() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::PendingStudentNumber
        );

        crate::course_module_completions::update_needs_to_be_reviewed(
            tx.as_mut(),
            fixture.completion,
            true,
        )
        .await
        .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Blocked
        );

        crate::course_module_completions::update_needs_to_be_reviewed(
            tx.as_mut(),
            fixture.completion,
            false,
        )
        .await
        .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::PendingStudentNumber
        );
    }

    #[tokio::test]
    async fn a_deleted_completion_cancels_a_row_that_was_never_sent() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        crate::course_module_completions::delete(tx.as_mut(), fixture.completion)
            .await
            .unwrap();

        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Cancelled
        );
    }

    #[tokio::test]
    async fn unlinking_the_student_number_sends_a_queued_row_back_to_wait_for_one() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::ReadyToSubmit
        );

        let linked = crate::verified_student_numbers::get_by_user_id(tx.as_mut(), user)
            .await
            .unwrap()
            .expect("a linked number");
        crate::verified_student_numbers::soft_delete(tx.as_mut(), linked.id)
            .await
            .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::PendingStudentNumber
        );
    }

    #[tokio::test]
    async fn a_retryable_row_resumes_where_it_had_got_to_once_its_backoff_elapses() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::FailedRetryable),
        )
        .await
        .unwrap();
        crate::credit_registrations::schedule_next_attempt(
            tx.as_mut(),
            fixture.registration,
            Utc::now() + chrono::Duration::hours(1),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);

        crate::credit_registrations::schedule_next_attempt(
            tx.as_mut(),
            fixture.registration,
            Utc::now() - chrono::Duration::seconds(1),
        )
        .await
        .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::ReadyToSubmit
        );
    }

    #[tokio::test]
    async fn a_row_that_kept_failing_for_a_week_becomes_a_support_case() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::FailedRetryable),
        )
        .await
        .unwrap();
        first_failed_long_ago(tx.as_mut(), fixture.registration).await;

        recompute(tx.as_mut(), &fixture).await;
        let row = get_by_id(tx.as_mut(), fixture.registration).await.unwrap();
        assert_eq!(row.state, CreditRegistrationState::FailedPermanent);
        assert_eq!(
            row.error_code,
            Some(CreditRegistrationErrorCode::RetryWindowExpired)
        );
        assert!(row.needs_admin_attention);
    }

    #[tokio::test]
    async fn a_row_with_no_usable_enrolment_is_looked_at_again_when_its_recheck_falls_due() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::NoUsableEnrolment),
        )
        .await
        .unwrap();
        crate::credit_registrations::schedule_next_attempt(
            tx.as_mut(),
            fixture.registration,
            Utc::now() + chrono::Duration::hours(24),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);

        crate::credit_registrations::schedule_next_attempt(
            tx.as_mut(),
            fixture.registration,
            Utc::now() - chrono::Duration::seconds(1),
        )
        .await
        .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::ReadyToSubmit
        );
    }

    /// A row queued for import keeps its place: sending it back to resolve its enrolment again
    /// would be a loop, and its payload is already frozen.
    #[tokio::test]
    async fn a_row_queued_for_import_is_left_where_it_is() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        course_credit_registration_consents::upsert(tx.as_mut(), user, course, true)
            .await
            .unwrap();
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::CheckingEnrolment),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::CheckingEnrolment
        );
    }

    #[tokio::test]
    async fn a_paused_module_stops_the_recompute_without_rewriting_anything() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        pause_module(tx.as_mut(), course_module.id, user).await;

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::PendingPrerequisites
        );
    }

    #[tokio::test]
    async fn a_terminal_row_is_never_recomputed() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::Registered),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Registered
        );
    }

    #[tokio::test]
    async fn a_reversed_registration_waits_for_a_human() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::to(CreditRegistrationState::Misregistered),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Misregistered
        );
    }

    /// The rule stated in one place and applied in another has to be proven to be the same rule.
    /// This walks a row into every state, withdraws consent and checks the recompute against the
    /// statement of what withdrawal does.
    #[tokio::test]
    async fn withdrawal_does_what_the_rule_says_from_every_state() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        for state in CreditRegistrationState::ALL {
            insert_data!(tx: tx; user: student);
            let fixture =
                fixture(tx.as_mut(), student, course, instance.id, course_module.id).await;
            course_credit_registration_consents::upsert(tx.as_mut(), student, course, true)
                .await
                .unwrap();
            link_student_number(tx.as_mut(), student).await;
            transition(tx.as_mut(), fixture.registration, &Transition::to(state))
                .await
                .unwrap();
            course_credit_registration_consents::upsert(tx.as_mut(), student, course, false)
                .await
                .unwrap();

            recompute(tx.as_mut(), &fixture).await;
            let expected = super::super::withdrawal::withdrawal_target(state).unwrap_or(state);
            assert_eq!(
                self::state(tx.as_mut(), &fixture).await,
                expected,
                "withdrawal from {state:?}"
            );
        }
    }

    #[tokio::test]
    async fn a_scoped_recompute_leaves_another_students_row_alone() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let mine = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        insert_data!(tx: tx; user: other_user);
        let theirs = fixture(
            tx.as_mut(),
            other_user,
            course,
            instance.id,
            course_module.id,
        )
        .await;

        assert_eq!(
            recompute_preconditions(
                tx.as_mut(),
                &RegistrationScope {
                    user_id: Some(user),
                    ..RegistrationScope::default()
                },
                PRECONDITIONS_LIMIT
            )
            .await
            .unwrap(),
            1
        );
        assert_eq!(
            state(tx.as_mut(), &mine).await,
            CreditRegistrationState::PendingConsent
        );
        assert_eq!(
            state(tx.as_mut(), &theirs).await,
            CreditRegistrationState::PendingPrerequisites
        );
    }
}
