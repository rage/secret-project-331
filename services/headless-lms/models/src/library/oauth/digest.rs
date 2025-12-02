use core::fmt;
use std::borrow::Cow;
use std::str::FromStr;

use secrecy::{ExposeSecret, SecretBox};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use subtle::ConstantTimeEq;

use sqlx::encode::IsNull;
use sqlx::postgres::{PgArgumentBuffer, PgHasArrayType, PgTypeInfo, PgValueRef};
use sqlx::{Decode, Encode, Postgres, Type, error::BoxDynError};

#[derive(Debug)]
pub enum DigestError {
    WrongLength(usize),
    Hex(hex::FromHexError),
    Base64(base64::DecodeError),
}

impl fmt::Display for DigestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::WrongLength(n) => write!(f, "expected 32 bytes, got {}", n),
            Self::Hex(e) => write!(f, "hex decode error: {e}"),
            Self::Base64(e) => write!(f, "base64 decode error: {e}"),
        }
    }
}
impl std::error::Error for DigestError {}

/// Secure Digest (zeroizes on drop via `secrecy::SecretBox`)
pub struct Digest(SecretBox<[u8; Self::LEN]>);

impl Digest {
    pub const LEN: usize = 32;

    pub fn new(bytes: [u8; Self::LEN]) -> Self {
        Self(SecretBox::new(Box::new(bytes)))
    }

    pub fn from_slice(slice: &[u8]) -> Result<Self, DigestError> {
        if slice.len() != Self::LEN {
            return Err(DigestError::WrongLength(slice.len()));
        }
        let mut arr = [0u8; Self::LEN];
        arr.copy_from_slice(slice);
        Ok(Self::new(arr))
    }

    pub fn as_bytes(&self) -> &[u8; Self::LEN] {
        self.0.expose_secret()
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.0.expose_secret()[..]
    }

    /// Constant-time equality helper that returns bool.
    pub fn constant_eq(&self, other: &Self) -> bool {
        self.as_slice().ct_eq(other.as_slice()).unwrap_u8() == 1
    }
}

impl FromStr for Digest {
    type Err = DigestError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let bytes = hex::decode(s).map_err(DigestError::Hex)?;
        Self::from_slice(&bytes)
    }
}

impl fmt::Debug for Digest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Never expose contents
        write!(f, "Digest(…redacted…)")
    }
}

// Intentionally no Clone, no AsRef, no Display.

impl From<[u8; Digest::LEN]> for Digest {
    fn from(v: [u8; Digest::LEN]) -> Self {
        Self::new(v)
    }
}

impl core::convert::TryFrom<Vec<u8>> for Digest {
    type Error = DigestError;
    fn try_from(v: Vec<u8>) -> Result<Self, Self::Error> {
        Self::from_slice(&v)
    }
}

impl From<Digest> for Vec<u8> {
    fn from(d: Digest) -> Self {
        d.as_slice().to_vec()
    }
}

impl Serialize for Digest {
    fn serialize<S: Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_bytes(self.as_slice())
    }
}
impl<'de> Deserialize<'de> for Digest {
    fn deserialize<D: Deserializer<'de>>(de: D) -> Result<Self, D::Error> {
        let bytes: Cow<'de, [u8]> = serde_bytes::deserialize(de)?;
        Digest::from_slice(&bytes).map_err(serde::de::Error::custom)
    }
}

impl<'r> Decode<'r, Postgres> for Digest {
    fn decode(value: PgValueRef<'r>) -> Result<Self, BoxDynError> {
        let bytes: Vec<u8> = <Vec<u8> as Decode<Postgres>>::decode(value)?;
        Ok(Digest::from_slice(&bytes)?)
    }
}

impl<'q> Encode<'q, Postgres> for Digest {
    fn encode_by_ref(&self, buf: &mut PgArgumentBuffer) -> Result<IsNull, BoxDynError> {
        <&[u8] as Encode<Postgres>>::encode_by_ref(&self.as_slice(), buf)
    }
}

impl Type<Postgres> for Digest {
    fn type_info() -> PgTypeInfo {
        <Vec<u8> as Type<Postgres>>::type_info()
    }
}
impl PgHasArrayType for Digest {
    fn array_type_info() -> PgTypeInfo {
        <Vec<u8> as PgHasArrayType>::array_type_info()
    }
}
