use std::{fmt, num::ParseIntError};

use serde::{
    de::{self, MapAccess, Visitor},
    Deserialize, Deserializer,
};
#[cfg(feature = "ts_rs")]
use ts_rs::TS;

/// Represents the URL query parameters `page` and `limit`, used for paginating database queries.
#[derive(Debug, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Pagination {
    // the deserialize implementation contains a default value for page
    #[cfg_attr(feature = "ts_rs", ts(type = "number | undefined"))]
    page: u32,
    // the deserialize implementation contains a default value for limit
    #[cfg_attr(feature = "ts_rs", ts(type = "number | undefined"))]
    limit: u32,
}

impl Pagination {
    /// Panics on non-positive page or limit values.
    pub fn new(page: u32, limit: u32) -> Self {
        if page == 0 {
            panic!("Page must be a positive value.");
        }
        if limit == 0 {
            panic!("Limit must be a positive value.");
        }
        Pagination { page, limit }
    }

    /// Guaranteed to be positive.
    pub fn page(&self) -> i64 {
        self.page.into()
    }

    /// Guaranteed to be positive.
    pub fn limit(&self) -> i64 {
        self.limit.into()
    }

    /// Guaranteed to be nonnegative.
    pub fn offset(&self) -> i64 {
        (self.limit * (self.page - 1)).into()
    }

    /// Guaranteed to be positive.
    pub fn total_pages(&self, total_count: u32) -> u32 {
        let remainder = total_count % self.limit;
        if remainder == 0 {
            total_count / self.limit
        } else {
            total_count / self.limit + 1
        }
    }

    /// Helper to paginate an existing Vec efficiently.
    pub fn paginate<T>(&self, v: &mut Vec<T>) {
        let limit = self.limit as usize;
        let start = limit * (self.page as usize - 1);
        v.truncate(start + limit);
        v.drain(..start);
    }
}

impl Default for Pagination {
    fn default() -> Self {
        Self {
            page: 1,
            limit: 100,
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
                    page: page.unwrap_or(Pagination::default().page),
                    limit: limit.unwrap_or(Pagination::default().limit),
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
    Int(u32),
}

impl StrOrInt<'_> {
    fn into_int(self) -> Result<u32, ParseIntError> {
        match self {
            Self::Str(s) => s.parse(),
            Self::Int(i) => Ok(i),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn paginates() {
        let mut v = vec![1, 2, 3, 4, 5, 6, 7, 8];
        let pagination = Pagination::new(2, 3);
        pagination.paginate(&mut v);
        assert_eq!(v, &[4, 5, 6]);
    }

    #[test]
    fn paginates_non_existent_page() {
        let mut v = vec![1, 2, 3, 4, 5, 6, 7, 8];
        let pagination = Pagination::new(3, 4);
        pagination.paginate(&mut v);
        assert_eq!(v, &[] as &[i32]);
    }

    #[test]
    fn paginates_incomplete_page() {
        let mut v = vec![1, 2, 3, 4, 5, 6, 7, 8];
        let pagination = Pagination::new(2, 5);
        pagination.paginate(&mut v);
        assert_eq!(v, &[6, 7, 8]);
    }
}
