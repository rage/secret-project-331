use models::glossary::{self, TermUpdate};

use crate::prelude::*;

#[instrument(skip(pool))]
async fn update(
    id: web::Path<Uuid>,
    update: web::Json<TermUpdate>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    glossary::update(&mut conn, *id, &update.term, &update.definition).await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool))]
async fn delete(
    id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    glossary::delete(&mut conn, *id).await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
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
