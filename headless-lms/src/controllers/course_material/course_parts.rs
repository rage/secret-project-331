//! Controllers for requests starting with `/api/v0/course_material/course-parts`.
use std::str::FromStr;

use crate::controllers::ApplicationResult;
use crate::models::pages::Page;
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

async fn get_course_parts_pages(
    request_course_part_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<Page>>> {
    let course_part_id = Uuid::from_str(&request_course_part_id)?;

    let course_part_pages: Vec<Page> =
        crate::models::pages::course_part_pages(pool.get_ref(), course_part_id).await?;
    Ok(Json(course_part_pages))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_course_parts_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_part_id}/pages",
        web::get().to(get_course_parts_pages),
    );
}
