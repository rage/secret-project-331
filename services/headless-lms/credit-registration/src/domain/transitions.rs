//! The moves a phase makes on a claimed row without an answer to decide from. A move decided from
//! an answer is an [`Outcome`](headless_lms_models::library::credit_registration::outcomes::Outcome)
//! instead, written through [`crate::use_cases::persist::write_decision`].

use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, CreditRegistrationState, Transition,
};

/// Import found the completion already registered by another registrar.
pub(crate) fn duplicate_of_other_registrar() -> Transition {
    Transition {
        event_message: Some(
            "Another registrar had already registered this completion, so nothing was submitted."
                .to_string(),
        ),
        ..Transition::to(CreditRegistrationState::Duplicate)
    }
}

/// Committed before the import request leaves: a row found in `submitting` after a restart has an
/// unknown outcome and is never sent again.
pub(crate) fn submitting() -> Transition {
    Transition::to(CreditRegistrationState::Submitting)
}

/// The frozen payload lacks a field, so the enrolment is resolved again.
pub(crate) fn unsendable_incomplete_payload() -> Transition {
    Transition {
        event_kind: CreditRegistrationEventKind::StateChanged,
        event_message: Some(
            "The frozen payload is incomplete, so the enrolment is resolved again.".to_string(),
        ),
        ..Transition::to(CreditRegistrationState::ReadyToSubmit)
    }
}

/// The frozen grade is not one Sisu accepts.
pub(crate) fn unsendable_unknown_grade() -> Transition {
    Transition {
        error_code: Some(CreditRegistrationErrorCode::NoGradeScaleMapping),
        needs_admin_attention: Some(true),
        event_message: Some("Sisu does not accept this grade.".to_string()),
        ..Transition::to(CreditRegistrationState::FailedPermanent)
    }
}

/// `field` is one Suotar requires to be non-empty, or `credits`, which it requires to be finite.
pub(crate) fn unsendable_field(field: &'static str) -> Transition {
    Transition {
        error_code: Some(CreditRegistrationErrorCode::Unknown),
        needs_admin_attention: Some(true),
        event_message: Some(format!(
            "Sisu does not accept the {field} we would send, so nothing was sent."
        )),
        ..Transition::to(CreditRegistrationState::FailedPermanent)
    }
}

/// An import row a split still held unsent when the worker shut down.
pub(crate) fn released_unsent_split_half() -> Transition {
    Transition {
        event_message: Some(
            "The worker shut down before this row's part of a split batch was sent, so nothing \
             was submitted."
                .to_string(),
        ),
        expected_from_state: Some(CreditRegistrationState::Submitting),
        ..Transition::to(CreditRegistrationState::Pending)
    }
}

/// No verified student number to resolve the enrolment with.
pub(crate) fn no_verified_student_number() -> Transition {
    Transition {
        event_message: Some("No verified student number is linked to the account.".to_string()),
        ..Transition::to(CreditRegistrationState::Pending)
    }
}

/// The module lacks what the enrolment lookup needs; `code` says what.
pub(crate) fn module_not_configured(code: CreditRegistrationErrorCode) -> Transition {
    Transition {
        error_code: Some(code),
        needs_admin_attention: Some(true),
        event_message: Some("The module is not configured for credit registration.".to_string()),
        ..Transition::to(CreditRegistrationState::FailedPermanent)
    }
}

/// Holds a first resolve out of `import`'s claim while its lookup is out.
pub(crate) fn resolving_enrolment() -> Transition {
    Transition::to(CreditRegistrationState::ResolvingEnrolment)
}

#[cfg(test)]
mod tests {
    use super::*;
    use CreditRegistrationState as State;

    #[test]
    fn each_move_lands_where_it_says() {
        let cases = [
            (duplicate_of_other_registrar(), State::Duplicate, None, None),
            (submitting(), State::Submitting, None, None),
            (
                unsendable_incomplete_payload(),
                State::ReadyToSubmit,
                None,
                None,
            ),
            (
                unsendable_unknown_grade(),
                State::FailedPermanent,
                Some(CreditRegistrationErrorCode::NoGradeScaleMapping),
                Some(true),
            ),
            (
                unsendable_field("grade_id"),
                State::FailedPermanent,
                Some(CreditRegistrationErrorCode::Unknown),
                Some(true),
            ),
            (released_unsent_split_half(), State::Pending, None, None),
            (no_verified_student_number(), State::Pending, None, None),
            (
                module_not_configured(CreditRegistrationErrorCode::MissingEctsCredits),
                State::FailedPermanent,
                Some(CreditRegistrationErrorCode::MissingEctsCredits),
                Some(true),
            ),
            (resolving_enrolment(), State::ResolvingEnrolment, None, None),
        ];
        for (transition, to_state, error_code, needs_admin_attention) in cases {
            assert_eq!(transition.to_state, to_state);
            assert_eq!(transition.error_code, error_code, "{to_state:?}");
            assert_eq!(
                transition.needs_admin_attention, needs_admin_attention,
                "{to_state:?}"
            );
        }
    }

    #[test]
    fn a_released_split_half_is_released_only_from_submitting() {
        assert_eq!(
            released_unsent_split_half().expected_from_state,
            Some(State::Submitting)
        );
    }

    #[test]
    fn an_unsendable_field_is_named_on_the_timeline() {
        assert!(
            unsendable_field("credits")
                .event_message
                .is_some_and(|message| message.contains("credits"))
        );
    }

    #[test]
    fn an_incomplete_payload_is_logged_as_a_state_change() {
        assert_eq!(
            unsendable_incomplete_payload().event_kind,
            CreditRegistrationEventKind::StateChanged
        );
    }
}
