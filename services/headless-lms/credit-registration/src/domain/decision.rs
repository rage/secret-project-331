//! What one answer does to its row, decided without touching the database.

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registrations::{CreditRegistrationState, PayloadSnapshot};
use headless_lms_models::library::credit_registration::enrolment_checks::EnrolmentCheckAnswer;
use headless_lms_models::library::credit_registration::grade_mapping::MappedGrade;
use headless_lms_models::library::credit_registration::outcomes::Outcome;
use headless_lms_models::library::credit_registration::study_registry::RegistryAttainment;
use uuid::Uuid;

use crate::registry::SubmittedAttainmentRef;

/// What one answer does to its row: the move, the timeline line and error that go with it, and the
/// writes it asks for, grouped by whether they outlive a lost race. The exchange behind the answer
/// is the caller's [`crate::registry::ExchangeAudit`], not part of the decision.
pub(crate) struct Decision<'a> {
    outcome: Outcome,
    message: Option<String>,
    row_error: Option<&'a str>,
    pre_transition: PreTransitionChanges<'a>,
    atomic: AtomicChanges<'a>,
}

impl<'a> Decision<'a> {
    pub(crate) fn new(outcome: Outcome) -> Self {
        Self {
            outcome,
            message: None,
            row_error: None,
            pre_transition: PreTransitionChanges::default(),
            atomic: AtomicChanges::default(),
        }
    }

    /// The timeline line for the move.
    pub(crate) fn with_message(self, message: impl Into<String>) -> Self {
        Self {
            message: Some(message.into()),
            ..self
        }
    }

    /// The item's own error, or a refused request's, persisted on the row once scrubbed.
    pub(crate) fn with_row_error(self, row_error: Option<&'a str>) -> Self {
        Self { row_error, ..self }
    }

    /// The submission an import answer named, and its attainment type.
    pub(crate) fn with_submitted_attainment(
        mut self,
        submission: Option<&'a SubmittedAttainmentRef>,
    ) -> Self {
        self.pre_transition.submitted_attainment = submission;
        self
    }

    /// The Sisu attainment that settles the row.
    pub(crate) fn with_sisu_attainment(
        mut self,
        attainment: Option<&'a RegistryAttainment>,
    ) -> Self {
        self.pre_transition.sisu_attainment = attainment;
        self
    }

    /// Suotar's own bound on when resending becomes safe.
    pub(crate) fn with_resubmit_not_before(
        mut self,
        resubmit_not_before: Option<DateTime<Utc>>,
    ) -> Self {
        self.pre_transition.resubmit_not_before = resubmit_not_before;
        self
    }

    pub(crate) fn with_payload(mut self, payload: PayloadChange<'a>) -> Self {
        self.atomic.payload = Some(payload);
        self
    }

    /// Set for a row on its enrolment check schedule, whose check is logged with the answer.
    pub(crate) fn with_enrolment_check(mut self, check: Option<EnrolmentCheckAnswer<'a>>) -> Self {
        self.atomic.enrolment_check = check;
        self
    }

    pub(crate) fn outcome(&self) -> &Outcome {
        &self.outcome
    }

    pub(crate) fn message(&self) -> Option<&str> {
        self.message.as_deref()
    }

    pub(crate) fn row_error(&self) -> Option<&'a str> {
        self.row_error
    }

    pub(crate) fn pre_transition(&self) -> &PreTransitionChanges<'a> {
        &self.pre_transition
    }

    pub(crate) fn atomic(&self) -> &AtomicChanges<'a> {
        &self.atomic
    }
}

/// Written before the guarded transition and kept even when the row moved on meanwhile: each
/// records something the registry already did or said.
///
/// Other writes outlive a lost race on purpose too: the verified student number an outcome drops
/// (only while the link still holds the number sent), the person id and person conflict a lookup
/// found, `mark_partially_registered`, and whatever a claim commits before the request leaves
/// (import's preflight, the resolve hold, verify's lease, discovery's `mark_attempted`). Verify's
/// `notRegistered` and the resolve freeze are the exception: they write inside an outer
/// transaction that commits only if the move is written, so nothing of theirs survives.
#[derive(Default)]
pub(crate) struct PreTransitionChanges<'a> {
    submitted_attainment: Option<&'a SubmittedAttainmentRef>,
    sisu_attainment: Option<&'a RegistryAttainment>,
    resubmit_not_before: Option<DateTime<Utc>>,
}

impl<'a> PreTransitionChanges<'a> {
    /// Kept on a row that moved on, so support can still find what the submission created.
    pub(crate) fn submitted_attainment(&self) -> Option<&'a SubmittedAttainmentRef> {
        self.submitted_attainment
    }

    /// Written outside any transaction: a lost race for it surfaces as a unique violation, which
    /// would abort the transaction, so the caller must not hold one open either.
    pub(crate) fn sisu_attainment(&self) -> Option<&'a RegistryAttainment> {
        self.sisu_attainment
    }

    pub(crate) fn resubmit_not_before(&self) -> Option<DateTime<Utc>> {
        self.resubmit_not_before
    }
}

/// Written in the transition's transaction, alongside the retry count and next enrolment check
/// the outcome asks for, so they roll back with a row that moved on.
#[derive(Default)]
pub(crate) struct AtomicChanges<'a> {
    payload: Option<PayloadChange<'a>>,
    enrolment_check: Option<EnrolmentCheckAnswer<'a>>,
}

impl<'a> AtomicChanges<'a> {
    pub(crate) fn payload(&self) -> Option<&PayloadChange<'a>> {
        self.payload.as_ref()
    }

    pub(crate) fn enrolment_check(&self) -> Option<&EnrolmentCheckAnswer<'a>> {
        self.enrolment_check.as_ref()
    }
}

/// What a resolved enrolment does to the payload a row carries.
#[derive(Debug)]
pub(crate) enum PayloadChange<'a> {
    /// Frozen for import, replacing the registered credits of the student's other attempts once it
    /// is registered.
    Frozen {
        snapshot: &'a PayloadSnapshot,
        supersedes: &'a [Uuid],
    },
    /// Not sent, since the registry already holds the credit: see
    /// [`headless_lms_models::credit_registrations::prepare_unsent_duplicate`].
    Unsent { weighed_grade: Option<MappedGrade> },
}

/// What writing one answer did to its row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Applied {
    /// `is_failure` when the row now carries an error code, which is what `items_failed` counts.
    Written { is_failure: bool },
    /// Another writer moved the row since it was read, so the row is theirs and nothing was
    /// written. The rest of the batch carries on: aborting would leave it in the state the phase's
    /// own preflight wrote, which no phase claims again.
    MovedOn { found: CreditRegistrationState },
}
