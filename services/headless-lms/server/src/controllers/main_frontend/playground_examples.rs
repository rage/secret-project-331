use models::playground_examples::{PlaygroundExample, PlaygroundExampleData};

use crate::{domain::authorization::skip_authorize, prelude::*};

/**
GET `/api/v0/main-frontend/playground_examples` - Returns all playground examples that are not deleted.
*/
#[instrument(skip(pool))]
async fn get_playground_examples(
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<PlaygroundExample>>> {
    let mut conn = pool.acquire().await?;
    let res = models::playground_examples::get_all_playground_examples(&mut conn).await?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/playground_examples` - Saves a playground example.
*/
#[instrument(skip(pool))]
async fn insert_playground_example(
    pool: web::Data<PgPool>,
    payload: web::Json<PlaygroundExampleData>,
    user: AuthUser,
) -> ControllerResult<web::Json<PlaygroundExample>> {
    let mut conn = pool.acquire().await?;
    let new_example = payload.0;
    let res =
        models::playground_examples::insert_playground_example(&mut conn, new_example).await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::PlaygroundExample).await?;
    token.authorized_ok(web::Json(res))
}

/**
PUT `/api/v0/main-frontend/playground_examples` - Updates existing playground example.
*/
#[instrument(skip(pool))]
async fn update_playground_example(
    pool: web::Data<PgPool>,
    payload: web::Json<PlaygroundExample>,
    user: AuthUser,
) -> ControllerResult<web::Json<PlaygroundExample>> {
    let mut conn = pool.acquire().await?;
    let example = payload.0;

    let res = models::playground_examples::update_playground_example(&mut conn, example).await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::PlaygroundExample).await?;
    token.authorized_ok(web::Json(res))
}

/**
DELETE `/api/v0/main-frontend/playground_examples` - Deletes a playground example if exists.
*/
#[instrument(skip(pool))]
async fn delete_playground_example(
    pool: web::Data<PgPool>,
    playground_example_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<PlaygroundExample>> {
    let mut conn = pool.acquire().await?;
    let example_id = *playground_example_id;
    let res = models::playground_examples::delete_playground_example(&mut conn, example_id).await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::PlaygroundExample).await?;
    token.authorized_ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_playground_examples))
        .route("", web::post().to(insert_playground_example))
        .route("", web::put().to(update_playground_example))
        .route("/{id}", web::delete().to(delete_playground_example));
}
