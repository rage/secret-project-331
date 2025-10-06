use core::fmt;
use std::borrow::Cow;
use std::str::FromStr;

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use subtle::ConstantTimeEq;
use zeroize::Zeroize;

use sqlx::encode::IsNull;
use sqlx::postgres::{PgArgumentBuffer, PgHasArrayType, PgTypeInfo, PgValueRef};
use sqlx::{Decode, Encode, Postgres, error::BoxDynError};

// --- Secure Digest (zeroizes on drop) --------------------------------------

#[derive(Clone, Hash, Zeroize, PartialEq, Eq)]
#[zeroize(drop)]
pub struct Digest([u8; 32]);

impl Digest {
    pub const LEN: usize = 32;

    pub const fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn from_slice(slice: &[u8]) -> Result<Self, DigestError> {
        if slice.len() != Self::LEN {
            return Err(DigestError::WrongLength(slice.len()));
        }
        let mut arr = [0u8; Self::LEN];
        arr.copy_from_slice(slice);
        Ok(Self(arr))
    }

    #[inline]
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    #[inline]
    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }

    /// Constant-time equality helper that returns bool.
    pub fn constant_eq(&self, other: &Self) -> bool {
        self.0.ct_eq(&other.0).unwrap_u8() == 1
    }

    pub fn to_hex(&self) -> String {
        const HEX: &[u8; 16] = b"0123456789abcdef";
        let mut out = vec![0u8; 64];
        for (i, b) in self.0.iter().copied().enumerate() {
            out[2 * i] = HEX[(b >> 4) as usize];
            out[2 * i + 1] = HEX[(b & 0x0f) as usize];
        }
        // ASCII-only, safe
        unsafe { String::from_utf8_unchecked(out) }
    }
}

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

impl FromStr for Digest {
    type Err = DigestError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let bytes = hex::decode(s).map_err(DigestError::Hex)?;
        Self::from_slice(&bytes)
    }
}

impl fmt::Debug for Digest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Digest(…redacted…)")
    }
}
impl fmt::Display for Digest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_hex())
    }
}

impl AsRef<[u8]> for Digest {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}
impl From<[u8; 32]> for Digest {
    fn from(v: [u8; 32]) -> Self {
        Self(v)
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
        d.0.to_vec()
    }
}

// --- Serde: compact binary via serde_bytes ---------------------------------

impl Serialize for Digest {
    fn serialize<S: Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_bytes(&self.0)
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
        <&[u8] as Encode<Postgres>>::encode_by_ref(&&self.0[..], buf)
    }
}

impl sqlx::Type<Postgres> for Digest {
    fn type_info() -> PgTypeInfo {
        <Vec<u8> as sqlx::Type<Postgres>>::type_info()
    }
}
impl PgHasArrayType for Digest {
    fn array_type_info() -> PgTypeInfo {
        <Vec<u8> as PgHasArrayType>::array_type_info()
    }
}
