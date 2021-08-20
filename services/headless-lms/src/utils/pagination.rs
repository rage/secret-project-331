use serde::{
    de::{self, MapAccess, Visitor},
    Deserialize, Deserializer,
};
use std::{fmt, num::ParseIntError};
use ts_rs::TS;

/// Represents the URL query parameters `page` and `limit`, used for paginating database queries.
#[derive(Debug, TS)]
pub struct Pagination {
    // the deserialize implementation contains a default value for page
    #[ts(rename = "page?")]
    page: i64,
    // the deserialize implementation contains a default value for limit
    #[ts(rename = "limit?")]
    limit: i64,
}

impl Pagination {
    /// Guaranteed to be positive.
    pub fn page(&self) -> i64 {
        self.page
    }

    /// Guaranteed to be positive.
    pub fn limit(&self) -> i64 {
        self.limit
    }

    /// Guaranteed to be nonnegative.
    pub fn offset(&self) -> i64 {
        self.limit * (self.page - 1)
    }

    /// Guaranteed to be positive.
    pub fn total_pages(&self, total_count: i64) -> i64 {
        let remainder = total_count % self.limit;
        if remainder == 0 {
            total_count / self.limit
        } else {
            total_count / self.limit + 1
        }
    }
}

impl<'de> Deserialize<'de> for Pagination {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct PaginationVisitor;

        impl<'de> Visitor<'de> for PaginationVisitor {
            type Value = Pagination;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("query parameters `page` and `limit`")
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let mut page = None;
                let mut limit = None;
                while let Some(key) = map.next_key().map_err(|e| {
                    de::Error::custom(format!("Failed to deserialize map key: {}", e))
                })? {
                    match key {
                        "page" => {
                            if page.is_some() {
                                return Err(de::Error::duplicate_field("page"));
                            }
                            let value: StrOrInt = map.next_value().map_err(|e| {
                                de::Error::custom(format!(
                                    "Failed to deserialize page value: {}",
                                    e
                                ))
                            })?;
                            let value = value.into_int().map_err(|e| {
                                de::Error::custom(format!(
                                    "Failed to deserialize page value: {}",
                                    e
                                ))
                            })?;
                            if value < 1 {
                                return Err(de::Error::custom(
                                    "query parameter `page` must be a positive integer",
                                ));
                            }
                            page = Some(value);
                        }
                        "limit" => {
                            if limit.is_some() {
                                return Err(de::Error::duplicate_field("limit"));
                            }
                            let value: StrOrInt = map.next_value().map_err(|e| {
                                de::Error::custom(format!(
                                    "Failed to deserialize limit value: {}",
                                    e
                                ))
                            })?;
                            let value = value.into_int().map_err(|e| {
                                de::Error::custom(format!(
                                    "Failed to deserialize limit value: {}",
                                    e
                                ))
                            })?;
                            if !(1..=1000).contains(&value) {
                                return Err(de::Error::custom(
                                    "query parameter `limit` must be an integer between 1 and 1000",
                                ));
                            }
                            limit = Some(value);
                        }
                        field => {
                            return Err(de::Error::custom(&format!(
                                "unexpected parameter `{}`",
                                field
                            )))
                        }
                    }
                }
                Ok(Pagination {
                    page: page.unwrap_or(1),
                    limit: limit.unwrap_or(100),
                })
            }
        }

        deserializer.deserialize_struct("Pagination", &["page", "limit"], PaginationVisitor)
    }
}

// for some reason, it seems like when there are only numeric query parameters, actix gives them to serde as numbers,
// but if there's a string mixed in, they are all given as strings. this helper is used to handle both cases
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum StrOrInt<'a> {
    Str(&'a str),
    Int(i64),
}

impl StrOrInt<'_> {
    fn into_int(self) -> Result<i64, ParseIntError> {
        match self {
            Self::Str(s) => s.parse(),
            Self::Int(i) => Ok(i),
        }
    }
}
