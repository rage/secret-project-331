//! Linking a student number without the emailed round trip, when the study registry's primary
//! address for a person is an address one of our accounts has proved it controls.
//!
//! This is a *terminal branch* taken before a linking mail is claimed, never a filter in front of
//! one: every outcome other than [`FastTrackDecision::Link`] falls through to the ordinary mailed
//! link. The population whose two addresses differ is exactly the population the linking mail exists
//! for, and nothing here may narrow it.

use unicode_normalization::UnicodeNormalization;

use crate::credit_registration_events::CreditRegistrationEventKind;
use crate::prelude::*;
use crate::user_details::EmailVerificationMethod;
use crate::verified_student_numbers::{
    NewVerifiedStudentNumber, StudentNumberVerificationMethod, replace_verified_student_number,
};

/// Recorded on the link as `verified_via_email_match_field`. The study registry's secondary address
/// is self-entered, so it is never proof; the value is reserved rather than accepted.
pub const MATCHED_FIELD_PRIMARY: &str = "primary";

/// What an account offers the fast track, gathered in one query so the decision below stays pure.
#[derive(Debug, Clone, PartialEq)]
pub struct FastTrackCandidate {
    pub user_id: Uuid,
    pub email: String,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub email_verified_method: Option<EmailVerificationMethod>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// Any live link, whatever its number: replacing one silently is worse than mailing the link,
    /// whose confirmation screen names both numbers.
    pub has_live_student_number: bool,
    /// Whether this account already unlinked an automatic link for this same person.
    pub unlinked_a_fast_track_link_before: bool,
}

/// Why the fast track did or did not fire for one listed person. Every variant but `Link` means the
/// ordinary linking mail is still owed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FastTrackDecision {
    Link,
    /// The registry's primary address is not an address of any live account here.
    NoAccountMatch,
    /// The account holds the address but has never proved control of it. Without that proof, address
    /// equality is a one-request impersonation primitive, since the address is self-service editable.
    UnverifiedAccount,
    StaleVerification,
    NameMismatch,
    AccountHasStudentNumber,
    UnlinkedBefore,
}

/// The names the study registry holds for a listed person, for the loose name check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RegistryName<'a> {
    pub first_names: Option<&'a str>,
    pub last_name: Option<&'a str>,
}

/// The whole fast-track predicate, as one pure function over facts the caller has already read.
///
/// `max_verification_age` bounds how old the proof may be: a deprovisioned university address can be
/// reissued to a different person, and the account holding it would still look verified.
/// [`EmailVerificationMethod::AdminAsserted`] is deliberately not accepted — it is support's word,
/// not a proof of mailbox control, and it is the obvious social-engineering target.
pub fn decide_fast_track(
    candidate: Option<&FastTrackCandidate>,
    registry_name: RegistryName<'_>,
    now: DateTime<Utc>,
    max_verification_age: chrono::Duration,
) -> FastTrackDecision {
    let Some(candidate) = candidate else {
        return FastTrackDecision::NoAccountMatch;
    };
    let (Some(verified_at), Some(method)) =
        (candidate.email_verified_at, candidate.email_verified_method)
    else {
        return FastTrackDecision::UnverifiedAccount;
    };
    if method == EmailVerificationMethod::AdminAsserted {
        return FastTrackDecision::UnverifiedAccount;
    }
    if verified_at < now - max_verification_age {
        return FastTrackDecision::StaleVerification;
    }
    if candidate.unlinked_a_fast_track_link_before {
        return FastTrackDecision::UnlinkedBefore;
    }
    if candidate.has_live_student_number {
        return FastTrackDecision::AccountHasStudentNumber;
    }
    if !names_loosely_match(registry_name, candidate) {
        return FastTrackDecision::NameMismatch;
    }
    FastTrackDecision::Link
}

/// Whether the two records plausibly describe the same person: either surname or any one of the
/// registry's given names has to agree, ignoring case and diacritics.
///
/// Loose on purpose. The ordinary case is a registry holding a full official name against an account
/// holding a nickname, and punishing that would cost coverage for no safety. A mismatch is still a
/// fall-through to the emailed link, which resolves the ambiguity by asking a human.
fn names_loosely_match(registry_name: RegistryName<'_>, candidate: &FastTrackCandidate) -> bool {
    let account_first = fold(candidate.first_name.as_deref().unwrap_or_default());
    let account_last = fold(candidate.last_name.as_deref().unwrap_or_default());
    let registry_last = fold(registry_name.last_name.unwrap_or_default());

    if !account_last.is_empty() && account_last == registry_last {
        return true;
    }
    if account_first.is_empty() {
        return false;
    }
    registry_name
        .first_names
        .unwrap_or_default()
        .split_whitespace()
        .any(|given| fold(given) == account_first)
}

