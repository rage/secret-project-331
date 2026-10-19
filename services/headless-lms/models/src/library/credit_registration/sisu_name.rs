//! What linking a student number does to the account's name: the name follows Sisu, which verifies
//! identity strongly, while the account's own name is whatever the student once typed.

use unicode_normalization::UnicodeNormalization;
use unicode_normalization::char::is_combining_mark;
use utoipa::ToSchema;

use crate::prelude::*;

/// What linking must do to the account's name. See [`align`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NameAlignment {
    /// The account already uses Sisu's name, or Sisu holds no name to align to.
    Keep,
    Replace(NameReplacement),
}

/// The names the account may take on linking; the student picks the first name.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct NameReplacement {
    /// Each a Sisu first name, or the several the account already uses, corrected to Sisu's spelling.
    pub first_name_options: Vec<String>,
    /// One of `first_name_options`: what the account already uses, else Sisu's first first name.
    pub suggested_first_name: String,
    pub last_name: String,
    /// Neither the account's first name nor its last name resembles Sisu's, so the account may belong
    /// to someone other than the person Sisu names.
    pub resembles_nothing: bool,
}

impl NameReplacement {
    /// Whether `first_name` is one the student may pick.
    pub fn allows(&self, first_name: &str) -> bool {
        self.first_name_options
            .iter()
            .any(|option| option == first_name)
    }
}

/// Compares the account's name with Sisu's.
///
/// The name is kept when every name in the account's first name is one of Sisu's first names and the
/// last names are the same, ignoring case. Otherwise it is replaced, with any first names that are
/// only misspelt (case, diacritics, a typo or two) offered back in Sisu's spelling.
pub fn align(
    sisu_first_names: Option<&str>,
    sisu_last_name: Option<&str>,
    account_first_name: Option<&str>,
    account_last_name: Option<&str>,
) -> NameAlignment {
    let sisu_given = words(sisu_first_names.unwrap_or_default());
    let sisu_last = normalized(sisu_last_name.unwrap_or_default());
    if sisu_given.is_empty() || sisu_last.is_empty() {
        return NameAlignment::Keep;
    }
    let account_given = words(account_first_name.unwrap_or_default());
    let account_last = normalized(account_last_name.unwrap_or_default());

    let mut used = vec![false; sisu_given.len()];
    let mut matches = Vec::new();
    for word in &account_given {
        let Some(found) = best_match(word, &sisu_given, &used) else {
            break;
        };
        used[found.index] = true;
        matches.push(found);
    }
    let first_names_match = !account_given.is_empty() && matches.len() == account_given.len();
    let last_name_resemblance = resemblance(&account_last, &sisu_last);

    if first_names_match
        && matches
            .iter()
            .all(|found| found.resemblance == Resemblance::Same)
        && last_name_resemblance == Some(Resemblance::Same)
    {
        return NameAlignment::Keep;
    }

    let mut first_name_options = Vec::new();
    let mut suggested_first_name = sisu_given[0].clone();
    if first_names_match {
        let corrected = matches
            .iter()
            .map(|found| sisu_given[found.index].as_str())
            .collect::<Vec<_>>()
            .join(" ");
        if matches.len() > 1 {
            first_name_options.push(corrected.clone());
        }
        suggested_first_name = corrected;
    }
    for name in &sisu_given {
        if !first_name_options.contains(name) {
            first_name_options.push(name.clone());
        }
    }

    let any_first_name_resembles = account_given.iter().any(|word| {
        sisu_given
            .iter()
            .any(|name| resemblance(word, name).is_some())
    });
    let is_account_name_empty = account_given.is_empty() && account_last.is_empty();
    NameAlignment::Replace(NameReplacement {
        first_name_options,
        suggested_first_name,
        last_name: sisu_last,
        resembles_nothing: !is_account_name_empty
            && !any_first_name_resembles
            && last_name_resemblance.is_none(),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Resemblance {
    Same,
    /// Differs only in diacritics or by a typo or two.
    Close,
}

struct Match {
    index: usize,
    resemblance: Resemblance,
    distance: usize,
}

/// The closest of `names` not yet `used` that `word` resembles.
fn best_match(word: &str, names: &[String], used: &[bool]) -> Option<Match> {
    names
        .iter()
        .enumerate()
        .filter(|(index, _)| !used[*index])
        .filter_map(|(index, name)| {
            resemblance(word, name).map(|resemblance| Match {
                index,
                resemblance,
                distance: levenshtein(&folded(word), &folded(name)),
            })
        })
        .min_by_key(|found| (found.resemblance, found.distance, found.index))
}

fn resemblance(a: &str, b: &str) -> Option<Resemblance> {
    if a.is_empty() || b.is_empty() {
        return None;
    }
    if a.to_lowercase() == b.to_lowercase() {
        return Some(Resemblance::Same);
    }
    let (a, b) = (folded(a), folded(b));
    // A single typo already turns most short names into another real name.
    let allowed_typos = if b.chars().count() < 5 { 1 } else { 2 };
    (levenshtein(&a, &b) <= allowed_typos).then_some(Resemblance::Close)
}

/// NFC, trimmed, with runs of whitespace collapsed to one space.
fn normalized(name: &str) -> String {
    words(name).join(" ")
}

fn words(name: &str) -> Vec<String> {
    name.nfc()
        .collect::<String>()
        .split_whitespace()
        .map(str::to_owned)
        .collect()
}

/// Lowercased with diacritics removed, so "Mäkinen" and "makinen" compare equal.
fn folded(name: &str) -> String {
    name.nfd()
        .filter(|c| !is_combining_mark(*c))
        .collect::<String>()
        .to_lowercase()
}

fn levenshtein(a: &str, b: &str) -> usize {
    let b: Vec<char> = b.chars().collect();
    let mut previous: Vec<usize> = (0..=b.len()).collect();
    for (i, ca) in a.chars().enumerate() {
        let mut current = vec![i + 1; b.len() + 1];
        for (j, cb) in b.iter().enumerate() {
            let substitution = previous[j] + usize::from(ca != *cb);
            current[j + 1] = substitution.min(previous[j + 1] + 1).min(current[j] + 1);
        }
        previous = current;
    }
    previous[b.len()]
}
