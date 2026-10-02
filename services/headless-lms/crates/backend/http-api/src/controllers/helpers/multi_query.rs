//! Query-string extraction for endpoints whose filters accept several values.

use std::borrow::Cow;
use std::collections::BTreeMap;
use std::future::{Ready, ready};
use std::ops::Deref;

use actix_web::{FromRequest, HttpRequest, dev::Payload};
use serde::de::value::{CowStrDeserializer, Error as ValueError, MapDeserializer, SeqDeserializer};
use serde::de::{self, DeserializeOwned, Deserializer, IntoDeserializer, Visitor};
use serde::forward_to_deserialize_any;
use url::form_urlencoded;

use headless_lms_base::prelude_base_and_re_exports::BackendError;

use crate::domain::error::{ControllerError, ControllerErrorType, controller_err};

/// A handler's query parameters, where a parameter given more than once reads as a list.
///
/// Use this in place of [`actix_web::web::Query`] whenever the query struct has a `Vec` field.
/// `web::Query` deserializes with `serde_urlencoded`, which rejects a repeated key
/// (`?state=a&state=b`) as a duplicate map entry before any field deserializer runs, so a `Vec`
/// field can never be filled over that transport.
///
/// A `Vec` field accepts `?state=a&state=b` and `?state=a,b` alike. A scalar field is never split
/// on commas, so a free-text parameter may contain them; given twice, it takes the last value. A
/// parameter present with an empty value reads as absent.
///
/// Answers 400 when the query string does not fit `T`.
#[derive(Debug)]
pub struct MultiQuery<T>(T);

impl<T> MultiQuery<T> {
    pub fn into_inner(self) -> T {
        self.0
    }
}

impl<T> Deref for MultiQuery<T> {
    type Target = T;

    fn deref(&self) -> &T {
        &self.0
    }
}

impl<T: DeserializeOwned> FromRequest for MultiQuery<T> {
    type Error = ControllerError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        ready(
            from_query_string(req.query_string())
                .map(MultiQuery)
                .map_err(|err| controller_err!(BadRequest, format!("Query parse error: {err}"))),
        )
    }
}

/// Deserializes `T` from a raw query string under [`MultiQuery`]'s rules.
pub fn from_query_string<T: DeserializeOwned>(query: &str) -> Result<T, ValueError> {
    let mut fields: BTreeMap<Cow<'_, str>, Vec<Cow<'_, str>>> = BTreeMap::new();
    for (key, value) in form_urlencoded::parse(query.as_bytes()) {
        if value.is_empty() {
            continue;
        }
        fields.entry(key).or_default().push(value);
    }
    T::deserialize(QueryDeserializer { fields })
}

/// Every parameter of one query string, keyed by name, in the order the values were given.
struct QueryDeserializer<'q> {
    fields: BTreeMap<Cow<'q, str>, Vec<Cow<'q, str>>>,
}

impl<'de> Deserializer<'de> for QueryDeserializer<'de> {
    type Error = ValueError;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        MapDeserializer::new(
            self.fields
                .into_iter()
                .map(|(key, values)| (key, Values(values))),
        )
        .deserialize_map(visitor)
    }

    forward_to_deserialize_any! {
        bool i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 f32 f64 char str string
        bytes byte_buf option unit unit_struct newtype_struct seq tuple
        tuple_struct map struct enum identifier ignored_any
    }
}

/// The values one parameter was given, never empty.
struct Values<'q>(Vec<Cow<'q, str>>);

impl<'de> IntoDeserializer<'de, ValueError> for Values<'de> {
    type Deserializer = Self;

    fn into_deserializer(self) -> Self {
        self
    }
}

impl<'de> Values<'de> {
    /// The last value given, as the deserializer a scalar field reads.
    fn scalar(self) -> CowStrDeserializer<'de, ValueError> {
        let mut values = self.0;
        values
            .pop()
            .unwrap_or(Cow::Borrowed(""))
            .into_deserializer()
    }
}

/// Parses a scalar field's value out of its string, the way `serde_urlencoded` does: a query string
/// carries no types, so `limit=50` has to reach a `u32` field as a number.
macro_rules! deserialize_parsed {
    ($($method:ident => $visit:ident => $target:ty,)*) => {
        $(
            fn $method<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
                let value = self.scalar_value();
                match value.parse::<$target>() {
                    Ok(parsed) => visitor.$visit(parsed),
                    Err(_) => Err(de::Error::invalid_value(
                        de::Unexpected::Str(&value),
                        &visitor,
                    )),
                }
            }
        )*
    };
}

impl<'de> Values<'de> {
    fn scalar_value(&self) -> Cow<'de, str> {
        self.0.last().cloned().unwrap_or(Cow::Borrowed(""))
    }
}