/// Casefolds and strips diacritics so `Mäkelä` and `Makela` compare equal.
fn fold(name: &str) -> String {
    name.trim()
        .nfkd()
        .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
        .flat_map(char::to_lowercase)
        .collect()
}

/// The one live account holding `primary_email`, with everything [`decide_fast_track`] needs.
/// `None` when no account holds it, and also when more than one does — the fast track only ever acts
/// on an unambiguous account, and ambiguity falls through to the mailed link like everything else.
///
/// Compares on `lower(email)`, the same normalisation the `users_email` unique index uses, and no
/// other: inventing address equivalences (Gmail dot-stripping, `+tag` folding) inside a security
/// predicate is how one earns a CVE. `sisu_person_id` is only used to tell an earlier automatic link
/// this account already rejected from someone else's.
///
/// Locks the account row for the caller's transaction, so a concurrent profile edit cannot change
/// the address between reading the proof and writing the link that rests on it.
pub async fn find_fast_track_candidate(
    conn: &mut PgConnection,
    primary_email: &str,
    sisu_person_id: &str,
) -> ModelResult<Option<FastTrackCandidate>> {
    let address = primary_email.trim();
    if address.is_empty() {
        return Ok(None);
    }
    let mut candidates = sqlx::query_as!(
        FastTrackCandidate,
        r#"
SELECT ud.user_id,
  ud.email,
  ud.email_verified_at,
  ud.email_verified_method AS "email_verified_method: EmailVerificationMethod",
  ud.first_name,
  ud.last_name,
  EXISTS(
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.user_id = ud.user_id
      AND vsn.deleted_at IS NULL
  ) AS "has_live_student_number!",
  EXISTS(
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.user_id = ud.user_id
      AND vsn.sisu_person_id = $2
      AND vsn.verified_via = 'email_match_fast_track'::student_number_verification_method
      AND vsn.deleted_at IS NOT NULL
  ) AS "unlinked_a_fast_track_link_before!"
FROM user_details ud
  JOIN users u ON u.id = ud.user_id
WHERE LOWER(ud.email) = LOWER($1)
  AND u.deleted_at IS NULL
LIMIT 2 FOR SHARE OF ud
        "#,
        address,
        sisu_person_id,
    )
    .fetch_all(conn)
    .await?;
    Ok((candidates.len() == 1).then(|| candidates.remove(0)))
}

/// One person the fast track is about to link, as the caller read them off the registry's roster.
#[derive(Debug, Clone, PartialEq)]
pub struct FastTrackLink<'a> {
    pub student_number: &'a str,
    pub sisu_person_id: &'a str,
    pub first_names: Option<&'a str>,
    pub last_name: Option<&'a str>,
    pub course_id: Uuid,
}

