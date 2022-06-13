//! Controllers for requests starting with `/api/v0/study-registry/completions`

use futures::TryStreamExt;
use models::course_module_completions::CourseModuleCompletion;

use crate::controllers::prelude::*;

#[instrument(skip(pool))]
async fn get_completions(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<CourseModuleCompletion>>> {
    let mut conn = pool.acquire().await?;
    let course_module =
        models::course_modules::get_default_by_course_id(&mut conn, *course_id).await?;
    let stream =
        models::course_module_completions::stream_by_course_module_id(&mut conn, course_module.id);
    // TODO: Actual streaming of results
    let res = stream.try_collect().await?;
    Ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::get().to(get_completions));
}
