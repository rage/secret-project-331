use super::*;
use crate::course_module_completions::{CourseModuleCompletionGranter, NewCourseModuleCompletion};
use crate::credit_registration_events::CreditRegistrationEventKind;
use crate::prelude::*;
use crate::test_helper::*;

/// Checked over every pair the table allows rather than read off each arm: these are the
/// properties the pipeline is built on, and an edge added in the wrong arm breaks one of them
/// while still looking plausible where it was written.
#[test]
fn the_edge_table_keeps_the_machines_invariants() {
    use CreditRegistrationState as State;
    let import_claims = [State::CheckingEnrolment, State::Submitting];
    for from in State::ALL {
        if from.is_terminal() || from == State::Misregistered {
            assert!(
                from.allowed_targets().is_empty(),
                "{from:?} is not the pipeline's to move"
            );
        }
        for &to in from.allowed_targets() {
            assert_ne!(from, to, "{from:?}: staying put is not an edge");
            if matches!(
                from,
                State::Submitting | State::SubmissionUncertain | State::AwaitingVerification
            ) {
                assert!(
                    !import_claims.contains(&to),
                    "{from:?} -> {to:?} would let a second request out for a submission the \
                     study registry may already hold"
                );
            }
            if to == State::Submitting {
                assert_eq!(from, State::CheckingEnrolment, "only import may submit");
            }
            if to == State::Registered {
                assert!(
                    matches!(
                        from,
                        State::Submitting
                            | State::AwaitingVerification
                            | State::SubmissionUncertain
                    ),
                    "{from:?} -> registered: only an answer about a sent submission registers a \
                     row"
                );
            }
        }
    }
}

#[test]
fn success_states_const_matches_is_success() {
    let from_const: Vec<CreditRegistrationState> = CreditRegistrationState::SUCCESS_STATES.to_vec();
    let from_predicate: Vec<CreditRegistrationState> = CreditRegistrationState::ALL
        .into_iter()
        .filter(|state| state.is_success())
        .collect();
    assert_eq!(from_const, from_predicate);
}

async fn insert_registration(
    conn: &mut PgConnection,
    user: Uuid,
    course: Uuid,
    course_instance: Uuid,
    course_module: Uuid,
) -> Uuid {
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

    insert(
        conn,
        PKeyPolicy::Generate,
        &NewCreditRegistration {
            course_module_completion_id: completion.id,
            user_id: user,
            course_id: course,
            course_module_id: course_module,
            course_instance_id: course_instance,
            attempt_number: 1,
        },
        None,
    )
    .await
    .unwrap()
}

#[tokio::test]
async fn transition_stamps_state_entered_at_and_writes_an_event() {
    insert_data!(:tx, :user, :org, :course, :instance, :course_module);
    let id = insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;
    let before = get_by_id(tx.as_mut(), id).await.unwrap();

    let after = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::ReadyToSubmit),
    )
    .await
    .unwrap();

    assert_eq!(after.state, CreditRegistrationState::ReadyToSubmit);
    assert!(after.state_entered_at > before.state_entered_at);

    let events = crate::credit_registration_events::get_by_registration_id(tx.as_mut(), id)
        .await
        .unwrap();
    // The `created` event from insert plus this state change, newest first.
    assert_eq!(events.len(), 2);
    assert_eq!(events[1].kind, CreditRegistrationEventKind::Created);
    assert_eq!(events[0].kind, CreditRegistrationEventKind::StateChanged);
    assert_eq!(events[0].from_state, Some(CreditRegistrationState::Pending));
    assert_eq!(
        events[0].to_state,
        Some(CreditRegistrationState::ReadyToSubmit)
    );
}

#[tokio::test]
async fn consecutive_state_changes_stay_ordered_inside_one_transaction() {
    insert_data!(:tx, :user, :org, :course, :instance, :course_module);
    let id = insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

    let first = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::ReadyToSubmit),
    )
    .await
    .unwrap();
    let second = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::CheckingEnrolment),
    )
    .await
    .unwrap();
    assert!(second.state_entered_at > first.state_entered_at);
}

