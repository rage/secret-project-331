use models::acronyms::AcronymUpdate;

use crate::controllers::prelude::*;

#[instrument(skip(pool))]
async fn update(
    pool: web::Data<PgPool>,
    acronym_id: web::Path<Uuid>,
    update: web::Json<AcronymUpdate>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    models::acronyms::update(&mut conn, *acronym_id, &update.acronym, &update.meaning).await?;
    Ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool))]
async fn delete(
    pool: web::Data<PgPool>,
    acronym_id: web::Path<Uuid>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    models::acronyms::delete(&mut conn, *acronym_id).await?;
    Ok(HttpResponse::Ok().finish())
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
