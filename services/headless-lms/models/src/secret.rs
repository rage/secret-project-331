//! Wrapper types for sensitive values backed by the `secrecy` crate.
//!
//! The whole point of these wrappers is auditability: the only way to read the
//! plaintext is `expose_secret()`, so `grep expose_secret` enumerates every site
//! where a secret could leak. To keep that guarantee, these types intentionally do
//! **not** implement `Deref`, `Display`, `AsRef<str>`, `Into<String>`, or any plain
//! getter. Do not add them.
//!
//! - [`DbSecret`] — a secret string that flows through the `sqlx` `query!`/`query_as!`
//!   macros. Map columns to it via `sqlx.toml` `table-overrides`. Backed by
//!   `SecretString` (zeroized on drop, redacted from `Debug`). The only plaintext-read
//!   points are its `Encode` impl (writing to the DB) and explicit `expose_secret()` calls.
//! - [`OutboundSecret`] — a secret string that is *intended* to be serialized onto the
//!   wire exactly once (e.g. an OAuth/verification token returned to the caller). It
//!   redacts in `Debug` (so it never leaks into logs) but its `Serialize` impl emits the
//!   raw value. That single `Serialize` impl is the one audited exposure point.

use core::fmt;

use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use sqlx::encode::IsNull;
use sqlx::postgres::{PgArgumentBuffer, PgHasArrayType, PgTypeInfo, PgValueRef};
use sqlx::{Decode, Encode, Postgres, Type, error::BoxDynError};

/// A secret string stored in / read from the database.
///
/// Backed by [`secrecy::SecretString`]: zeroized on drop and redacted from `Debug`.
/// Use it for DB columns holding tokens, codes, keys, etc., wiring the column to this
/// type through `sqlx.toml` `table-overrides`.
#[derive(Clone)]
pub struct DbSecret(SecretString);

impl DbSecret {
    pub fn new(value: impl Into<String>) -> Self {
        Self(SecretString::new(value.into().into()))
    }
}

impl From<String> for DbSecret {
    fn from(value: String) -> Self {
        Self::new(value)
    }
}

// Deserialize is provided (it only *wraps* an incoming value, never exposes one) so that
// `DbSecret` can be used directly for inbound request fields that feed DB queries, avoiding
// a lossy `SecretString` <-> `DbSecret` round-trip. There is deliberately no `Serialize`
// impl: use `OutboundSecret` when a secret must be sent on the wire.
impl<'de> Deserialize<'de> for DbSecret {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(DbSecret::new(s))
    }
}

impl ExposeSecret<str> for DbSecret {
    fn expose_secret(&self) -> &str {
        self.0.expose_secret()
    }
}

impl fmt::Debug for DbSecret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("DbSecret(…redacted…)")
    }
}

// Intentionally no Deref / Display / AsRef<str> / Into<String> / getter.

impl Type<Postgres> for DbSecret {
    fn type_info() -> PgTypeInfo {
        <String as Type<Postgres>>::type_info()
    }
    fn compatible(ty: &PgTypeInfo) -> bool {
        <String as Type<Postgres>>::compatible(ty)
    }
}

impl PgHasArrayType for DbSecret {
    fn array_type_info() -> PgTypeInfo {
        <String as PgHasArrayType>::array_type_info()
    }
}

impl<'r> Decode<'r, Postgres> for DbSecret {
    fn decode(value: PgValueRef<'r>) -> Result<Self, BoxDynError> {
        let s = <String as Decode<Postgres>>::decode(value)?;
        Ok(DbSecret::new(s))
    }
}

impl<'q> Encode<'q, Postgres> for DbSecret {
    fn encode_by_ref(&self, buf: &mut PgArgumentBuffer) -> Result<IsNull, BoxDynError> {
        // The only place the plaintext is read for DB I/O.
        <&str as Encode<Postgres>>::encode_by_ref(&self.0.expose_secret(), buf)
    }
}

/// A secret string that is deliberately serialized onto the wire once (e.g. a token
/// returned to the caller from an auth endpoint).
///
/// Redacts in `Debug` so it never leaks into logs; its `Serialize` impl emits the raw
/// value — that impl is the single intended exposure point. At a struct field, annotate
/// with `#[schema(value_type = String)]` so the OpenAPI schema still reports `string`.
#[derive(Clone)]
pub struct OutboundSecret(SecretString);

impl OutboundSecret {
    pub fn new(value: impl Into<String>) -> Self {
        Self(SecretString::new(value.into().into()))
    }
}

impl From<String> for OutboundSecret {
    fn from(value: String) -> Self {
        Self::new(value)
    }
}

impl ExposeSecret<str> for OutboundSecret {
    fn expose_secret(&self) -> &str {
        self.0.expose_secret()
    }
}

impl fmt::Debug for OutboundSecret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("OutboundSecret(…redacted…)")
    }
}

impl Serialize for OutboundSecret {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // Intended exposure: this value is being sent to the caller.
        serializer.serialize_str(self.0.expose_secret())
    }
}

impl<'de> Deserialize<'de> for OutboundSecret {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(OutboundSecret::new(s))
    }
}

// sqlx integration so `OutboundSecret` can back a DB column that is also returned on the wire
// (e.g. a giveaway code shown to the recipient). Same shape as `DbSecret`'s impls.
impl Type<Postgres> for OutboundSecret {
    fn type_info() -> PgTypeInfo {
        <String as Type<Postgres>>::type_info()
    }
    fn compatible(ty: &PgTypeInfo) -> bool {
        <String as Type<Postgres>>::compatible(ty)
    }
}

impl PgHasArrayType for OutboundSecret {
    fn array_type_info() -> PgTypeInfo {
        <String as PgHasArrayType>::array_type_info()
    }
}

impl<'r> Decode<'r, Postgres> for OutboundSecret {
    fn decode(value: PgValueRef<'r>) -> Result<Self, BoxDynError> {
        let s = <String as Decode<Postgres>>::decode(value)?;
        Ok(OutboundSecret::new(s))
    }
}

impl<'q> Encode<'q, Postgres> for OutboundSecret {
    fn encode_by_ref(&self, buf: &mut PgArgumentBuffer) -> Result<IsNull, BoxDynError> {
        <&str as Encode<Postgres>>::encode_by_ref(&self.0.expose_secret(), buf)
    }
}
