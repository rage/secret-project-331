//! Re-running the account-linking send path for one person on one course.
//!
//! Not a phase: no schedule, no heartbeat, no circuit-breaker bookkeeping — one manual click must not
//! be able to trip the workers' breaker. The addresses come from the study registry rather than the
//! ledger, and the claim goes through [`claim_linking_mails`], so the caps and dedup guard apply
//! exactly as they do to the worker.

use std::future::Future;
use std::pin::Pin;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use headless_lms_models::course_module_suotar_realisations::{
    get_active_for_course, listing_request_item_id,
};
use headless_lms_models::library::credit_registration::account_linking::{
    ClaimedLinkingMails, DiscoveredPerson, claim_linking_mails,
};
use headless_lms_models::verified_student_numbers;
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, ResolvePersonRequestItem, SuotarCallContext, SuotarEndpoint,
    SuotarItemStatus,
};
use uuid::Uuid;

use super::{CreditRegistrationPhase, PhaseContext, listed_person_addresses, worker_name};

/// What one resend attempt did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkingMailResendOutcome {
    /// A slot was claimed; the `link-emails` phase queues the message on its next run.
    Claimed,
    /// Every address the study registry holds for them has already had its mail for this course.
    AlreadyMailedToEveryKnownAddress,
    /// A cap refused it: either the quiet period or the per-course lifetime limit.
    RefusedByRateCap,
    NoAddressInStudyRegistry,
    /// The study registry does not list them on any realisation of this course.
    NotOnTheCourseRoster,
    /// We could not ask the study registry, so nothing was decided.
    StudyRegistryUnavailable,
}

/// Claims a linking mail for the one person on the course's roster with this student number.
pub async fn resend_linking_mail(
    ctx: &PhaseContext<'_>,
    course_id: Uuid,
    student_number: &str,
) -> anyhow::Result<LinkingMailResendOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let realisations = get_active_for_course(&mut conn, course_id).await?;

    let mut items = Vec::new();
    for realisation in &realisations {
        let Some(course_code) = super::enrolment_discovery::listable_course_code(realisation)
        else {
            continue;
        };
        items.push(ListByCourseRequestItem {
            request_item_id: listing_request_item_id(realisation.id),
            course_code,
            course_unit_realisation_id: Some(realisation.course_unit_realisation_id.clone()),
        });
    }
    if items.is_empty() {
        return Ok(LinkingMailResendOutcome::NotOnTheCourseRoster);
    }

    // A course can hold more realisations than one `list-by-course` request may carry.
    let mut person = None;
    for chunk in items.chunks(SuotarEndpoint::ListByCourse.max_batch_size()) {
        let response = ctx
            .suotar_client
            .list_enrolments_by_course(
                SuotarCallContext::new(worker_name(
                    ctx.caller,
                    CreditRegistrationPhase::EnrolmentDiscovery,
                )),
                chunk.to_vec(),
            )
            .await;
        let Ok(response) = response else {
            return Ok(LinkingMailResendOutcome::StudyRegistryUnavailable);
        };
        person = response
            .items
            .iter()
            .filter(|item| item.status == SuotarItemStatus::Ok)
            .filter_map(|item| item.result.as_ref())
            .flat_map(|result| result.people.iter())
            .find(|candidate| candidate.student_number == student_number)
            .cloned();
        if person.is_some() {
            break;
        }
    }
    let Some(person) = person else {
        return Ok(LinkingMailResendOutcome::NotOnTheCourseRoster);
    };

    let discovered = DiscoveredPerson {
        sisu_person_id: person.person_id.clone(),
        student_number: person.student_number.clone(),
        first_names: Some(person.first_names.clone()),
        last_name: Some(person.last_name.clone()),
        course_id,
        addresses: listed_person_addresses(&person),
    };
    if discovered.addresses.is_empty() {
        return Ok(LinkingMailResendOutcome::NoAddressInStudyRegistry);
    }

    let ClaimedLinkingMails {
        claimed,
        suppressed_by_dedup,
        suppressed_by_rate_cap,
    } = claim_linking_mails(&mut conn, &discovered).await?;
    if claimed > 0 {
        return Ok(LinkingMailResendOutcome::Claimed);
    }
    if suppressed_by_rate_cap > 0 {
        return Ok(LinkingMailResendOutcome::RefusedByRateCap);
    }
    if suppressed_by_dedup > 0 {
        return Ok(LinkingMailResendOutcome::AlreadyMailedToEveryKnownAddress);
    }
    Ok(LinkingMailResendOutcome::NoAddressInStudyRegistry)
}

/// What [`resend_linking_mail_for_target`] decided.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResendDecision {
    /// The number is already linked to an account, so no linking mail is owed.
    AlreadyLinked,
    Attempted(LinkingMailResendOutcome),
}

/// The outcome of one resend attempt, plus how many capped mails an override retired to get there.
pub struct ResendAttempt {
    pub decision: ResendDecision,
    /// Always zero without an override; only the admin-facing endpoint can pass one.
    pub retired_mail_count: i64,
}

