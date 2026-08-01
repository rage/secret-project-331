//! Re-running the account-linking send path for one person on one course.
//!
//! Not a phase: no schedule, no heartbeat, no circuit-breaker bookkeeping — one manual click must not
//! be able to trip the workers' breaker. It reuses the phase context because it makes the same
//! `list-by-course` call the `enrolment-discovery` phase does.
//!
//! Two properties this exists to preserve. The addresses come from the study registry, not from the
//! ledger, so a resend can only reach an address the pipeline itself would have reached — and it is
//! only ever useful when the registry holds an address we have not mailed. And the claim goes through
//! [`claim_linking_mails`], the single writer of the ledger, so both caps and the dedup guard apply
//! exactly as they do to the worker. Nothing here can relax them.

use headless_lms_models::course_module_suotar_realisations::{
    get_stalest_for_listing, listing_request_item_id,
};
use headless_lms_models::library::credit_registration::account_linking::{
    ClaimedLinkingMails, DiscoveredPerson, claim_linking_mails,
};
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
};
use uuid::Uuid;

use super::{CreditRegistrationPhase, PhaseContext, listed_person_addresses, worker_name};

/// What one resend attempt did. Disjoint, and every variant is something the caller can say out loud.
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
    let realisations = get_stalest_for_listing(
        &mut conn,
        SuotarEndpoint::ListByCourse.max_batch_size() as i64,
        Some(course_id),
    )
    .await?;

    let mut items = Vec::new();
    for realisation in &realisations {
        let Some(course_code) = realisation
            .uh_course_code
            .as_deref()
            .map(str::trim)
            .filter(|code| !code.is_empty())
        else {
            continue;
        };
        items.push(ListByCourseRequestItem {
            request_item_id: listing_request_item_id(realisation.id),
            course_code: course_code.to_string(),
            course_unit_realisation_id: Some(realisation.course_unit_realisation_id.clone()),
        });
    }
    if items.is_empty() {
        return Ok(LinkingMailResendOutcome::NotOnTheCourseRoster);
    }

    let response = ctx
        .suotar_client
        .list_enrolments_by_course(
            SuotarCallContext::new(worker_name(
                ctx.caller,
                CreditRegistrationPhase::EnrolmentDiscovery,
            )),
            items,
        )
        .await;
    let Ok(response) = response else {
        return Ok(LinkingMailResendOutcome::StudyRegistryUnavailable);
    };

    let Some(person) = response
        .items
        .iter()
        .filter(|item| item.status == SuotarItemStatus::Ok)
        .filter_map(|item| item.result.as_ref())
        .flat_map(|result| result.people.iter())
        .find(|person| person.student_number == student_number)
    else {
        return Ok(LinkingMailResendOutcome::NotOnTheCourseRoster);
    };

    let discovered = DiscoveredPerson {
        sisu_person_id: person.person_id.clone(),
        student_number: person.student_number.clone(),
        first_names: Some(person.first_names.clone()),
        last_name: Some(person.last_name.clone()),
        course_id,
        addresses: listed_person_addresses(person),
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
