//! The study registry over Suotar, for phase iterations and for manual actions: the only part of
//! the pipeline that names Suotar's wire items and codes, or sends through its client.

mod breaker;
mod codes;
#[cfg(test)]
mod contract_tests;
mod course_codes;
mod decode;
mod encode;
mod executor;
mod gate;
mod health_report;
mod rate_limit;
mod rosters;

pub use breaker::is_waiting_to_probe;
pub use codes::is_waiting_item;
pub(super) use health_report::{report_breakers, report_rate_limits};

use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_models::suotar_circuit_breakers::BreakerTarget;
use headless_lms_utils::services::suotar::{
    INTERACTIVE_REQUEST_TIMEOUT, SuotarCallContext, SuotarClient, endpoints, new_request_item_id,
};
use itertools::Itertools;
use tracing::{Instrument, Span};
use uuid::Uuid;

use crate::phase::CreditRegistrationPhase;
use crate::registry::{
    AttainmentSubmission, BatchEntry, BatchOptions, BatchReply, CourseCode, CourseCodeVerdicts,
    EnrolmentAnswer, EnrolmentLookup, ImportAnswer, InteractiveStudyRegistry, PersonAnswer,
    PersonLookup, PersonLookupError, RegistryError, RegistryOperation, RegistryPerson, RosterCode,
    RosterListing, RosterSearch, StudentNumber, StudyRegistry, VerificationAnswer,
    VerificationRequest,
};
use crate::runtime::PhaseSkipReason;
use crate::runtime::process_local::ScopeKey;
use gate::StudyRegistryGate;
use headless_lms_models::credit_registrations::RegistrationScope;

/// Forgets the limiter state of `scope`, so its endpoints are back at full rate with a full burst.
pub fn reset_rate_limits(scope: &RegistrationScope) {
    rate_limit::reset(&ScopeKey::of(scope));
}

/// The Suotar endpoint that serves `operation`, which is also what the call log, the limiter and the
/// dashboard key on.
pub(super) fn endpoint_of(operation: RegistryOperation) -> SuotarEndpoint {
    match operation {
        RegistryOperation::ResolvePersons => SuotarEndpoint::ResolvePersons,
        RegistryOperation::ResolveEnrolments => SuotarEndpoint::ResolveEnrolments,
        RegistryOperation::ImportAttainments => SuotarEndpoint::ImportAttainments,
        RegistryOperation::VerifyAttainments => SuotarEndpoint::VerifyAttainments,
        RegistryOperation::ListCourseRoster => SuotarEndpoint::ListByCourse,
        RegistryOperation::ValidateCourseCodes => SuotarEndpoint::ValidateCourseCodes,
    }
}

/// The Suotar endpoints one iteration of `phase` calls, in order: its
/// [`crate::PhaseSpec::operations`] as the call log and the dashboard name them.
fn study_registry_endpoints(
    phase: CreditRegistrationPhase,
) -> impl Iterator<Item = SuotarEndpoint> {
    phase
        .spec()
        .operations
        .iter()
        .map(|&operation| endpoint_of(operation))
}

/// The Suotar endpoints whose phases `process_name`'s `target` breaker pauses, each once.
pub fn endpoints_paused_by(process_name: &str, target: BreakerTarget) -> Vec<SuotarEndpoint> {
    CreditRegistrationPhase::ALL
        .into_iter()
        .filter(|phase| {
            let spec = phase.spec();
            spec.process.as_str() == process_name && spec.breakers.contains(&target)
        })
        .flat_map(study_registry_endpoints)
        .unique()
        .collect()
}

/// The longest one iteration of `phase` may wait on the study registry before its calls time out.
pub fn max_study_registry_wait(phase: CreditRegistrationPhase) -> std::time::Duration {
    study_registry_endpoints(phase)
        .map(SuotarEndpoint::request_timeout)
        .sum()
}

/// The span every request to `endpoint` runs in, whichever of the adapter's call sites sends it.
/// A resent half records `resent_half` on it.
fn request_span(endpoint: SuotarEndpoint, items: usize) -> Span {
    debug_span!(
        "study_registry_request",
        ?endpoint,
        items,
        resent_half = false
    )
}

/// The [`StudyRegistry`] over Suotar for one phase iteration: every request is spent through, and
/// recorded in, the iteration's gate.
pub(super) struct SuotarStudyRegistry<'a> {
    client: &'a SuotarClient,
    /// The audit log's `worker_name` for every call.
    worker_name: String,
    gate: StudyRegistryGate,
    /// Replaces the endpoints' own timeouts, which run to minutes.
    #[cfg(test)]
    request_timeout: Option<std::time::Duration>,
}

impl<'a> SuotarStudyRegistry<'a> {
    /// The registry one phase iteration sends through, or why the iteration waits.
    pub(super) fn admit(
        client: &'a SuotarClient,
        worker_name: String,
        phase: CreditRegistrationPhase,
        scope: &RegistrationScope,
        test_mode: bool,
    ) -> Result<Self, PhaseSkipReason> {
        Ok(Self {
            client,
            worker_name,
            gate: StudyRegistryGate::admit(phase, scope, test_mode)?,
            #[cfg(test)]
            request_timeout: None,
        })
    }

