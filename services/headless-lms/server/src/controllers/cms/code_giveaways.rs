//! Controllers for requests starting with `/api/v0/cms/code-giveaways`.
use headless_lms_models::code_giveaways::CodeGiveaway;

use crate::prelude::*;

/**
GET `/api/v0/cms/code-giveaways/by-course/:course_id` - Returns code giveaways for a course.
 */
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
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "by-course/{course_id}",
        web::get().to(get_code_giveaways_by_course),
    );
}
