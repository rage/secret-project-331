//! How much a person on a course's enrolment list resembles a student's account: the order an admin
//! sees the people a student waiting for a student number may be. A hint for a guess, never a match.

use headless_lms_models::library::credit_registration::study_registry::RosterPerson;
use secrecy::ExposeSecret;
use utoipa::ToSchema;

use crate::prelude::*;

/// Something a listed person shares with the student's account, strongest first.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum LinkingCandidateSimilarity {
    /// The account's address is one the study registry holds for them.
    Email,
    /// Only the part before the `@` is the same.
    EmailUsername,
    LastName,
    /// One of their first names.
    FirstName,
}

impl LinkingCandidateSimilarity {
    fn weight(self) -> u32 {
        match self {
            Self::Email => 8,
            Self::EmailUsername => 4,
            Self::LastName => 2,
            Self::FirstName => 1,
        }
    }
}

/// The student's account as the similarities compare it.
pub struct AccountIdentity<'a> {
    pub first_name: Option<&'a str>,
    pub last_name: Option<&'a str>,
    pub email: Option<&'a str>,
}

/// What `person` shares with `account`, strongest first.
pub fn similarities(
    account: &AccountIdentity<'_>,
    person: &RosterPerson,
) -> Vec<LinkingCandidateSimilarity> {
    let mut found = Vec::new();
    let addresses: Vec<String> = [&person.primary_email, &person.secondary_email]
        .into_iter()
        .flatten()
        .map(|address| normalized(address.expose_secret()))
        .filter(|address| !address.is_empty())
        .collect();
    if let Some(email) = account.email.map(normalized) {
        if addresses.contains(&email) {
            found.push(LinkingCandidateSimilarity::Email);
        } else if let Some((username, _)) = email.split_once('@')
            && addresses
                .iter()
                .any(|address| address.split_once('@').map(|(name, _)| name) == Some(username))
        {
            found.push(LinkingCandidateSimilarity::EmailUsername);
        }
    }
    let last_name = person
        .last_name
        .as_ref()
        .map(|name| normalized(name.expose_secret()));
    if account
        .last_name
        .map(normalized)
        .is_some_and(|name| !name.is_empty() && Some(&name) == last_name.as_ref())
    {
        found.push(LinkingCandidateSimilarity::LastName);
    }
    let first_names = person
        .first_names
        .as_ref()
        .map(|names| normalized(names.expose_secret()))
        .unwrap_or_default();
    if account
        .first_name
        .map(normalized)
        .is_some_and(|account_names| {
            account_names
                .split_whitespace()
                .any(|name| first_names.split_whitespace().any(|listed| listed == name))
        })
    {
        found.push(LinkingCandidateSimilarity::FirstName);
    }
    found
}

/// How strongly `found` suggests the same person; only for ordering.
pub fn similarity_score(found: &[LinkingCandidateSimilarity]) -> u32 {
    found.iter().map(|similarity| similarity.weight()).sum()
}

fn normalized(value: &str) -> String {
    value.trim().to_lowercase()
}
