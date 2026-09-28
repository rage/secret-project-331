//! Re-running the account-linking send path for one person on one course.
//!
//! Not a phase: no schedule, no heartbeat, no circuit-breaker bookkeeping — one manual click must not
//! be able to trip the workers' breaker. The addresses come from the study registry rather than the
//! ledger, and the claim goes through [`claim_linking_mails`], so the caps and dedup guard apply
//! exactly as they do to the worker.

use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use headless_lms_models::course_module_suotar_configurations::get_active_modules_for_course;
use headless_lms_models::library::credit_registration::account_linking::{
    ClaimedLinkingMails, DiscoveredPerson, claim_linking_mails, listed_person_addresses,
    retire_capped_mails,
};
use headless_lms_models::verified_student_numbers;
use sqlx::PgPool;
use std::collections::BTreeSet;
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::registry::{CourseCode, StudentNumber, StudyRegistry};

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
    /// The study registry does not list them under any course code of this course.
    NotOnTheCourseRoster,
    /// We could not ask the study registry, so nothing was decided.
    StudyRegistryUnavailable,
}

/// Claims a linking mail for the one person on the course's roster with this student number.
async fn resend_linking_mail<R: StudyRegistry>(
    pool: &PgPool,
    registry: &R,
    course_id: Uuid,
    student_number: &SecretString,
) -> CreditRegistrationResult<LinkingMailResendOutcome> {
    let course_codes: BTreeSet<String> = {
        let mut conn = pool.acquire().await?;
        get_active_modules_for_course(&mut conn, course_id)
            .await?
            .into_iter()
            .map(|module| module.uh_course_code)
            .collect()
    };
    if course_codes.is_empty() {
        return Ok(LinkingMailResendOutcome::NotOnTheCourseRoster);
    }

    let search = registry
        .search_course_rosters(
            course_codes.into_iter().map(CourseCode::new).collect(),
            &StudentNumber::new(student_number.clone()),
        )
        .await;
    let Some(person) = search.person else {
        return Ok(if search.has_unanswered_code {
            LinkingMailResendOutcome::StudyRegistryUnavailable
        } else {
            LinkingMailResendOutcome::NotOnTheCourseRoster
        });
    };

    let discovered = DiscoveredPerson {
        sisu_person_id: person.person_id.clone().into(),
        student_number: person.student_number.clone().into(),
        first_names: person.first_names.clone().map(Into::into),
        last_name: person.last_name.clone().map(Into::into),
        course_id,
        addresses: listed_person_addresses(&person),
    };
    if discovered.addresses.is_empty() {
        return Ok(LinkingMailResendOutcome::NoAddressInStudyRegistry);
    }

    let mut conn = pool.acquire().await?;
    let ClaimedLinkingMails {
        claimed,
        suppressed_by_dedup,
        suppressed_by_rate_cap,
    } = claim_linking_mails(&mut conn, &discovered).await?;
    debug!(
        course_id = %course_id,
        claimed,
        suppressed_by_dedup,
        suppressed_by_rate_cap,
        "Linking mail resend claim result"
    );
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

/// What [`crate::account_linking::resend_linking_mail_for_target`] decided.
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

/// An admin's go-ahead to get past the linking-mail caps by retiring the mails they count; see
/// [`retire_capped_mails`].
pub struct RateCapOverride<'a> {
    pub actor_user_id: Uuid,
    pub actor_role: &'a str,
    pub reason: &'a str,
}

/// [`crate::account_linking::resend_linking_mail_for_target`] through `registry`.
pub(crate) async fn resend_for_target<R: StudyRegistry>(
    pool: &PgPool,
    registry: &R,
    course_id: Uuid,
    student_number: &SecretString,
    rate_cap_override: Option<RateCapOverride<'_>>,
) -> CreditRegistrationResult<ResendAttempt> {
    let already_linked = {
        let mut conn = pool.acquire().await?;
        verified_student_numbers::get_by_student_number(&mut conn, student_number.expose_secret())
            .await?
            .is_some()
    };
    if already_linked {
        return Ok(ResendAttempt {
            decision: ResendDecision::AlreadyLinked,
            retired_mail_count: 0,
        });
    }
    let retired_mail_count = match rate_cap_override {
        Some(rate_cap_override) => {
            let mut conn = pool.acquire().await?;
            retire_capped_mails(
                &mut conn,
                rate_cap_override.actor_user_id,
                rate_cap_override.actor_role,
                course_id,
                student_number.expose_secret(),
                rate_cap_override.reason,
            )
            .await?
        }
        None => 0,
    };
    let decision = ResendDecision::Attempted(
        resend_linking_mail(pool, registry, course_id, student_number).await?,
    );
    Ok(ResendAttempt {
        decision,
        retired_mail_count,
    })
}
