//! Controllers for requests starting with `/api/v0/main-frontend/code-giveaways`.
use chrono::Utc;
use domain::csv_export::{code_giveaway_codes::CodeGiveawayCodesExportOperation, general_export};
use headless_lms_models::{
    code_giveaway_codes::CodeGiveawayCode,
    code_giveaways::{CodeGiveaway, NewCodeGiveaway},
};
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(
    get_code_giveaways_by_course,
    create_code_giveaway,
    get_code_giveaway_by_id,
    add_codes_to_code_giveaway,
    get_codes_by_code_giveaway_id,
    delete_code_giveaway_code,
    get_codes_by_code_giveaway_id_csv
))]
pub(crate) struct MainFrontendCodeGiveawaysApiDoc;

/**
GET `/api/v0/main-frontend/code-giveaways/by-course/:course_id` - Returns code giveaways for a course.
 */
#[utoipa::path(
    get,
    path = "/by-course/{course_id}",
    operation_id = "getCodeGiveawaysByCourse",
    tag = "code_giveaways",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Code giveaways for course", body = Vec<CodeGiveaway>)
    )
)]
#[instrument(skip(pool))]
async fn get_code_giveaways_by_course(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CodeGiveaway>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let code_giveaways = models::code_giveaways::get_all_for_course(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(code_giveaways))
}

/**
 * POST `/api/v0/main-frontend/code-giveaways - Creates a new code giveaway.
 */
#[utoipa::path(
    post,
    path = "",
    operation_id = "createCodeGiveaway",
    tag = "code_giveaways",
    request_body = NewCodeGiveaway,
    responses(
        (status = 200, description = "Created code giveaway", body = CodeGiveaway)
    )
)]
#[instrument(skip(pool))]
async fn create_code_giveaway(
    pool: web::Data<PgPool>,
    code_giveaway: web::Json<NewCodeGiveaway>,
    user: AuthUser,
) -> ControllerResult<web::Json<CodeGiveaway>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(code_giveaway.course_id),
    )
    .await?;

    let code_giveaway = models::code_giveaways::insert(&mut conn, &code_giveaway).await?;

    token.authorized_ok(web::Json(code_giveaway))
}

/**
 * GET `/api/v0/main-frontend/code-giveaways/:id - Gets a code giveaway by ID.
 */
#[utoipa::path(
    get,
    path = "/{id}",
    operation_id = "getCodeGiveawayById",
    tag = "code_giveaways",
    params(
        ("id" = Uuid, Path, description = "Code giveaway id")
    ),
    responses(
        (status = 200, description = "Code giveaway", body = CodeGiveaway)
    )
)]
#[instrument(skip(pool))]
async fn get_code_giveaway_by_id(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<CodeGiveaway>> {
    let mut conn = pool.acquire().await?;

    let code_giveaway = models::code_giveaways::get_by_id(&mut conn, *id).await?;

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(code_giveaway.course_id),
    )
    .await?;

    token.authorized_ok(web::Json(code_giveaway))
}

/**
 * POST `/api/v0/main-frontend/code-giveaways/:id/codes - Adds new codes to a code giveaway.
 */
#[utoipa::path(
    post,
    path = "/{id}/codes",
    operation_id = "addCodeGiveawayCodes",
    tag = "code_giveaways",
    params(
        ("id" = Uuid, Path, description = "Code giveaway id")
    ),
    request_body = Vec<String>,
    responses(
        (status = 200, description = "Added giveaway codes", body = Vec<CodeGiveawayCode>)
    )
)]
#[instrument(skip(pool))]
async fn add_codes_to_code_giveaway(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    codes: web::Json<Vec<String>>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CodeGiveawayCode>>> {
    let mut conn = pool.acquire().await?;

    let code_giveaway = models::code_giveaways::get_by_id(&mut conn, *id).await?;

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(code_giveaway.course_id),
    )
    .await?;

    let codes = models::code_giveaway_codes::insert_many(&mut conn, *id, &codes, user.id).await?;

    token.authorized_ok(web::Json(codes))
}

