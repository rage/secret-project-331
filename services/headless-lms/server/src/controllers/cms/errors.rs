use models::errors::{self, ErrorGroup};
use utoipa::OpenApi;

use crate::{
    domain::authorization::{Action, Resource, authorize},
    prelude::*,
};

#[derive(OpenApi)]
#[openapi(paths(get_error_groups))]
pub(crate) struct CmsErrorsApiDoc;

#[derive(Debug, Deserialize)]
pub struct GetErrorGroupsQuery {
    #[serde(flatten)]
    pagination: Pagination,
}

/**
GET `/api/v0/cms/errors` - Returns all error groups ordered by most recently seen.
*/
#[utoipa::path(
    get,
    path = "",
    operation_id = "getErrorGroups",
    tag = "errors",
    params(
        ("page" = Option<i64>, Query, description = "Page number"),
        ("limit" = Option<i64>, Query, description = "Page size")
    ),
    responses(
        (status = 200, description = "Error groups", body = Vec<ErrorGroup>)
    )
)]
#[instrument(skip(pool))]
pub async fn get_error_groups(
    pool: web::Data<PgPool>,
    user: AuthUser,
    query: web::Query<GetErrorGroupsQuery>,
) -> ControllerResult<web::Json<Vec<ErrorGroup>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;
    let groups = errors::get_all_groups(&mut conn, query.pagination).await?;
    token.authorized_ok(web::Json(groups))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_error_groups));
}
