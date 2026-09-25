//! The one place an iteration's Suotar requests meet the circuit breakers and the limiter: every
//! request is spent through the gate and recorded in it, and [`StudyRegistryGate::settle`] turns
//! the records into the breaker and limiter effects.

use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::library::credit_registration::classification::{
    is_all_unavailable, is_only_sisu_timeouts,
};
use headless_lms_utils::services::suotar::{SuotarBatchResponse, SuotarEndpoint, SuotarError};

use crate::breaker::{self, BreakerTarget, ScopeKey};
use crate::dispatch::PhaseSkipReason;
use crate::phase::{CreditRegistrationPhase, PhaseScope};
use crate::rate_limit;

/// What one request to Suotar came to.
pub(crate) enum Exchange<'a> {
    /// Suotar answered; `unavailable` when every item came back unavailable.
    Answered { unavailable: Option<Unavailable> },
    /// Suotar refused the whole request, or it never got there.
    Refused(&'a SuotarError),
    /// Suotar refused a request only one row or code of ours can be to blame for: that row's own
    /// fault, which says nothing about Suotar.
    RefusedAlone(&'a SuotarError),
}

/// A batch whose every item came back unavailable, which fails the iteration.
pub(crate) struct Unavailable {
    /// The iteration's error for it.
    pub message: &'static str,
    /// Sisu timed out on every submission: Suotar itself answered, so only the phase that submits
    /// pauses.
    pub is_only_sisu_timeouts: bool,
}

impl Exchange<'_> {
    /// An answer; `unavailable_message` is the iteration's error if every item came back
    /// unavailable.
    pub fn answered<R>(
        response: &SuotarBatchResponse<R>,
        unavailable_message: &'static str,
    ) -> Self {
        Self::Answered {
            unavailable: is_all_unavailable(response).then(|| Unavailable {
                message: unavailable_message,
                is_only_sisu_timeouts: is_only_sisu_timeouts(response),
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
    /// Nothing reached Suotar, or nothing that says whether it is up, so it neither counts against
    /// a breaker nor clears a run of failures: an empty queue is the common case, and counting it
    /// would reset the run every tick and never let the breaker open during an outage.
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

/// One iteration's passage through the circuit breakers and the limiter. A phase asks it how much
/// it may send, spends that before sending, and records what came back; nothing else in an
/// iteration touches [`breaker`] or [`rate_limit`].
pub(crate) struct StudyRegistryGate {
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
    pub fn admit(
        phase: CreditRegistrationPhase,
        scope: &PhaseScope,
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
    pub fn is_probe(&self) -> bool {
        self.is_probe
    }

    /// How many items one request to `endpoint` may carry now: its batch size, cut to what the
    /// limiter allows, or during a probe one item for the first request and none after it. For
    /// `list-by-course`, whose limiter counts requests, how many requests.
    pub fn allowance(&self, endpoint: SuotarEndpoint) -> usize {
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
        debug!(
            ?endpoint,
            limit, "Computed the claim limit for a Suotar endpoint"
        );
        limit
    }

    /// Spends `count` of what [`Self::allowance`] allowed, just before the request leaves.
    pub fn spend(&mut self, endpoint: SuotarEndpoint, count: usize) {
        rate_limit::take(&self.key, endpoint, count);
        self.has_probed = true;
    }

    pub fn record(&mut self, endpoint: SuotarEndpoint, exchange: Exchange<'_>) {
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
                tally.has_registry_failure |= error.was_sent && error.variant.is_transient();
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
    pub fn settle(self) -> Option<String> {
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
                if submits_to_sisu && breaker::record_success(key, BreakerTarget::SisuSubmissions) {
                    info!(phase, "Sisu submissions circuit breaker closed");
                }
            }
            Verdict::SisuOutage => {
                record_study_registry_success(key);
                if let Some(cooldown) =
                    breaker::record_failure(key, BreakerTarget::SisuSubmissions, base_cooldown)
                {
                    warn!(
                        phase,
                        cooldown_secs = cooldown.as_secs(),
                        consecutive_failures = breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES,
                        "Pausing phase after consecutive Sisu timeouts"
                    );
                }
            }
            Verdict::RegistryDown => {
                if let Some(cooldown) =
                    breaker::record_failure(key, BreakerTarget::StudyRegistry, base_cooldown)
                {
                    rate_limit::drop_to_floor(key, &rate_limit::LIMITED_ENDPOINTS);
                    warn!(
                        phase,
                        cooldown_secs = cooldown.as_secs(),
                        consecutive_failures = breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES,
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
    if breaker::record_success(key, BreakerTarget::StudyRegistry) {
        rate_limit::drop_to_floor(key, &rate_limit::LIMITED_ENDPOINTS);
        info!("Study registry circuit breaker closed");
    }
}