impl<'de> Deserializer<'de> for Values<'de> {
    type Error = ValueError;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        if self.0.len() > 1 {
            self.deserialize_seq(visitor)
        } else {
            self.scalar().deserialize_any(visitor)
        }
    }

    /// A key only reaches here when it was given, so it is always `Some`.
    fn deserialize_option<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        visitor.visit_some(self)
    }

    fn deserialize_seq<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        SeqDeserializer::new(self.0.into_iter().flat_map(comma_separated)).deserialize_seq(visitor)
    }

    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, ValueError> {
        self.scalar().deserialize_enum(name, variants, visitor)
    }

    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        _name: &'static str,
        visitor: V,
    ) -> Result<V::Value, ValueError> {
        visitor.visit_newtype_struct(self)
    }

    fn deserialize_str<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        self.scalar().deserialize_str(visitor)
    }

    fn deserialize_string<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        self.scalar().deserialize_string(visitor)
    }

    fn deserialize_char<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        self.scalar().deserialize_char(visitor)
    }

    fn deserialize_identifier<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, ValueError> {
        self.scalar().deserialize_identifier(visitor)
    }

    deserialize_parsed! {
        deserialize_bool => visit_bool => bool,
        deserialize_i8 => visit_i8 => i8,
        deserialize_i16 => visit_i16 => i16,
        deserialize_i32 => visit_i32 => i32,
        deserialize_i64 => visit_i64 => i64,
        deserialize_u8 => visit_u8 => u8,
        deserialize_u16 => visit_u16 => u16,
        deserialize_u32 => visit_u32 => u32,
        deserialize_u64 => visit_u64 => u64,
        deserialize_f32 => visit_f32 => f32,
        deserialize_f64 => visit_f64 => f64,
    }

    forward_to_deserialize_any! {
        i128 u128 bytes byte_buf unit unit_struct tuple tuple_struct map struct ignored_any
    }
}

/// Splits one raw value on commas, dropping empty parts, so `?state=a,b` and `?state=a&state=b`
/// mean the same thing.
fn comma_separated(value: Cow<'_, str>) -> Vec<Cow<'_, str>> {
    match value {
        Cow::Borrowed(value) => value
            .split(',')
            .filter(|part| !part.is_empty())
            .map(Cow::Borrowed)
            .collect(),
        Cow::Owned(value) => value
            .split(',')
            .filter(|part| !part.is_empty())
            .map(|part| Cow::Owned(part.to_owned()))
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Utc};
    use serde::Deserialize;
    use uuid::Uuid;

    #[derive(Debug, Deserialize, PartialEq)]
    #[serde(rename_all = "snake_case")]
    enum State {
        Registered,
        Blocked,
    }

    #[derive(Debug, Deserialize, PartialEq)]
    struct Query {
        page: Option<u32>,
        state: Option<Vec<State>>,
        course_id: Option<Uuid>,
        submitted_after: Option<DateTime<Utc>>,
        search: Option<String>,
        include_superseded: Option<bool>,
    }

    fn parse(query: &str) -> Query {
        from_query_string(query).expect("the query string should fit Query")
    }

    #[test]
    fn reads_a_repeated_parameter_as_a_list() {
        assert_eq!(
            parse("state=registered&state=blocked").state,
            Some(vec![State::Registered, State::Blocked])
        );
        assert_eq!(
            parse("state=registered,blocked").state,
            Some(vec![State::Registered, State::Blocked])
        );
        assert_eq!(
            parse("state=registered").state,
            Some(vec![State::Registered])
        );
        assert_eq!(parse("page=2").state, None);
    }

    #[test]
    fn reads_the_scalar_parameters_beside_it() {
        let query = parse(
            "state=blocked&page=3&course_id=8e4aeba5-1958-49bc-9b40-3c76bb0d3ad4\
             &submitted_after=2026-09-06T09:51:00Z&include_superseded=true&search=a,b",
        );
        assert_eq!(
            query,
            Query {
                page: Some(3),
                state: Some(vec![State::Blocked]),
                course_id: Some(
                    Uuid::parse_str("8e4aeba5-1958-49bc-9b40-3c76bb0d3ad4").expect("a valid uuid")
                ),
                submitted_after: Some(
                    "2026-09-06T09:51:00Z"
                        .parse::<DateTime<Utc>>()
                        .expect("a valid timestamp")
                ),
                // Never comma-split: a search term may contain one.
                search: Some("a,b".to_string()),
                include_superseded: Some(true),
            }
        );
    }

    #[test]
    fn reads_an_empty_value_as_absent() {
        assert_eq!(parse("page=&state=&search="), parse(""));
    }

    #[test]
    fn refuses_a_value_that_does_not_fit_the_field() {
        assert!(from_query_string::<Query>("page=soon").is_err());
        assert!(from_query_string::<Query>("state=elsewhere").is_err());
    }
}
