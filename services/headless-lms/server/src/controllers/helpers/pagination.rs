//! A page of rows plus the total count, in the shape every paginated admin/teacher list endpoint
//! returns.

use utoipa::ToSchema;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct Page<T: ToSchema + 'static> {
    pub data: Vec<T>,
    pub total_count: i64,
    pub total_pages: u32,
}

impl<T: ToSchema + 'static> Page<T> {
    /// `total_count` must come from the same query as `data` (e.g. a `COUNT(*) OVER ()` column),
    /// not a separate count query, or a page and its total can disagree under concurrent writes.
    pub fn new(pagination: Pagination, data: Vec<T>, total_count: i64) -> Self {
        Self {
            data,
            total_count,
            total_pages: pagination.total_pages(u32::try_from(total_count).unwrap_or(u32::MAX)),
        }
    }
}

/// Parses the `page`/`limit` query parameters every list endpoint accepts, defaulting `limit` to
/// `default_limit` when absent.
pub fn parse_pagination(
    page: Option<u32>,
    limit: Option<u32>,
    default_limit: u32,
) -> Result<Pagination, ControllerError> {
    Pagination::new(page.unwrap_or(1), limit.unwrap_or(default_limit))
        .map_err(|e| controller_err!(BadRequest, e.to_string()))
}
