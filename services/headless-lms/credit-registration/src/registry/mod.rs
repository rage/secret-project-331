//! The study registry as the phases and the manual actions see it: what can be asked of it, in the
//! pipeline's terms. Request ids, wire items, the limiter, the breakers and audit bodies are the
//! adapter's; splitting a refused batch is the batch runner's.

mod answers;
mod batch;
mod ids;
mod requests;

pub(crate) use answers::{
    CourseCodeVerdicts, EnrolmentAnswer, EnrolmentReading, FoundPerson, HeldCredit, ImportAnswer,
    PersonAnswer, PersonReading, RosterListing, RosterSearch, VerificationAnswer,
    VerificationReading,
};
pub use answers::{PersonLookupError, RegistryPerson};
pub(crate) use batch::{
    AnsweredRow, BatchEntry, BatchOptions, BatchReply, BatchRequest, ExchangeAudit, RefusedFor,
    RefusedRow,
};
pub(crate) use ids::{AttainmentId, CourseCode, StudentNumber, SubmittedAttainmentRef};
pub(crate) use requests::{
    AttainmentSubmission, Credits, EnrolmentLookup, PersonLookup, RosterCode, VerificationRequest,
};

use headless_lms_models::library::credit_registration::study_registry::RegistryErrorKind;
pub(crate) use headless_lms_models::library::credit_registration::study_registry::RegistryOperation;

/// The study registry a phase iteration asks, through its limiter and breakers. The seam a
/// use-case test would fake; only the Suotar adapter implements it. Generic rather than `dyn`.
///
/// The batch operations each send one request and hand every row they were given back, answered
/// or refused.
pub(crate) trait StudyRegistry {
    /// How many items the next request of `operation` may carry, or for a roster listing how many
    /// requests may go out. 0 means send nothing this iteration.
    fn allowance(&self, operation: RegistryOperation) -> usize;

    /// How many course codes one roster listing request may carry: the registry's batch size, or
    /// one while a breaker's probe lets a single item through.
    fn roster_request_size(&self) -> usize;

    async fn resolve_persons<K>(
        &mut self,
        entries: Vec<BatchEntry<K, PersonLookup>>,
        options: BatchOptions,
    ) -> BatchReply<K, PersonLookup, PersonAnswer>;

    async fn resolve_enrolments<K>(
        &mut self,
        entries: Vec<BatchEntry<K, EnrolmentLookup>>,
        options: BatchOptions,
    ) -> BatchReply<K, EnrolmentLookup, EnrolmentAnswer>;

    /// The one operation that creates something: a row it leaves unanswered may have landed.
    async fn import_attainments<K>(
        &mut self,
        entries: Vec<BatchEntry<K, AttainmentSubmission>>,
        options: BatchOptions,
    ) -> BatchReply<K, AttainmentSubmission, ImportAnswer>;

    async fn verify_attainments<K>(
        &mut self,
        entries: Vec<BatchEntry<K, VerificationRequest>>,
        options: BatchOptions,
    ) -> BatchReply<K, VerificationRequest, VerificationAnswer>;

    /// One list-by-course request, spending one request of the allowance.
    async fn list_course_roster(
        &mut self,
        request: &[RosterCode],
    ) -> Result<RosterListing, RegistryError>;

    /// Validates `codes` in requests as large as the allowance lets, until either runs out. On the
    /// first refused request the verdicts gathered so far are dropped.
    async fn validate_course_codes(
        &mut self,
        codes: &[CourseCode],
    ) -> Result<CourseCodeVerdicts, RegistryError>;
}

/// The study registry for someone waiting on the answer: no allowance, and no breaker learns from
/// its calls, so one click cannot trip the workers'. Not [`StudyRegistry`], whose calls go through
/// the iteration's gate.
pub(crate) trait InteractiveStudyRegistry {
    /// `Ok(None)` when the registry answered `personNotFound`.
    async fn look_up_person(
        &self,
        student_number: &StudentNumber,
    ) -> Result<Option<RegistryPerson>, PersonLookupError>;

    /// Lists each code's roster in a request of its own, all at once.
    async fn search_course_rosters(
        &self,
        codes: &[CourseCode],
        student_number: &StudentNumber,
    ) -> RosterSearch;
}

/// A study registry request that failed as a whole: a value the rows' outcomes are decided from,
/// not an error of the iteration.
pub(crate) struct RegistryError {
    pub kind: RegistryErrorKind,
    /// Unscrubbed; scrub it before persisting it.
    pub message: String,
}

impl RegistryError {
    pub(crate) fn new(kind: RegistryErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    /// Whether the failure may be down to the items the request carried. A connection that never
    /// opened, or our own credentials, say nothing about any of them.
    pub(crate) fn blames_request_items(&self) -> bool {
        !matches!(
            self.kind,
            RegistryErrorKind::NotDelivered | RegistryErrorKind::AuthenticationFailure
        )
    }
}
