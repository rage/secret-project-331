//! Looking one student number up in the study registry for an admin, without changing anything.

use secrecy::SecretString;

use crate::registry::{PersonLookupAnswer, StudentNumber, StudyRegistry};

/// The Sisu person a student number belongs to.
pub struct ResolvedPerson {
    pub sisu_person_id: SecretString,
    pub first_names: Option<SecretString>,
    pub last_name: Option<SecretString>,
    /// The registry's own per-item code, an identifier rather than prose.
    pub code: String,
}

/// Why [`crate::account_linking::resolve_person`] could not say whether the number exists.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolvePersonError {
    /// The request itself failed: network, auth, or a request-level error from the registry.
    StudyRegistryUnavailable,
    /// The registry answered but its response did not include this item.
    ItemMissingFromResponse,
    /// The registry answered for this item with something other than a person or
    /// `personNotFound`: its own code, an identifier rather than prose.
    UnexpectedAnswer { code: String },
}

/// [`crate::account_linking::resolve_person`] through `registry`.
pub(crate) async fn look_up_person<R: StudyRegistry>(
    registry: &R,
    student_number: &SecretString,
) -> Result<Option<ResolvedPerson>, ResolvePersonError> {
    let answer = registry
        .look_up_person(&StudentNumber::new(student_number.clone()))
        .await
        .map_err(|_| ResolvePersonError::StudyRegistryUnavailable)?;
    match answer {
        PersonLookupAnswer::NotFound => Ok(None),
        PersonLookupAnswer::Found {
            person,
            registry_code,
        } => Ok(Some(ResolvedPerson {
            sisu_person_id: person.person_id,
            first_names: person.first_names,
            last_name: person.last_name,
            code: registry_code,
        })),
        PersonLookupAnswer::Unexpected { registry_code } => {
            Err(ResolvePersonError::UnexpectedAnswer {
                code: registry_code,
            })
        }
        PersonLookupAnswer::Unanswered => Err(ResolvePersonError::ItemMissingFromResponse),
    }
}
