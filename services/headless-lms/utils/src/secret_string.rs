//! Helpers for personal data and credentials held as [`SecretString`] (or a wrapper of one), at the
//! few places the real value must come out: a wire body, a SQL bind.
//!
//! [`SecretString`]: secrecy::SecretString

use secrecy::ExposeSecret;
use serde::Serializer;

/// For `#[serde(serialize_with)]` on a field whose real value must be sent.
pub fn serialize_exposed<T, S>(value: &T, serializer: S) -> Result<S::Ok, S::Error>
where
    T: ExposeSecret<str>,
    S: Serializer,
{
    serializer.serialize_str(value.expose_secret())
}

/// [`serialize_exposed`] for an optional field.
pub fn serialize_exposed_option<T, S>(value: &Option<T>, serializer: S) -> Result<S::Ok, S::Error>
where
    T: ExposeSecret<str>,
    S: Serializer,
{
    match value {
        Some(value) => serializer.serialize_some(value.expose_secret()),
        None => serializer.serialize_none(),
    }
}

/// The real value of an optional secret, for binding into SQL.
pub fn expose_option<T: ExposeSecret<str>>(value: &Option<T>) -> Option<&str> {
    value.as_ref().map(ExposeSecret::expose_secret)
}