/**
 * GET `/api/v0/main-frontend/code-giveaways/:id/codes - Gets codes for a code giveaway by ID.
 */
#[utoipa::path(
    get,
    path = "/{id}/codes",
    operation_id = "getCodeGiveawayCodes",
    tag = "code_giveaways",
    params(
        ("id" = Uuid, Path, description = "Code giveaway id")
    ),
    responses(
        (status = 200, description = "Giveaway codes", body = Vec<CodeGiveawayCode>)
    )
)]
#[instrument(skip(pool))]
async fn get_codes_by_code_giveaway_id(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CodeGiveawayCode>>> {
    let mut conn = pool.acquire().await?;

    let code_giveaway = models::code_giveaways::get_by_id(&mut conn, *id).await?;

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(code_giveaway.course_id),
    )
    .await?;

    let codes = models::code_giveaway_codes::get_all_by_code_giveaway_id(&mut conn, *id).await?;

    token.authorized_ok(web::Json(codes))
}

/**
 * DELETE `/api/v0/main-frontend/code-giveaways/:id/codes/:code_id - Deletes a code giveaway code.
 */
#[utoipa::path(
    delete,
    path = "/{id}/codes/{code_id}",
    operation_id = "deleteCodeGiveawayCode",
    tag = "code_giveaways",
    params(
        ("id" = Uuid, Path, description = "Code giveaway id"),
        ("code_id" = Uuid, Path, description = "Giveaway code id")
    ),
    responses(
        (status = 200, description = "Deleted giveaway code")
    )
)]
#[instrument(skip(pool))]
async fn delete_code_giveaway_code(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let (id, code_id) = path.into_inner();
    let mut conn = pool.acquire().await?;

    let giveaway = models::code_giveaways::get_by_id(&mut conn, id).await?;
    let code = models::code_giveaway_codes::get_by_id(&mut conn, code_id).await?;

    if id != code.code_giveaway_id {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Code giveaway and code course mismatch",
            None,
        ));
    }

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(giveaway.course_id),
    )
    .await?;

    models::code_giveaway_codes::delete_by_id(&mut conn, code_id).await?;

    token.authorized_ok(web::Json(()))
}

/**
 * GET `/api/v0/main-frontend/code-giveaways/:id/codes/csv - Gets codes for a code giveaway by ID as CSV.
 */
#[utoipa::path(
    get,
    path = "/{id}/codes/csv",
    operation_id = "downloadCodeGiveawayCodesCsv",
    tag = "code_giveaways",
    params(
        ("id" = Uuid, Path, description = "Code giveaway id")
    ),
    responses(
        (status = 200, description = "Giveaway codes CSV", content_type = "text/csv", body = String)
    )
)]
#[instrument(skip(pool))]
async fn get_codes_by_code_giveaway_id_csv(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    let code_giveaway = models::code_giveaways::get_by_id(&mut conn, *id).await?;
    let course = models::courses::get_course(&mut conn, code_giveaway.course_id).await?;

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(code_giveaway.course_id),
    )
    .await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Giveaway codes {} / {} - {}.csv\"",
            code_giveaway.name,
            course.name,
            Utc::now().format("%Y-%m-%d")
        ),
        CodeGiveawayCodesExportOperation {
            code_giveaway_id: *id,
        },
        token,
    )
    .await
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "by-course/{course_id}",
        web::get().to(get_code_giveaways_by_course),
    )
    .route("", web::post().to(create_code_giveaway))
    .route("{id}", web::get().to(get_code_giveaway_by_id))
    .route("{id}/codes", web::get().to(get_codes_by_code_giveaway_id))
    .route(
        "{id}/codes/csv",
        web::get().to(get_codes_by_code_giveaway_id_csv),
    )
    .route("{id}/codes", web::post().to(add_codes_to_code_giveaway))
    .route(
        "{id}/codes/{code_id}",
        web::delete().to(delete_code_giveaway_code),
    );
}
