use models::page_audio_files::PageAudioFile;

use crate::prelude::*;

#[generated_doc]
async fn get_page_audio(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Vec<PageAudioFile>>> {
    let mut conn = pool.acquire().await?;
    let page = models::pages::get_page(&mut conn, *page_id).await?;
    let user_id = user.map(|u| u.id);
    let token = authorize_access_to_course_material(
        &mut conn,
        user_id,
        page.course_id.ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::NotFound,
                "Course not found".to_string(),
                None,
            )
        })?,
    )
    .await?;

    let mut page_audio_files =
        models::page_audio_files::get_page_audio_files(&mut conn, *page_id).await?;

    let base_url = &app_conf.base_url;
    for audio in page_audio_files.iter_mut() {
        audio.path = format!("{base_url}/api/v0/files/{}", audio.path);
    }

    token.authorized_ok(web::Json(page_audio_files))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}/files", web::get().to(get_page_audio));
}
