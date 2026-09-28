//! The study registry as the phases see it: what can be asked of it, in the pipeline's terms. Request
//! ids, wire items, the limiter, the breakers, splitting and audit bodies are the adapter's.

mod answers;
mod audit;
mod batch;
mod error;
mod ids;
mod requests;

pub(crate) use answers::{
    CourseCodeVerdicts, EnrolmentAnswer, EnrolmentReading, FoundPerson, ImportAnswer, PersonAnswer,
    PersonLookupAnswer, PersonReading, RosterListing, RosterSearch, VerificationAnswer,
    VerificationReading,
};
pub(crate) use audit::ExchangeAudit;
pub(crate) use batch::{AnsweredRow, BatchEntry, BatchReply, RefusedRow, RequestBatch};
pub(crate) use error::RegistryError;
pub(crate) use ids::{AttainmentId, CourseCode, StudentNumber, SubmittedAttainmentRef};
pub(crate) use requests::{
    AttainmentSubmission, EnrolmentLookup, PersonLookup, RosterCode, VerificationRequest,
};

use headless_lms_models::suotar_api_calls::SuotarEndpoint;

/// The study registry. Generic rather than `dyn`, so a fake can stand in for the Suotar adapter.
///
/// The batch operations hand back every row they were given, answered, refused or split.
pub(crate) trait StudyRegistry {
    /// How many items the next request to `endpoint` may carry, or for list-by-course how many
    /// requests may go out. 0 means send nothing this iteration.
    fn allowance(&self, endpoint: SuotarEndpoint) -> usize;

    async fn resolve_persons<K>(
        &mut self,
        batch: RequestBatch<K, PersonLookup>,
    ) -> BatchReply<K, PersonLookup, PersonAnswer>;

    async fn resolve_enrolments<K>(
        &mut self,
        batch: RequestBatch<K, EnrolmentLookup>,
    ) -> BatchReply<K, EnrolmentLookup, EnrolmentAnswer>;

    /// The one operation that creates something: a row it leaves unanswered may have landed.
    async fn import_attainments<K>(
        &mut self,
        batch: RequestBatch<K, AttainmentSubmission>,
    ) -> BatchReply<K, AttainmentSubmission, ImportAnswer>;

    async fn verify_attainments<K>(
        &mut self,
        batch: RequestBatch<K, VerificationRequest>,
    ) -> BatchReply<K, VerificationRequest, VerificationAnswer>;

    /// Groups due codes into requests in the order given: a code fetched alone in one of its own,
    /// the rest in batches as large as the registry takes. Keeps the first `request_limit`, and
    /// cuts the first to a single code when the iteration is a probe.
    fn plan_roster_requests(
        &self,
        due: Vec<RosterCode>,
        request_limit: usize,
    ) -> Vec<Vec<RosterCode>>;

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

    /// For someone waiting on the answer: no allowance, and no breaker learns from it.
    async fn look_up_person(
        &self,
        student_number: &StudentNumber,
    ) -> Result<PersonLookupAnswer, RegistryError>;

    /// Lists each code's roster in a request of its own, all at once, for someone waiting on the
    /// answer: no allowance, and no breaker learns from it.
    async fn search_course_rosters(
        &self,
        codes: Vec<CourseCode>,
        student_number: &StudentNumber,
    ) -> RosterSearch;
}