/// Links `person`'s student number to `candidate`'s account and returns the new link's id.
///
/// Goes through `replace_verified_student_number`, so it also soft-deletes the outstanding mailed
/// tokens for that number — a link already in somebody's inbox must stop working once the number is
/// linked — and recomputes the account's registrations. Caller must have decided
/// [`FastTrackDecision::Link`] first; this function re-checks nothing.
pub async fn link_by_email_match(
    conn: &mut PgConnection,
    person: &FastTrackLink<'_>,
    candidate: &FastTrackCandidate,
) -> ModelResult<Uuid> {
    let (id, _) = replace_verified_student_number(
        conn,
        None,
        &NewVerifiedStudentNumber {
            user_id: candidate.user_id,
            student_number: person.student_number.to_string(),
            sisu_person_id: person.sisu_person_id.to_string(),
            first_names: person.first_names.map(str::to_string),
            last_name: person.last_name.map(str::to_string),
            verified_via: StudentNumberVerificationMethod::EmailMatchFastTrack,
            verified_via_email: Some(candidate.email.clone()),
            verified_via_email_match_field: Some(MATCHED_FIELD_PRIMARY.to_string()),
            // Frozen onto the row: the account's own flag is cleared the first time the student
            // changes their address, and an audit years later still has to answer how old the proof
            // was when the link was made.
            account_email_verified_at: candidate.email_verified_at,
            linked_by_user_id: None,
            link_reason: None,
            verified_from_course_id: Some(person.course_id),
        },
        None,
        CreditRegistrationEventKind::Created,
        "Linked automatically: the study registry holds this account's verified email address.",
    )
    .await?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    const YEAR: i64 = 365;

    fn candidate() -> FastTrackCandidate {
        FastTrackCandidate {
            user_id: Uuid::new_v4(),
            email: "aada.virtanen@helsinki.fi".to_string(),
            email_verified_at: Some(Utc::now() - chrono::Duration::days(30)),
            email_verified_method: Some(EmailVerificationMethod::EmailedCode),
            first_name: Some("Aada".to_string()),
            last_name: Some("Virtanen".to_string()),
            has_live_student_number: false,
            unlinked_a_fast_track_link_before: false,
        }
    }

    fn decide(candidate: Option<&FastTrackCandidate>) -> FastTrackDecision {
        decide_fast_track(
            candidate,
            RegistryName {
                first_names: Some("Aada Maria"),
                last_name: Some("Virtanen"),
            },
            Utc::now(),
            chrono::Duration::days(YEAR),
        )
    }

    #[test]
    fn a_fresh_proof_on_a_matching_name_links() {
        assert_eq!(decide(Some(&candidate())), FastTrackDecision::Link);
    }

    #[test]
    fn an_address_no_account_holds_falls_through() {
        assert_eq!(decide(None), FastTrackDecision::NoAccountMatch);
    }

    /// The address is self-service editable, so equality without a proof is an impersonation
    /// primitive rather than weak evidence.
    #[test]
    fn an_unproven_address_never_links() {
        let unverified = FastTrackCandidate {
            email_verified_at: None,
            email_verified_method: None,
            ..candidate()
        };
        assert_eq!(
            decide(Some(&unverified)),
            FastTrackDecision::UnverifiedAccount
        );
    }

    #[test]
    fn support_asserting_an_address_is_not_a_proof_of_mailbox_control() {
        let asserted = FastTrackCandidate {
            email_verified_method: Some(EmailVerificationMethod::AdminAsserted),
            ..candidate()
        };
        assert_eq!(
            decide(Some(&asserted)),
            FastTrackDecision::UnverifiedAccount
        );
    }

    #[test]
    fn a_proof_older_than_the_window_never_links() {
        let stale = FastTrackCandidate {
            email_verified_at: Some(Utc::now() - chrono::Duration::days(YEAR + 1)),
            ..candidate()
        };
        assert_eq!(decide(Some(&stale)), FastTrackDecision::StaleVerification);
    }

    #[test]
    fn an_account_that_already_holds_a_number_is_left_to_the_mailed_link() {
        let linked = FastTrackCandidate {
            has_live_student_number: true,
            ..candidate()
        };
        assert_eq!(
            decide(Some(&linked)),
            FastTrackDecision::AccountHasStudentNumber
        );
    }

    /// Otherwise the one-click unlink would be undone by the next roster listing.
    #[test]
    fn an_account_that_unlinked_this_person_before_is_not_relinked() {
        let rejected = FastTrackCandidate {
            unlinked_a_fast_track_link_before: true,
            ..candidate()
        };
        assert_eq!(decide(Some(&rejected)), FastTrackDecision::UnlinkedBefore);
    }

    #[test]
    fn a_wholly_different_name_falls_through() {
        let stranger = FastTrackCandidate {
            first_name: Some("Bertta".to_string()),
            last_name: Some("Korhonen".to_string()),
            ..candidate()
        };
        assert_eq!(decide(Some(&stranger)), FastTrackDecision::NameMismatch);
    }

    /// A registry full name against an account nickname is the ordinary case, not a signal.
    #[test]
    fn one_matching_given_name_is_enough() {
        let nickname = FastTrackCandidate {
            first_name: Some("Maria".to_string()),
            last_name: Some("Married-Name".to_string()),
            ..candidate()
        };
        assert_eq!(decide(Some(&nickname)), FastTrackDecision::Link);
    }

    #[test]
    fn diacritics_and_case_do_not_make_two_names_differ() {
        let folded = FastTrackCandidate {
            first_name: Some("aada".to_string()),
            last_name: Some("VIRTÄNEN".to_string()),
            ..candidate()
        };
        assert_eq!(decide(Some(&folded)), FastTrackDecision::Link);
    }
}
