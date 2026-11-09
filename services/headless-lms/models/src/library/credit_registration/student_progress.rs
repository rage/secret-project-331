//! The step list a student sees once their registration has found an enrolment. Classified here so
//! a new ledger state has to be placed on it before it compiles.

use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::prelude::*;

/// One row of the step list, in the order a registration passes them.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StudentRegistrationProgressStep {
    EnrolmentFound,
    SentToSisu,
    AcceptedBySisu,
    /// Sisu holds the assessment item attainment but not yet the course unit attainment.
    PartiallyRegistered,
}

impl StudentRegistrationProgressStep {
    const IN_ORDER: [Self; 4] = [
        Self::EnrolmentFound,
        Self::SentToSisu,
        Self::AcceptedBySisu,
        Self::PartiallyRegistered,
    ];
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CompletedProgressStep {
    pub step: StudentRegistrationProgressStep,
    /// When the registration reached the step; `None` for a step it skipped.
    pub reached_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct StudentRegistrationProgress {
    /// `None` once every step is done.
    pub current_step: Option<StudentRegistrationProgressStep>,
    /// The steps before `current_step`, in order.
    pub completed_steps: Vec<CompletedProgressStep>,
    /// A send is out and we do not know yet whether it reached Sisu. Only with `current_step`
    /// `sent_to_sisu`.
    pub submission_uncertain: bool,
}

/// The state a row enters once it has found an enrolment; its latest entry dates
/// [`StudentRegistrationProgressStep::EnrolmentFound`].
pub const ENROLMENT_FOUND_STATE: CreditRegistrationState =
    CreditRegistrationState::CheckingEnrolment;

/// What the step list is drawn from.
#[derive(Debug, Clone, Copy)]
pub struct ProgressFacts {
    pub state: CreditRegistrationState,
    /// See `StudentCreditRegistration::has_usable_enrolment`.
    pub has_usable_enrolment: bool,
    /// The row's latest entry into [`ENROLMENT_FOUND_STATE`].
    pub enrolment_found_at: Option<DateTime<Utc>>,
    /// Whether Sisu answered the latest send with an attainment.
    pub has_submitted_attainment: bool,
    pub submitted_at: Option<DateTime<Utc>>,
    pub partially_registered_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
}

enum Position {
    At(StudentRegistrationProgressStep),
    Finished,
    /// Not on its way to Sisu, so the step list does not describe it.
    Off,
}

fn position(facts: &ProgressFacts) -> Position {
    use CreditRegistrationState as S;
    use StudentRegistrationProgressStep as Step;
    match facts.state {
        // With a usable enrolment, `pending` is a precondition lost after the enrolment was found.
        S::Pending
        | S::ReadyToSubmit
        | S::ResolvingEnrolment
        | S::CheckingEnrolment
        | S::Submitting
        | S::SubmissionUncertain => Position::At(Step::SentToSisu),
        // A failed verify poll leaves a landed submission here until it resumes verifying.
        S::FailedRetryable if facts.partially_registered_at.is_some() => {
            Position::At(Step::PartiallyRegistered)
        }
        S::FailedRetryable if facts.has_submitted_attainment => Position::At(Step::AcceptedBySisu),
        S::FailedRetryable => Position::At(Step::SentToSisu),
        S::AwaitingVerification => Position::At(Step::AcceptedBySisu),
        S::PartiallyRegistered => Position::At(Step::PartiallyRegistered),
        S::Registered | S::Duplicate | S::NotImproved => Position::Finished,
        S::NoUsableEnrolment
        | S::Misregistered
        | S::FailedPermanent
        | S::Blocked
        | S::Cancelled => Position::Off,
    }
}

impl StudentRegistrationProgress {
    /// `None` until the row has a usable enrolment, and for a row that is not on its way to Sisu.
    pub fn of(facts: ProgressFacts) -> Option<Self> {
        use StudentRegistrationProgressStep as Step;
        if !facts.has_usable_enrolment {
            return None;
        }
        let current_step = match position(&facts) {
            Position::At(step) => Some(step),
            Position::Finished => None,
            Position::Off => return None,
        };
        let completed_steps = Step::IN_ORDER
            .into_iter()
            .take_while(|step| Some(*step) != current_step)
            .map(|step| CompletedProgressStep {
                step,
                reached_at: match step {
                    Step::EnrolmentFound => facts.enrolment_found_at,
                    Step::SentToSisu => facts.submitted_at,
                    Step::AcceptedBySisu => facts.partially_registered_at.or(facts.registered_at),
                    Step::PartiallyRegistered => facts.partially_registered_at,
                },
            })
            .collect();
        Some(Self {
            current_step,
            completed_steps,
            submission_uncertain: facts.state == CreditRegistrationState::SubmissionUncertain,
        })
    }
}
