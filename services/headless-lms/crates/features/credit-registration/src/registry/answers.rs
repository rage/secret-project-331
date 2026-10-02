//! What the study registry answered for one item, read into the pipeline's terms.

use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use headless_lms_data_operations::library::credit_registration::config_validation::CourseCodeVerdict;
use headless_lms_data_operations::library::credit_registration::study_registry::{
    RegistryAttainment, RegistryEnrolment, RosterPerson,
};
use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, CreditRegistrationState,
};
use secrecy::SecretString;

use super::ids::{CourseCode, SubmittedAttainmentRef};

/// A Sisu person a student number resolved to.
pub(crate) struct FoundPerson {
    pub person_id: SecretString,
    pub first_names: Option<SecretString>,
    pub last_name: Option<SecretString>,
}

/// A worker's person lookup, read into the codes its row is written with. Not [`RegistryPerson`],
/// which keeps Suotar's own code for someone to read.
pub(crate) struct PersonAnswer {
    pub reading: PersonReading,
    /// The item's own error, which may accompany any reading.
    pub error_message: Option<String>,
}

pub(crate) enum PersonReading {
    Found(FoundPerson),
    /// No person to fill in: the item's code, or `UnexpectedResponse` for an ok item without one.
    Refused {
        code: CreditRegistrationErrorCode,
    },
}

/// The Sisu person an interactive lookup found for a student number.
pub struct RegistryPerson {
    pub sisu_person_id: SecretString,
    pub first_names: Option<SecretString>,
    pub last_name: Option<SecretString>,
    /// The registry's own per-item code, an identifier rather than prose.
    pub code: String,
}

/// Why an interactive person lookup could not say whether the number exists. `personNotFound` is
/// an answer, not one of these.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PersonLookupError {
    /// The request itself failed: network, auth, or a request-level error from the registry.
    StudyRegistryUnavailable,
    /// The registry answered but its response did not include this item.
    ItemMissingFromResponse,
    /// The registry answered for this item with something other than a person or
    /// `personNotFound`: its own code, an identifier rather than prose.
    UnexpectedAnswer { code: String },
}

/// An enrolment lookup. The lists are read whatever the reading: an enrolment error still lists
/// the attainments.
pub(crate) struct EnrolmentAnswer {
    pub reading: EnrolmentReading,
    pub enrolments: Vec<RegistryEnrolment>,
    pub existing_attainments: Vec<RegistryAttainment>,
}

pub(crate) enum EnrolmentReading {
    Listed,
    Refused {
        code: CreditRegistrationErrorCode,
        error_message: Option<String>,
    },
}

pub(crate) enum ImportAnswer {
    /// Sisu took the submission, or an earlier item of the same batch already made it
    /// (`is_repeat_in_batch`).
    Submitted {
        submission: Option<SubmittedAttainmentRef>,
        is_repeat_in_batch: bool,
    },
    /// The registry already holds the credit, so the row settles without a submission.
    Settled {
        held: HeldCredit,
        attainment: Option<RegistryAttainment>,
    },
    /// Anything the registry answered as an error, `sisuTimeout` included, which may still name a
    /// submission it made.
    Refused {
        code: CreditRegistrationErrorCode,
        submission: Option<SubmittedAttainmentRef>,
        error_message: Option<String>,
    },
    /// A success code we do not know, which is no proof that nothing was created.
    UnknownSuccessCode,
}

/// How the credit an import settled on is already held.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HeldCredit {
    Duplicate,
    NotImproved,
}

impl HeldCredit {
    pub(crate) fn state(self) -> CreditRegistrationState {
        match self {
            Self::Duplicate => CreditRegistrationState::Duplicate,
            Self::NotImproved => CreditRegistrationState::NotImproved,
        }
    }
}

/// A verify poll.
pub(crate) struct VerificationAnswer {
    pub reading: VerificationReading,
    /// The item's own error, which may accompany any reading.
    pub error_message: Option<String>,
}

pub(crate) enum VerificationReading {
    /// The course unit attainment is there.
    Registered {
        attainment: RegistryAttainment,
    },
    /// Registered, but with no course unit attainment yet.
    PartiallyRegistered,
    /// Sisu has not finished; `resubmit_not_before` bounds when resending becomes safe.
    Pending {
        resubmit_not_before: Option<DateTime<Utc>>,
    },
    /// No trace of the submission.
    NotRegistered,
    Failed {
        code: CreditRegistrationErrorCode,
    },
    /// An answer that settles nothing we act on.
    Inconclusive,
}

/// One list-by-course request's answer.
pub(crate) struct RosterListing {
    pub duration: Duration,
    /// One per requested code, in request order: its people, or why there is no roster for it.
    pub rosters: Vec<Result<Vec<RosterPerson>, CreditRegistrationErrorCode>>,
}

/// An interactive search of a course's rosters for one student number.
pub(crate) struct RosterSearch {
    /// The first roster, in code order, that lists the number.
    pub person: Option<RosterPerson>,
    /// A code's request failed, so the person may still be on its roster.
    pub has_unanswered_code: bool,
}

/// The verdicts the registry gave, by code; a code it gave none for is missing.
pub(crate) type CourseCodeVerdicts = HashMap<CourseCode, CourseCodeVerdict>;
