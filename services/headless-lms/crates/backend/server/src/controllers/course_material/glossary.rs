use models::glossary::TermUpdate;
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(update, delete))]
pub(crate) struct CourseMaterialGlossaryApiDoc;

#[utoipa::path(
    put,
    path = "/{id}/update",
    operation_id = "updateCourseMaterialGlossaryTerm",
    tag = "course-material-glossary",
    params(
        ("id" = Uuid, Path, description = "Glossary term id")
    ),
    request_body = TermUpdate,
    responses(
        (status = 200, description = "Glossary term updated")
    )
)]
#[instrument(skip(pool))]
async fn update(
    pool: web::Data<PgPool>,
    acronym_id: web::Path<Uuid>,
    update: web::Json<TermUpdate>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let term = models::glossary::get_term_by_id(&mut conn, *acronym_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(term.course_id),
    )
    .await?;
    models::glossary::update_term_by_id_and_course_id(
        &mut conn,
        *acronym_id,
        term.course_id,
        &update.term,
        &update.definition,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[utoipa::path(
    delete,
    path = "/{id}/delete",
    operation_id = "deleteCourseMaterialGlossaryTerm",
    tag = "course-material-glossary",
    params(
        ("id" = Uuid, Path, description = "Glossary term id")
    ),
    responses(
        (status = 200, description = "Glossary term deleted")
    )
)]
#[instrument(skip(pool))]
async fn delete(
    pool: web::Data<PgPool>,
    acronym_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let term = models::glossary::get_term_by_id(&mut conn, *acronym_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(term.course_id),
    )
    .await?;
    models::glossary::delete_term_by_id_and_course_id(&mut conn, *acronym_id, term.course_id)
        .await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}/update", web::put().to(update))
        .route("/{id}/delete", web::delete().to(delete));
}
