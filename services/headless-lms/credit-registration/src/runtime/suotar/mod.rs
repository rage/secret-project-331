//! The study registry over Suotar: the only part of the pipeline that names Suotar's wire items and
//! errors, or sends through its client.

mod breaker;
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
pub(super) use health_report::{report_breakers, report_rate_limits};

use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_utils::services::suotar::{
    SuotarCallContext, SuotarClient, endpoints, new_request_item_id,
};
use tracing::{Instrument, Span};

use crate::phase::{CreditRegistrationPhase, PhaseScope};
use crate::registry::{
    AttainmentSubmission, BatchReply, CourseCode, CourseCodeVerdicts, EnrolmentAnswer,
    EnrolmentLookup, ImportAnswer, PersonAnswer, PersonLookup, PersonLookupAnswer, RegistryError,
    RequestBatch, RosterCode, RosterListing, RosterSearch, StudentNumber, StudyRegistry,
    VerificationAnswer, VerificationRequest,
};
use crate::runtime::PhaseSkipReason;
use gate::{Exchange, StudyRegistryGate};

/// Forgets the limiter state of `scope`, so its endpoints are back at full rate with a full burst.
pub fn reset_rate_limits(scope: &PhaseScope) {
    rate_limit::reset(&breaker::ScopeKey::of(scope));
}

/// The span every request to `endpoint` runs in, whichever of the adapter's call sites sends it.
fn request_span(endpoint: SuotarEndpoint, items: usize, is_resent_half: bool) -> Span {
    debug_span!(
        "study_registry_request",
        ?endpoint,
        items,
        resent_half = is_resent_half
    )
}

/// The [`StudyRegistry`] over Suotar, for one phase iteration or one manual action.
pub(super) struct SuotarStudyRegistry<'a> {
    client: &'a SuotarClient,
    /// The audit log's `worker_name` for every call.
    worker_name: String,
    /// `None` for an interactive registry, whose calls no limiter or breaker learns from.
    gate: Option<StudyRegistryGate>,
    /// Replaces the endpoints' own timeouts, which run to minutes; only tests set it.
    request_timeout: Option<std::time::Duration>,
}

impl<'a> SuotarStudyRegistry<'a> {
    /// The registry one phase iteration sends through, or why the iteration waits.
    pub(super) fn admit(
        client: &'a SuotarClient,
        worker_name: String,
        phase: CreditRegistrationPhase,
        scope: &PhaseScope,
        test_mode: bool,
    ) -> Result<Self, PhaseSkipReason> {
        Ok(Self {
            client,
            worker_name,
            gate: Some(StudyRegistryGate::admit(phase, scope, test_mode)?),
            request_timeout: None,
        })
    }

    /// For calls someone is waiting on in the browser: the interactive timeout, and no allowance.
    pub(super) fn interactive(client: &'a SuotarClient, worker_name: String) -> Self {
        Self {
            client,
            worker_name,
            gate: None,
            request_timeout: None,
        }
    }

    /// Applies what the iteration's calls said to the breakers and the limiter, and returns the
    /// iteration's error, if any.
    pub(super) fn finish(self) -> Option<String> {
        self.gate.and_then(StudyRegistryGate::settle)
    }

    fn call_context(&self) -> SuotarCallContext {
        let context = SuotarCallContext::new(self.worker_name.clone());
        let context = if self.gate.is_none() {
            context.interactive()
        } else {
            context
        };
        // After `.interactive()`, which would otherwise overwrite it with the interactive timeout.
        match self.request_timeout {
            Some(request_timeout) => SuotarCallContext {
                request_timeout: Some(request_timeout),
                ..context
            },
            None => context,
        }
    }

    fn is_probe(&self) -> bool {
        self.gate.as_ref().is_some_and(StudyRegistryGate::is_probe)
    }

    fn spend(&mut self, endpoint: SuotarEndpoint, count: usize) {
        if let Some(gate) = self.gate.as_mut() {
            gate.spend(endpoint, count);
        }
    }

    /// For the resent halves of a batch refused as malformed, which may go past the allowance; see
    /// [`StudyRegistryGate::spend_split`].
    fn spend_split(&mut self, endpoint: SuotarEndpoint, count: usize) {
        if let Some(gate) = self.gate.as_mut() {
            gate.spend_split(endpoint, count);
        }
    }

    fn record(&mut self, endpoint: SuotarEndpoint, exchange: Exchange<'_>) {
        if let Some(gate) = self.gate.as_mut() {
            gate.record(endpoint, exchange);
        }
    }
}

impl StudyRegistry for SuotarStudyRegistry<'_> {
    fn allowance(&self, endpoint: SuotarEndpoint) -> usize {
        self.gate
            .as_ref()
            .map_or(0, |gate| gate.allowance(endpoint))
    }

    async fn resolve_persons<K>(
        &mut self,
        batch: RequestBatch<K, PersonLookup>,
    ) -> BatchReply<K, PersonLookup, PersonAnswer> {
        executor::send_batch::<endpoints::ResolvePersons, _, _, _>(
            self,
            batch,
            encode::person_lookup_item,
            decode::person_answer,
        )
        .await
    }

    async fn resolve_enrolments<K>(
        &mut self,
        batch: RequestBatch<K, EnrolmentLookup>,
    ) -> BatchReply<K, EnrolmentLookup, EnrolmentAnswer> {
        executor::send_batch::<endpoints::ResolveEnrolments, _, _, _>(
            self,
            batch,
            encode::enrolment_item,
            decode::enrolment_answer,
        )
        .await
    }

    async fn import_attainments<K>(
        &mut self,
        batch: RequestBatch<K, AttainmentSubmission>,
    ) -> BatchReply<K, AttainmentSubmission, ImportAnswer> {
        executor::send_batch::<endpoints::ImportAttainments, _, _, _>(
            self,
            batch,
            encode::import_item,
            decode::import_answer,
        )
        .await
    }

    async fn verify_attainments<K>(
        &mut self,
        batch: RequestBatch<K, VerificationRequest>,
    ) -> BatchReply<K, VerificationRequest, VerificationAnswer> {
        executor::send_batch::<endpoints::VerifyAttainments, _, _, _>(
            self,
            batch,
            encode::verify_item,
            decode::verification_answer,
        )
        .await
    }

    fn plan_roster_requests(
        &self,
        due: Vec<RosterCode>,
        request_limit: usize,
    ) -> Vec<Vec<RosterCode>> {
        rosters::plan_requests(due, request_limit, self.is_probe())
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

    async fn look_up_person(
        &self,
        student_number: &StudentNumber,
    ) -> Result<PersonLookupAnswer, RegistryError> {
        let request_item_id = new_request_item_id();
        let item = encode::person_item(student_number, request_item_id.clone());
        let span = request_span(SuotarEndpoint::ResolvePersons, 1, false);
        let response = self
            .client
            .post::<endpoints::ResolvePersons>(self.call_context(), vec![item])
            .instrument(span)
            .await
            .map_err(|error| {
                warn!(error = %error, "Could not resolve a student number in the study registry");
                decode::registry_error(&error)
            })?;
        Ok(match response.item(&request_item_id) {
            Some(item) => decode::person_lookup_answer(item),
            None => PersonLookupAnswer::Unanswered,
        })
    }

    async fn search_course_rosters(
        &self,
        codes: Vec<CourseCode>,
        student_number: &StudentNumber,
    ) -> RosterSearch {
        rosters::search(self, codes, student_number).await
    }
}