    /// Applies what the iteration's calls said to the breakers and the limiter, and returns the
    /// iteration's error, if any.
    pub(super) fn finish(self) -> Option<String> {
        self.gate.settle()
    }

    fn call_context(&self, registration_ids: Vec<Uuid>) -> SuotarCallContext {
        SuotarCallContext {
            worker_name: self.worker_name.clone(),
            credit_registration_ids: registration_ids,
            #[cfg(test)]
            request_timeout: self.request_timeout,
            #[cfg(not(test))]
            request_timeout: None,
        }
    }
}

impl StudyRegistry for SuotarStudyRegistry<'_> {
    fn allowance(&self, operation: RegistryOperation) -> usize {
        self.gate.allowance(endpoint_of(operation))
    }

    fn roster_request_size(&self) -> usize {
        if self.gate.is_probe() {
            1
        } else {
            SuotarEndpoint::ListByCourse.max_batch_size()
        }
    }

    async fn resolve_persons<K>(
        &mut self,
        entries: Vec<BatchEntry<K, PersonLookup>>,
        options: BatchOptions,
    ) -> BatchReply<K, PersonLookup, PersonAnswer> {
        executor::send_batch::<endpoints::ResolvePersons, _, _, _>(
            self,
            entries,
            options,
            encode::person_lookup_item,
            decode::person_answer,
        )
        .await
    }

    async fn resolve_enrolments<K>(
        &mut self,
        entries: Vec<BatchEntry<K, EnrolmentLookup>>,
        options: BatchOptions,
    ) -> BatchReply<K, EnrolmentLookup, EnrolmentAnswer> {
        executor::send_batch::<endpoints::ResolveEnrolments, _, _, _>(
            self,
            entries,
            options,
            encode::enrolment_item,
            decode::enrolment_answer,
        )
        .await
    }

    async fn import_attainments<K>(
        &mut self,
        entries: Vec<BatchEntry<K, AttainmentSubmission>>,
        options: BatchOptions,
    ) -> BatchReply<K, AttainmentSubmission, ImportAnswer> {
        executor::send_batch::<endpoints::ImportAttainments, _, _, _>(
            self,
            entries,
            options,
            encode::import_item,
            decode::import_answer,
        )
        .await
    }

    async fn verify_attainments<K>(
        &mut self,
        entries: Vec<BatchEntry<K, VerificationRequest>>,
        options: BatchOptions,
    ) -> BatchReply<K, VerificationRequest, VerificationAnswer> {
        executor::send_batch::<endpoints::VerifyAttainments, _, _, _>(
            self,
            entries,
            options,
            encode::verify_item,
            decode::verification_answer,
        )
        .await
    }

    async fn list_course_roster(
        &mut self,
        request: &[RosterCode],
    ) -> Result<RosterListing, RegistryError> {
        rosters::list(self, request).await
    }

    async fn validate_course_codes(
        &mut self,
        codes: &[CourseCode],
    ) -> Result<CourseCodeVerdicts, RegistryError> {
        course_codes::validate(self, codes).await
    }
}

/// The [`InteractiveStudyRegistry`] over Suotar, for one manual action: the interactive timeout,
/// and no gate.
pub(super) struct InteractiveSuotar<'a> {
    client: &'a SuotarClient,
    /// The audit log's `worker_name` for every call.
    worker_name: String,
}

impl<'a> InteractiveSuotar<'a> {
    pub(super) fn new(client: &'a SuotarClient, worker_name: String) -> Self {
        Self {
            client,
            worker_name,
        }
    }

    fn call_context(&self) -> SuotarCallContext {
        SuotarCallContext {
            worker_name: self.worker_name.clone(),
            credit_registration_ids: Vec::new(),
            request_timeout: Some(INTERACTIVE_REQUEST_TIMEOUT),
        }
    }
}

impl InteractiveStudyRegistry for InteractiveSuotar<'_> {
    async fn look_up_person(
        &self,
        student_number: &StudentNumber,
    ) -> Result<Option<RegistryPerson>, PersonLookupError> {
        let request_item_id = new_request_item_id();
        let item = encode::person_item(student_number, request_item_id.clone());
        let span = request_span(SuotarEndpoint::ResolvePersons, 1);
        let response = self
            .client
            .post::<endpoints::ResolvePersons>(self.call_context(), vec![item])
            .instrument(span)
            .await
            .map_err(|error| {
                warn!(error = %error, "Could not resolve a student number in the study registry");
                PersonLookupError::StudyRegistryUnavailable
            })?;
        match response.item(&request_item_id) {
            Some(item) => decode::person_lookup(item),
            None => Err(PersonLookupError::ItemMissingFromResponse),
        }
    }

    async fn search_course_rosters(
        &self,
        codes: &[CourseCode],
        student_number: &StudentNumber,
    ) -> RosterSearch {
        rosters::search(self, codes, student_number).await
    }
}