/// What a resend endpoint tells its caller. Shared wire shape for the teacher- and admin-facing
/// resend endpoints; `NoStudentNumberKnown` is only ever emitted by the teacher endpoint, whose
/// target may be an account that has never held a number.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ResendOutcome {
    /// A mail is owed and will be handed to the sender on the next run.
    Queued,
    AlreadyMailedToEveryKnownAddress,
    /// A cap refused it.
    RefusedByRateCap,
    NoAddressInStudyRegistry,
    NotOnTheCourseRoster,
    /// The number is already linked to an account, so no linking mail is owed.
    AlreadyLinked,
    StudyRegistryUnavailable,
    /// This account has never had a student number, so there is nothing to look up.
    NoStudentNumberKnown,
}

impl From<ResendDecision> for ResendOutcome {
    fn from(decision: ResendDecision) -> Self {
        match decision {
            ResendDecision::AlreadyLinked => Self::AlreadyLinked,
            ResendDecision::Attempted(LinkingMailResendOutcome::Claimed) => Self::Queued,
            ResendDecision::Attempted(
                LinkingMailResendOutcome::AlreadyMailedToEveryKnownAddress,
            ) => Self::AlreadyMailedToEveryKnownAddress,
            ResendDecision::Attempted(LinkingMailResendOutcome::RefusedByRateCap) => {
                Self::RefusedByRateCap
            }
            ResendDecision::Attempted(LinkingMailResendOutcome::NoAddressInStudyRegistry) => {
                Self::NoAddressInStudyRegistry
            }
            ResendDecision::Attempted(LinkingMailResendOutcome::NotOnTheCourseRoster) => {
                Self::NotOnTheCourseRoster
            }
            ResendDecision::Attempted(LinkingMailResendOutcome::StudyRegistryUnavailable) => {
                Self::StudyRegistryUnavailable
            }
        }
    }
}

/// Shared by the teacher- and admin-facing resend endpoints: refuses a target that is already linked,
/// otherwise runs `before_send` (the admin path's rate-cap override; the teacher path passes a no-op)
/// and reruns the send path exactly as the worker would.
///
/// `before_send` runs strictly after the already-linked check and before [`resend_linking_mail`], so an
/// override never retires mails for a number that turns out to already be linked.
pub async fn resend_linking_mail_for_target<'a>(
    ctx: &PhaseContext<'_>,
    course_id: Uuid,
    student_number: &str,
    before_send: Pin<Box<dyn Future<Output = anyhow::Result<i64>> + 'a>>,
) -> anyhow::Result<ResendAttempt> {
    let already_linked = {
        let mut conn = ctx.pool.acquire().await?;
        verified_student_numbers::get_by_student_number(&mut conn, student_number)
            .await?
            .is_some()
    };
    if already_linked {
        return Ok(ResendAttempt {
            decision: ResendDecision::AlreadyLinked,
            retired_mail_count: 0,
        });
    }
    let retired_mail_count = before_send.await?;
    let decision =
        ResendDecision::Attempted(resend_linking_mail(ctx, course_id, student_number).await?);
    Ok(ResendAttempt {
        decision,
        retired_mail_count,
    })
}

pub struct ResolvedPerson {
    pub sisu_person_id: String,
    pub first_names: String,
    pub last_name: String,
    /// The registry's own per-item code, an identifier rather than prose.
    pub code: String,
}

/// Why [`resolve_person`] could not say whether the number exists. Both cases read the same to a
/// caller: the registry could not be asked.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolvePersonError {
    /// The request itself failed: network, auth, or a request-level error from the registry.
    StudyRegistryUnavailable,
    /// The registry answered but its response did not include this item.
    ItemMissingFromResponse,
}

/// Looks one student number up in the study registry without changing anything: no ledger row, no
/// claimed mail slot, just the call log row every study registry call writes.
///
/// `Ok(None)` means the registry answered and does not know the number; `Err` means we could not ask.
pub async fn resolve_person(
    ctx: &PhaseContext<'_>,
    student_number: &str,
) -> Result<Option<ResolvedPerson>, ResolvePersonError> {
    let request_item_id = format!("admin-{student_number}");
    let response = ctx
        .suotar_client
        .resolve_persons(
            SuotarCallContext::new(ctx.caller),
            vec![ResolvePersonRequestItem {
                request_item_id: request_item_id.clone(),
                student_number: student_number.to_string(),
            }],
        )
        .await
        .map_err(|_| ResolvePersonError::StudyRegistryUnavailable)?;
    let Some(item) = response.item(&request_item_id) else {
        return Err(ResolvePersonError::ItemMissingFromResponse);
    };
    let Some(result) = item.result.as_ref() else {
        return Ok(None);
    };
    Ok(Some(ResolvedPerson {
        sisu_person_id: result.person_id.clone(),
        first_names: result.first_names.clone(),
        last_name: result.last_name.clone(),
        code: item.code.clone(),
    }))
}
