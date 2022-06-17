use models::course_module_completion_study_registry_registrations::RegisteredCompletion;

use crate::controllers::prelude::*;

#[instrument(skip(req, pool))]
async fn post_completions(
    req: HttpRequest,
    payload: web::Json<Vec<RegisteredCompletion>>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let secret_key = parse_secret_key_from_header(&req)?;
    let token = authorize(
        &mut conn,
        Act::View,
        None,
        Res::StudyRegistry(secret_key.to_string()),
    )
    .await?;
    let registrar =
        models::study_registry_registrars::get_by_secret_key(&mut conn, secret_key).await?;
    models::course_module_completion_study_registry_registrations::insert_completions(
        &mut conn,
        payload.0,
        registrar.id,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_completions));
}
