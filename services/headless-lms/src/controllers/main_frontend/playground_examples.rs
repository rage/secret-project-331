use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    controllers::ControllerResult,
    domain::authorization::{authorize, Action, AuthUser, Resource},
    models::playground_examples::{PlaygroundExample, PlaygroundExampleData},
};

#[instrument(skip(pool))]
async fn get_playground_examples(
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Vec<PlaygroundExample>>> {
    let mut conn = pool.acquire().await?;
    let res = crate::models::playground_examples::get_all_playground_examples(&mut conn).await?;
    Ok(Json(res))
}

#[instrument(skip(pool))]
async fn insert_playground_example(
    pool: web::Data<PgPool>,
    payload: web::Json<PlaygroundExampleData>,
    user: AuthUser,
) -> ControllerResult<Json<PlaygroundExample>> {
    let mut conn = pool.acquire().await?;
    let new_example = payload.0;
    authorize(
        &mut conn,
        Action::Edit,
        user.id,
        Resource::PlaygroundExample,
    )
    .await?;
    let res = crate::models::playground_examples::insert_playground_example(&mut conn, new_example)
        .await?;
    Ok(Json(res))
}

#[instrument(skip(pool))]
async fn delete_playground_example(
    pool: web::Data<PgPool>,
    request_playground_example_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<PlaygroundExample>> {
    let mut conn = pool.acquire().await?;
    let example_id = *request_playground_example_id;
    authorize(
        &mut conn,
        Action::Edit,
        user.id,
        Resource::PlaygroundExample,
    )
    .await?;
    let res = crate::models::playground_examples::delete_playground_example(&mut conn, example_id)
        .await?;
    Ok(Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_playground_examples_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_playground_examples))
        .route("", web::post().to(insert_playground_example))
        .route("/{id}", web::delete().to(delete_playground_example));
}
