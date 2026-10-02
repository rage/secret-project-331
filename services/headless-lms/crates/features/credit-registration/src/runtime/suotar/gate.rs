//! The one place an iteration's Suotar requests meet the circuit breakers and the limiter: every
//! request is spent through the gate and recorded in it, and [`StudyRegistryGate::settle`] turns
//! the records into the breaker and limiter effects.

use headless_lms_data_operations::library::credit_registration::scrub::scrub_text;
use headless_lms_utils::services::suotar::{SuotarBatchResponse, SuotarEndpoint, SuotarError};

use super::breaker::{self, BreakerTarget};
use super::codes::{is_all_unavailable, is_only_sisu_timeouts};
use super::decode::registry_error;
use super::rate_limit;
use crate::phase::CreditRegistrationPhase;
use crate::runtime::PhaseSkipReason;
use crate::runtime::process_local::ScopeKey;
use headless_lms_models::credit_registrations::RegistrationScope;

/// What one request to Suotar came to.
pub(super) enum Exchange<'a> {
    /// Suotar answered; `unavailable` when every item came back unavailable.
    Answered { unavailable: Option<Unavailable> },
    /// Suotar refused the whole request, or it never got there.
    Refused(&'a SuotarError),
    /// Suotar refused a request that only one row or code of ours can be blamed for — says
    /// nothing about Suotar's own health.
    RefusedAlone(&'a SuotarError),
}

/// A batch whose every item came back unavailable, which fails the iteration.
pub(super) struct Unavailable {
    /// The iteration's error for it.
    pub message: &'static str,
    /// Sisu timed out on every submission: Suotar itself answered, so only the phase that submits
    /// pauses.
    pub is_only_sisu_timeouts: bool,
}

impl Exchange<'_> {
    /// An answer; `unavailable_message` is the iteration's error if every item came back
    /// unavailable.
    pub(super) fn answered<R>(
        response: &SuotarBatchResponse<R>,
        unavailable_message: &'static str,
    ) -> Self {
        let endpoint = response.endpoint;
        let items = &response.items;
        let answers = items.iter().map(|item| (item.status, item.code.as_str()));
        Self::Answered {
            unavailable: is_all_unavailable(endpoint, answers).then(|| Unavailable {
                message: unavailable_message,
                is_only_sisu_timeouts: is_only_sisu_timeouts(
                    endpoint,
                    items.iter().map(|item| item.code.as_str()),
                ),
            }),
        }
    }
}

/// What the exchanges of one iteration said about the study registry.
#[derive(Debug, Default)]
struct Tally {
    has_answer: bool,
    /// Suotar failing in a way that can pass: a transport error, a timeout or a 5xx, or every item
    /// of an answer unavailable.
    has_registry_failure: bool,
    has_sisu_outage: bool,
    /// The first failure of the iteration, which stands for it.
    error: Option<String>,
    /// The first request refused with one row or code alone in it.
    isolated: Option<String>,
    /// The endpoints whose own failures drop their limiter to its floor.
    failed_endpoints: Vec<SuotarEndpoint>,
}

/// What [`StudyRegistryGate::settle`] makes of a [`Tally`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Verdict {
    /// Nothing reached Suotar, or nothing that says whether it's up: counts against no breaker and
    /// clears no failure run — an empty queue is common, and clearing on it would hide a real outage.
    Idle,
    Healthy,
    /// Suotar answered, and Sisu timed out on every submission.
    SisuOutage,
    RegistryDown,
}

fn verdict(tally: &Tally) -> Verdict {
    if tally.has_registry_failure {
        Verdict::RegistryDown
    } else if tally.has_sisu_outage {
        Verdict::SisuOutage
    } else if tally.has_answer {
        Verdict::Healthy
    } else {
        Verdict::Idle
    }
}

/// One iteration's passage through the circuit breakers and the limiter. The adapter asks it how
/// much it may send, spends that before sending, and records what came back; nothing else in an
/// iteration touches [`breaker`] or [`rate_limit`].
pub(super) struct StudyRegistryGate {
    key: ScopeKey,
    phase: CreditRegistrationPhase,
    test_mode: bool,
    /// After a breaker's cooldown: the iteration may send one single-item request, whichever of its
    /// flows sends it, and the breaker closes only if that request succeeds.
    is_probe: bool,
    has_probed: bool,
    tally: Tally,
}

impl StudyRegistryGate {
    /// Lets the iteration run, or says why it waits. Only a phase that calls the study registry
    /// ever waits: an outage must not stall the database-only phases.
    pub(super) fn admit(
        phase: CreditRegistrationPhase,
        scope: &RegistrationScope,
        test_mode: bool,
    ) -> Result<Self, PhaseSkipReason> {
        let key = ScopeKey::of(scope);
        let targets = phase.spec().breakers;
        if targets.iter().any(|&target| breaker::is_open(&key, target)) {
            return Err(PhaseSkipReason::CircuitBreakerOpen);
        }
        let is_probe = targets
            .iter()
            .any(|&target| breaker::is_half_open(&key, target));
        Ok(Self {
            key,
            phase,
            test_mode,
            is_probe,
            has_probed: false,
            tally: Tally::default(),
        })
    }

    /// Whether the iteration is a breaker's probe: see [`Self::allowance`].
    pub(super) fn is_probe(&self) -> bool {
        self.is_probe
    }

