//! The account-linking action an admin or a teacher sets off by hand: re-running the linking mail
//! send path for one person on one course. Not a phase: no schedule and no allowance, and no
//! breaker learns from its calls, so one click cannot trip the workers'.
//!
//! The addresses come from the study registry rather than the ledger, and the claim goes through
//! [`claim_linking_mails`], so the caps and dedup guard apply exactly as they do to the worker.

use secrecy::{ExposeSecret, SecretString};

use headless_lms_data_operations::library::credit_registration::account_linking::{
    ClaimedLinkingMails, DiscoveredPerson, claim_linking_mails, retire_capped_mails,
};
use headless_lms_models::course_module_suotar_configurations::get_active_modules_for_course;
use headless_lms_models::verified_student_numbers;
use sqlx::{Connection, PgPool};
use std::collections::BTreeSet;
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::registry::{CourseCode, InteractiveStudyRegistry, StudentNumber};

/// What one resend attempt came to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResendOutcome {
    /// A slot was claimed; the `link-emails` phase queues the message on its next run.
    Queued,
    /// Every address the study registry holds for them has already had its mail for this course.
    AlreadyMailedToEveryKnownAddress,
    /// A cap refused it: either the quiet period or the per-course lifetime limit.
    RefusedByRateCap,
    NoAddressInStudyRegistry,
    /// The study registry does not list them under any course code of this course.
    NotOnTheCourseRoster,
    /// The number is already linked to an account, so no linking mail is owed.
    AlreadyLinked,
    /// We could not ask the study registry, so nothing was decided.
    StudyRegistryUnavailable,
}

/// The outcome of one resend attempt, plus how many capped mails an override retired to get there.
pub struct ResendAttempt {
    pub outcome: ResendOutcome,
    /// Always zero without an override; only the admin-facing endpoint can pass one.
    pub retired_mail_count: i64,
}

/// An admin's go-ahead to get past the linking-mail caps by retiring the mails they count; see
/// [`retire_capped_mails`].
pub struct RateCapOverride<'a> {
    pub actor_user_id: Uuid,
    pub actor_role: &'a str,
    pub reason: &'a str,
}

/// [`crate::account_linking::resend_linking_mail_for_target`] through `registry`.
pub(crate) async fn resend_for_target<R: InteractiveStudyRegistry>(
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
            outcome: ResendOutcome::AlreadyLinked,
            retired_mail_count: 0,
        });
    }
    resend_linking_mail(
        pool,
        registry,
        course_id,
        student_number,
        rate_cap_override.as_ref(),
    )
    .await
}

/// Claims a linking mail for the one person on the course's roster with this student number.
///
/// The override retires the capped mails only once the registry has named an address to mail, in
/// the claim's transaction, so a lookup that decides nothing leaves the caps in place.
async fn resend_linking_mail<R: InteractiveStudyRegistry>(
    pool: &PgPool,
    registry: &R,
    course_id: Uuid,
    student_number: &SecretString,
    rate_cap_override: Option<&RateCapOverride<'_>>,
) -> CreditRegistrationResult<ResendAttempt> {
    let not_retired = |outcome| ResendAttempt {
        outcome,
        retired_mail_count: 0,
    };
    let course_codes: Vec<CourseCode> = {
        let mut conn = pool.acquire().await?;
        get_active_modules_for_course(&mut conn, course_id)
            .await?
            .iter()
            .filter_map(|module| CourseCode::parse(&module.uh_course_code))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect()
    };
    if course_codes.is_empty() {
        return Ok(not_retired(ResendOutcome::NotOnTheCourseRoster));
    }

    let search = registry
        .search_course_rosters(&course_codes, &StudentNumber::new(student_number.clone()))
        .await;
    let Some(person) = search.person else {
        return Ok(not_retired(if search.has_unanswered_code {
            ResendOutcome::StudyRegistryUnavailable
        } else {
            ResendOutcome::NotOnTheCourseRoster
        }));
    };

    let discovered = DiscoveredPerson::listed(&person, course_id);
    if discovered.addresses.is_empty() {
        return Ok(not_retired(ResendOutcome::NoAddressInStudyRegistry));
    }

    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let retired_mail_count = match rate_cap_override {
        Some(rate_cap_override) => {
            retire_capped_mails(
                &mut tx,
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
    let ClaimedLinkingMails {
        claimed,
        suppressed_by_dedup,
        suppressed_by_rate_cap,
    } = claim_linking_mails(&mut tx, &discovered).await?;
    tx.commit().await?;
    debug!(
        course_id = %course_id,
        claimed,
        suppressed_by_dedup,
        suppressed_by_rate_cap,
        "Linking mail resend claim result"
    );
    let outcome = if claimed > 0 {
        ResendOutcome::Queued
    } else if suppressed_by_rate_cap > 0 {
        ResendOutcome::RefusedByRateCap
    } else if suppressed_by_dedup > 0 {
        ResendOutcome::AlreadyMailedToEveryKnownAddress
    } else {
        ResendOutcome::NoAddressInStudyRegistry
    };
    Ok(ResendAttempt {
        outcome,
        retired_mail_count,
    })
}