#[tokio::test]
async fn transition_stamps_lifecycle_timestamps() {
    insert_data!(:tx, :user, :org, :course, :instance, :course_module);
    let id = insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

    let checking = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::CheckingEnrolment),
    )
    .await
    .unwrap();
    assert!(checking.enrolment_checked_at.is_none());
    assert!(checking.submitted_at.is_none());
    assert!(checking.terminal_at.is_none());

    // Leaving checking_enrolment is what stamps enrolment_checked_at.
    let submitting = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::Submitting),
    )
    .await
    .unwrap();
    assert!(submitting.enrolment_checked_at.is_some());
    assert!(submitting.submitted_at.is_some());
    assert!(submitting.registered_at.is_none());
    assert!(submitting.terminal_at.is_none());

    let registered = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::Registered),
    )
    .await
    .unwrap();
    assert!(registered.registered_at.is_some());
    assert!(registered.terminal_at.is_some());
    assert_eq!(registered.submitted_at, submitting.submitted_at);
    assert_eq!(
        registered.enrolment_checked_at,
        submitting.enrolment_checked_at
    );
}

#[tokio::test]
async fn terminal_at_holds_between_terminal_states_and_clears_on_a_retry() {
    insert_data!(:tx, :user, :org, :course, :instance, :course_module);
    let id = insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

    let first = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::Cancelled),
    )
    .await
    .unwrap();
    let terminal_at = first.terminal_at.unwrap();

    let second = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::FailedPermanent),
    )
    .await
    .unwrap();
    assert_eq!(second.terminal_at, Some(terminal_at));

    let retried = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::ReadyToSubmit),
    )
    .await
    .unwrap();
    assert_eq!(retried.terminal_at, None);
}

#[tokio::test]
async fn starting_to_wait_for_an_enrolment_again_clears_a_dismissed_banner() {
    insert_data!(:tx, :user, :org, :course, :instance, :course_module);
    let id = insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

    transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::NoUsableEnrolment),
    )
    .await
    .unwrap();
    dismiss_enrolment_banner(tx.as_mut(), id, user)
        .await
        .unwrap();
    assert!(
        get_by_id(tx.as_mut(), id)
            .await
            .unwrap()
            .enrolment_banner_dismissed_at
            .is_some()
    );

    // A check that finds none again is the same enrolment problem, not a fresh one.
    let rechecked = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::NoUsableEnrolment),
    )
    .await
    .unwrap();
    assert!(rechecked.enrolment_banner_dismissed_at.is_some());

    transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::Pending),
    )
    .await
    .unwrap();
    let back = transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::NoUsableEnrolment),
    )
    .await
    .unwrap();
    assert_eq!(back.enrolment_banner_dismissed_at, None);
}

#[tokio::test]
async fn transition_carries_the_error_and_leaves_the_admin_flag_alone_unless_asked() {
    insert_data!(:tx, :user, :org, :course, :instance, :course_module);
    let id = insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;
    set_needs_admin_attention(tx.as_mut(), id, AdminAttention::Raise)
        .await
        .unwrap();

    let failed = transition(
        tx.as_mut(),
        id,
        &Transition {
            error_code: Some(CreditRegistrationErrorCode::EnrolmentNotFound),
            error_message: Some("no accepted enrolment".to_string()),
            ..Transition::planted(CreditRegistrationState::FailedPermanent)
        },
    )
    .await
    .unwrap();
    assert_eq!(
        failed.error_code,
        Some(CreditRegistrationErrorCode::EnrolmentNotFound)
    );
    assert!(failed.needs_admin_attention);

    let resolved = transition(
        tx.as_mut(),
        id,
        &Transition {
            needs_admin_attention: Some(AdminAttention::Clear),
            ..Transition::planted(CreditRegistrationState::ReadyToSubmit)
        },
    )
    .await
    .unwrap();
    assert!(!resolved.needs_admin_attention);
    assert_eq!(resolved.error_code, None);
}

#[tokio::test]
async fn a_transition_expecting_a_stale_prior_state_is_refused() {
    insert_data!(:tx, :user, :org, :course, :instance, :course_module);
    let id = insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

    transition(
        tx.as_mut(),
        id,
        &Transition::planted(CreditRegistrationState::Blocked),
    )
    .await
    .unwrap();

    // As if a caller had claimed the row into `resolving_enrolment` and, after an await, is
    // writing back based on that now-stale snapshot: the row moved to `blocked` in between.
    let refused = transition(
        tx.as_mut(),
        id,
        &Transition {
            expected_from_state: Some(CreditRegistrationState::ResolvingEnrolment),
            ..Transition::planted(CreditRegistrationState::CheckingEnrolment)
        },
    )
    .await;
    assert!(refused.is_err());
    assert_eq!(
        get_by_id(tx.as_mut(), id).await.unwrap().state,
        CreditRegistrationState::Blocked
    );
}