    /// How many items one request to `endpoint` may carry now: its batch size, cut to what the
    /// limiter allows, or during a probe one item for the first request and none after it. For
    /// `list-by-course`, whose limiter counts requests, how many requests.
    pub(super) fn allowance(&self, endpoint: SuotarEndpoint) -> usize {
        if self.is_probe {
            let allowance = usize::from(!self.has_probed);
            if breaker::is_half_open(&self.key, BreakerTarget::StudyRegistry) {
                debug!(
                    ?endpoint,
                    allowance, "Study registry breaker is half-open; probing with one item"
                );
            } else {
                debug!(
                    ?endpoint,
                    allowance, "Sisu submissions breaker is half-open; probing with one item"
                );
            }
            return allowance;
        }
        let limit = endpoint
            .max_batch_size()
            .min(rate_limit::available(&self.key, endpoint));
        trace!(
            ?endpoint,
            limit, "Computed the claim limit for a Suotar endpoint"
        );
        limit
    }

    /// Spends `count` of what [`Self::allowance`] allowed, just before the request leaves.
    pub(super) fn spend(&mut self, endpoint: SuotarEndpoint, count: usize) {
        rate_limit::take(&self.key, endpoint, count);
        self.has_probed = true;
    }

    /// [`Self::spend`] for the resent halves of a batch refused as malformed, which may go past
    /// the allowance; see [`rate_limit::overdraw`].
    pub(super) fn spend_split(&mut self, endpoint: SuotarEndpoint, count: usize) {
        rate_limit::overdraw(&self.key, endpoint, count);
        self.has_probed = true;
    }

    /// Records what one request to `endpoint` came to, for [`Self::settle`].
    pub(super) fn record(&mut self, endpoint: SuotarEndpoint, exchange: Exchange<'_>) {
        let tally = &mut self.tally;
        match exchange {
            Exchange::Answered { unavailable: None } => tally.has_answer = true,
            Exchange::Answered {
                unavailable: Some(unavailable),
            } => {
                tally.has_answer = true;
                tally
                    .error
                    .get_or_insert_with(|| unavailable.message.to_string());
                if unavailable.is_only_sisu_timeouts {
                    tally.has_sisu_outage = true;
                } else {
                    tally.has_registry_failure = true;
                    tally.failed_endpoints.push(endpoint);
                }
            }
            Exchange::Refused(error) => {
                tally
                    .error
                    .get_or_insert_with(|| scrub_text(error.message()));
                // Only Suotar failing counts: not our own request or credentials, and not a request
                // that never left.
                tally.has_registry_failure |=
                    error.was_sent && registry_error(error).kind.is_outage();
                tally.failed_endpoints.push(endpoint);
            }
            Exchange::RefusedAlone(error) => {
                tally
                    .isolated
                    .get_or_insert_with(|| scrub_text(error.message()));
            }
        }
    }

    /// Applies what the iteration's exchanges said to the breakers and the limiter, and returns the
    /// iteration's error, if any. A request refused with its row alone is reported only when
    /// nothing answered, and counts against no breaker.
    ///
    /// The limiter drops to its floor whenever the shared breaker trips or closes again, so the ramp
    /// back starts from the probe that got through rather than from a failure a long cooldown ago.
    pub(super) fn settle(self) -> Option<String> {
        let key = &self.key;
        let phase = self.phase.as_str();
        let base_cooldown = breaker::cooldown(self.test_mode);
        let submits_to_sisu = self
            .phase
            .spec()
            .breakers
            .contains(&BreakerTarget::SisuSubmissions);
        rate_limit::drop_to_floor(key, &self.tally.failed_endpoints);
        match verdict(&self.tally) {
            Verdict::Idle => {}
            Verdict::Healthy => {
                record_study_registry_success(key);
                if submits_to_sisu
                    && let Some(trip_count) =
                        breaker::record_success(key, BreakerTarget::SisuSubmissions)
                {
                    info!(phase, trip_count, "Sisu submissions circuit breaker closed");
                }
            }
            Verdict::SisuOutage => {
                record_study_registry_success(key);
                if let Some(trip) =
                    breaker::record_failure(key, BreakerTarget::SisuSubmissions, base_cooldown)
                {
                    warn!(
                        phase,
                        cooldown_secs = trip.cooldown.as_secs(),
                        consecutive_failures = trip.consecutive_failures,
                        trip_count = trip.trip_count,
                        "Pausing phase after consecutive Sisu timeouts"
                    );
                }
            }
            Verdict::RegistryDown => {
                if let Some(trip) =
                    breaker::record_failure(key, BreakerTarget::StudyRegistry, base_cooldown)
                {
                    rate_limit::drop_to_floor(key, &rate_limit::LIMITED_ENDPOINTS);
                    warn!(
                        phase,
                        cooldown_secs = trip.cooldown.as_secs(),
                        consecutive_failures = trip.consecutive_failures,
                        trip_count = trip.trip_count,
                        "Pausing study registry phases after consecutive failures"
                    );
                }
            }
        }
        let tally = self.tally;
        tally.error.or(if tally.has_answer {
            None
        } else {
            tally.isolated
        })
    }
}

fn record_study_registry_success(key: &ScopeKey) {
    if let Some(trip_count) = breaker::record_success(key, BreakerTarget::StudyRegistry) {
        rate_limit::drop_to_floor(key, &rate_limit::LIMITED_ENDPOINTS);
        info!(trip_count, "Study registry circuit breaker closed");
    }
}
