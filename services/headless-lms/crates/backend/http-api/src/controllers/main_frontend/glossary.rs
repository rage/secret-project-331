use models::glossary::{self, TermUpdate};
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(update, delete))]
pub(crate) struct MainFrontendGlossaryApiDoc;

#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{term_id}",
    operation_id = "updateGlossaryTerm",
    tag = "glossary",
    params(
        ("term_id" = Uuid, Path, description = "Glossary term id")
    ),
    request_body = TermUpdate,
    responses(
        (status = 200, description = "Glossary term updated"),
        (status = 401, description = "Authentication required"),
        (status = 403, description = "User is not allowed to manage glossary terms")
    )
)]
pub(crate) async fn update(
    id: web::Path<Uuid>,
    update: web::Json<TermUpdate>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let term = glossary::get_term_by_id(&mut conn, *id).await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(term.course_id),
    )
    .await?;
    glossary::update_term_by_id_and_course_id(
        &mut conn,
        *id,
        term.course_id,
        &update.term,
        &update.definition,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/{term_id}",
    operation_id = "deleteGlossaryTerm",
    tag = "glossary",
    params(
        ("term_id" = Uuid, Path, description = "Glossary term id")
    ),
    responses(
        (status = 200, description = "Glossary term deleted"),
        (status = 401, description = "Authentication required"),
        (status = 403, description = "User is not allowed to manage glossary terms")
    )
)]
pub(crate) async fn delete(
    id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let term = glossary::get_term_by_id(&mut conn, *id).await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(term.course_id),
    )
    .await?;
    glossary::delete_term_by_id_and_course_id(&mut conn, *id, term.course_id).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{term_id}", web::put().to(update))
        .route("/{term_id}", web::delete().to(delete));
}
