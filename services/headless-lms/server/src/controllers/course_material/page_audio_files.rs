
use models::page_audio_files::PageAudioFiles;

use crate::prelude::*;

#[generated_doc]
async fn get_page_audio(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageAudioFiles>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let page_audio_file =
        models::page_audio_files::get_page_audio_files(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(page_audio_file))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}/files", web::get().to(get_page_audio));
}
