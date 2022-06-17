use models::course_module_completion_study_registry_registrations::RegisteredCompletion;

use crate::controllers::prelude::*;

#[instrument(skip(req, pool))]
async fn post_completions(
    req: HttpRequest,
    payload: web::Json<Vec<RegisteredCompletion>>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let raw_token = req
        .headers()
        .get("Authorization")
        .map_or(Ok(""), |x| x.to_str())
        .map_err(|_| ControllerError::Forbidden("Access denied.".to_string()))?;
    let secret_key = parse_secret_key_from_token(raw_token)?.to_string();
    let token = authorize(
        &mut conn,
        Act::View,
        None,
        Res::StudyRegistry(secret_key.to_string()),
    )
    .await?;
    let registrar =
        models::study_registry_registrars::get_by_secret_key(&mut conn, &secret_key).await?;
    models::course_module_completion_study_registry_registrations::insert_completions(
        &mut conn,
        payload.0,
        registrar.id,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

fn parse_secret_key_from_token(token: &str) -> Result<&str, ControllerError> {
    if !token.starts_with("Basic") {
        return Err(ControllerError::Forbidden("Access denied".to_string()));
    }
    let secret_key = token
        .split(' ')
        .nth(1)
        .ok_or_else(|| anyhow::anyhow!("Malformed authorization token"))?;
    Ok(secret_key)
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_completions));
}
