use crate::{controllers::helpers::file_uploading, prelude::*};
use actix_multipart::form::{tempfile::TempFile, MultipartForm};
use bytes::Bytes;
use headless_lms_certificates as certificates;
use headless_lms_utils::file_store::GenericPayload;
use models::{
    course_module_certificate_configurations::{
        CertificateTextAnchor, DatabaseCourseModuleCertificateConfiguration, PaperSize,
    },
    course_module_completion_certificates::CourseModuleCompletionCertificate,
};
use std::io::Read;

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModuleCertificateConfigurationUpdate {
    pub course_module_id: Uuid,
    pub course_instance_id: Option<Uuid>,
    pub certificate_owner_name_y_pos: Option<String>,
    pub certificate_owner_name_x_pos: Option<String>,
    pub certificate_owner_name_font_size: Option<String>,
    pub certificate_owner_name_text_color: Option<String>,
    pub certificate_owner_name_text_anchor: Option<CertificateTextAnchor>,
    pub certificate_validate_url_y_pos: Option<String>,
    pub certificate_validate_url_x_pos: Option<String>,
    pub certificate_validate_url_font_size: Option<String>,
    pub certificate_validate_url_text_color: Option<String>,
    pub certificate_validate_url_text_anchor: Option<CertificateTextAnchor>,
    pub certificate_date_y_pos: Option<String>,
    pub certificate_date_x_pos: Option<String>,
    pub certificate_date_font_size: Option<String>,
    pub certificate_date_text_color: Option<String>,
    pub certificate_date_text_anchor: Option<CertificateTextAnchor>,
    pub certificate_locale: Option<String>,
    pub paper_size: Option<PaperSize>,
    pub background_svg_file_name: Option<String>,
    pub overlay_svg_file_name: Option<String>,
    pub clear_overlay_svg_file: bool,
}

#[derive(Debug, MultipartForm)]
pub struct CertificateConfigurationUpdateForm {
    metadata: actix_multipart::form::json::Json<CourseModuleCertificateConfigurationUpdate>,
    #[multipart(rename = "file")]
    files: Vec<TempFile>,
}

/**
POST `/api/v0/main-frontend/certificates/`

Updates the certificate configuration for a given module.
*/
#[generated_doc]
#[instrument(skip(pool, payload, file_store))]
pub async fn update_certificate_configuration(
    pool: web::Data<PgPool>,
    payload: MultipartForm<CertificateConfigurationUpdateForm>,
    file_store: web::Data<dyn FileStore>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;

    let payload = payload.into_inner();

    let course_id = models::course_modules::get_by_id(&mut tx, payload.metadata.course_module_id)
        .await?
        .course_id;
    let token = authorize(&mut tx, Act::Edit, Some(user.id), Res::Course(course_id)).await?;
    let mut uploaded_files = vec![];
    let result = update_certificate_configuration_inner(
        &mut tx,
        &mut uploaded_files,
        course_id,
        payload,
        file_store.as_ref(),
        user,
    )
    .await;
    tx.commit().await?;
    match result {
        Ok(files_to_delete) => {
            for file_to_delete in files_to_delete {
                if let Err(err) = file_uploading::delete_file_from_storage(
                    &mut conn,
                    file_to_delete,
                    file_store.as_ref(),
                )
                .await
                {
                    // do not propagate error so that we at least try to delete all of the files
                    error!("Failed to delete file '{file_to_delete}': {err}");
                }
            }
        }
        Err(err) => {
            // clean up files that were uploaded before something went wrong
            for uploaded_file in uploaded_files {
                if let Err(err) = file_uploading::delete_file_from_storage(
                    &mut conn,
                    uploaded_file,
                    file_store.as_ref(),
                )
                .await
                {
                    // do not propagate error so that we at least try to delete all of the files
                    error!("Failed to delete file '{uploaded_file}' during cleanup: {err}");
                }
            }
            return Err(err);
        }
    }
    token.authorized_ok(web::Json(true))
}

// wrapper so that the parent function can do cleanup if anything goes wrong
async fn update_certificate_configuration_inner(
    conn: &mut PgConnection,
    uploaded_files: &mut Vec<Uuid>,
    course_id: Uuid,
    payload: CertificateConfigurationUpdateForm,
    file_store: &dyn FileStore,
    user: AuthUser,
) -> Result<Vec<Uuid>, ControllerError> {
    let mut files_to_delete = vec![];

    let metadata = payload.metadata.into_inner();
    // save new svgs, if any
    let mut new_background_svg_file: Option<(Uuid, String)> = None;
    let mut new_overlay_svg_file: Option<(Uuid, String)> = None;
    let mut file_download_handles = vec![];
    for mut file in payload.files {
        let Some(file_name) = file.file_name else {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Missing file name in multipart request".to_string(),
                None,
            ));
        };
        let (mut send, recv) = futures::channel::mpsc::channel(512);
        // spawn file reader
        let file_handle = tokio::task::spawn_blocking(move || {
            let mut buf = [0; 512];
            loop {
                let count = file.file.read(&mut buf)?;
                if count > 0 {
                    send.try_send(Ok(Bytes::copy_from_slice(&buf[..count])))
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                } else {
                    break;
                }
            }
            std::io::Result::Ok(())
        });
        file_download_handles.push(file_handle);
        let content = Box::pin(recv) as GenericPayload;
        match (
            metadata.background_svg_file_name.as_ref(),
            metadata.overlay_svg_file_name.as_ref(),
        ) {
            (Some(background_svg_file_name), _) if background_svg_file_name == &file_name => {
                // upload new background svg
                let (id, path) = file_uploading::upload_certificate_svg(
                    conn,
                    background_svg_file_name,
                    content,
                    file_store,
                    course_id,
                    user,
                )
                .await?;
                uploaded_files.push(id);
                new_background_svg_file =
                    Some((id, path.to_str().context("Invalid path")?.to_string()));
            }
            (_, Some(overlay_svg_file_name)) if overlay_svg_file_name == &file_name => {
                // upload new overlay svg
                let (id, path) = file_uploading::upload_certificate_svg(
                    conn,
                    overlay_svg_file_name,
                    content,
                    file_store,
                    course_id,
                    user,
                )
                .await?;
                uploaded_files.push(id);
                new_overlay_svg_file =
                    Some((id, path.to_str().context("Invalid path")?.to_string()));
            }
            _ => {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Invalid field in multipart request".to_string(),
                    None,
                ));
            }
        }
    }

    let existing_configuration =
        models::course_module_certificate_configurations::get_by_course_module_and_course_instance(
            conn,
            metadata.course_module_id,
            metadata.course_instance_id,
        )
        .await
        .optional()?;
    // get new or existing background svg data for the update struct
    // also ensure that a background svg already exists or a new one is uploaded
    let (background_svg_file_upload_id, background_svg_path) =
        match (&existing_configuration, &new_background_svg_file) {
            (Some(existing_configuration), None) => {
                // use values from existing config
                (
                    existing_configuration.background_svg_file_upload_id,
                    existing_configuration.background_svg_path.clone(),
                )
            }
            (_, Some(background_svg_file)) => {
                // use new values
                background_svg_file.clone()
            }
            (None, None) => {
                // no existing config and no new upload, invalid request
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Missing background SVG file".to_string(),
                    None,
                ));
            }
        };
    // check if the old overlay svgs need to be deleted
    if let Some(existing_configuration) = &existing_configuration {
        // delete previous background when a new one is uploaded
        if new_background_svg_file.is_some() {
            files_to_delete.push(background_svg_file_upload_id);
        }
        // delete overlay when either a new overlay is uploaded, or when deletion is explicitly requested
        if new_overlay_svg_file.is_some() || metadata.clear_overlay_svg_file {
            if let Some(overlay_svg_file_upload_id) =
                existing_configuration.overlay_svg_file_upload_id
            {
                files_to_delete.push(overlay_svg_file_upload_id);
            }
        }
    }
    let (overlay_svg_file_id, overlay_svg_file_path) = new_overlay_svg_file.unzip();
    let conf = DatabaseCourseModuleCertificateConfiguration {
        course_module_id: metadata.course_module_id,
        course_instance_id: metadata.course_instance_id,
        certificate_owner_name_y_pos: metadata.certificate_owner_name_y_pos,
        certificate_owner_name_x_pos: metadata.certificate_owner_name_x_pos,
        certificate_owner_name_font_size: metadata.certificate_owner_name_font_size,
        certificate_owner_name_text_color: metadata.certificate_owner_name_text_color,
        certificate_owner_name_text_anchor: metadata.certificate_owner_name_text_anchor,
        certificate_validate_url_y_pos: metadata.certificate_validate_url_y_pos,
        certificate_validate_url_x_pos: metadata.certificate_validate_url_x_pos,
        certificate_validate_url_font_size: metadata.certificate_validate_url_font_size,
        certificate_validate_url_text_color: metadata.certificate_validate_url_text_color,
        certificate_validate_url_text_anchor: metadata.certificate_validate_url_text_anchor,
        certificate_date_y_pos: metadata.certificate_date_y_pos,
        certificate_date_x_pos: metadata.certificate_date_x_pos,
        certificate_date_font_size: metadata.certificate_date_font_size,
        certificate_date_text_color: metadata.certificate_date_text_color,
        certificate_date_text_anchor: metadata.certificate_date_text_anchor,
        certificate_locale: metadata.certificate_locale,
        paper_size: metadata.paper_size,
        background_svg_path,
        background_svg_file_upload_id,
        overlay_svg_path: overlay_svg_file_path,
        overlay_svg_file_upload_id: overlay_svg_file_id,
    };
    if let Some(existing_configuration) = existing_configuration {
        // update existing config
        models::course_module_certificate_configurations::update(
            conn,
            existing_configuration.id,
            &conf,
        )
        .await?;
    } else {
        models::course_module_certificate_configurations::insert(conn, &conf).await?;
    }
    for handle in file_download_handles {
        handle
            .await
            .map_err(|e| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Error while processing file".to_string(),
                    Some(e.into()),
                )
            })?
            .map_err(|e| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Error while processing file".to_string(),
                    Some(e.into()),
                )
            })?;
    }
    Ok(files_to_delete)
}

#[derive(Debug, Deserialize)]
pub struct CertificateGenerationRequest {
    pub course_module_id: Uuid,
    pub course_instance_id: Uuid,
    pub name_on_certificate: String,
}

/**
POST `/api/v0/main-frontend/course-modules/generate-certificate`

Generates a certificate for completing a course module.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn generate_course_module_completion_certificate(
    request: web::Json<CertificateGenerationRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;

    let module = models::course_modules::get_by_id(&mut conn, request.course_module_id).await?;
    if !module.certification_enabled {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Cannot generate certificate for completion; generating certifications for this module is disabled"
                .to_string(),
            None,
        ));
    }
    let completion =
        models::course_module_completions::get_latest_by_course_module_instance_and_user_ids(
            &mut conn,
            request.course_module_id,
            request.course_instance_id,
            user.id,
        )
        .await?;
    if !completion.passed {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Cannot generate certificate for completion; user has not completed the module"
                .to_string(),
            None,
        ));
    }
    // Skip authorization: each user should be able to generate their own certificate for any module
    let token = skip_authorize()?;
    // generate_and_insert verifies that the user can generate the certificate
    models::course_module_completion_certificates::generate_and_insert(
        &mut conn,
        user.id,
        request.course_module_id,
        request.course_instance_id,
        &request.name_on_certificate,
    )
    .await?;

    token.authorized_ok(web::Json(true))
}

/**
GET `/api/v0/main-frontend/certificates/course-module/{course_module_id}/course-instance/{course_instance_id}`

Fetches the user's certificate for the given course module and course instance.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_course_module_completion_certificate(
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<CourseModuleCompletionCertificate>>> {
    let mut conn = pool.acquire().await?;

    let course_module_id = params.0;
    let course_instance_id = params.1;
    // Each user should be able to view their own certificate
    let token = skip_authorize()?;
    let certificate = models::course_module_completion_certificates::get_certificate_for_user(
        &mut conn,
        user.id,
        course_module_id,
        course_instance_id,
    )
    .await
    .optional()?;

    token.authorized_ok(web::Json(certificate))
}

#[derive(Debug, Deserialize)]
pub struct CertificateQuery {
    #[serde(default)]
    debug: bool,
}

/**
GET `/api/v0/main-frontend/certificates/{certificate_verification_id}`

Fetches the user's certificate using the verification id.

Response: the certificate as a png.
*/
#[instrument(skip(pool, file_store))]
pub async fn get_cerficate_by_verification_id(
    certificate_verification_id: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    query: web::Query<CertificateQuery>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    // everyone needs to be able to view the certificate in order to verify its validity
    let token = skip_authorize()?;
    let certificate =
        models::course_module_completion_certificates::get_certificate_by_verification_id(
            &mut conn,
            &certificate_verification_id,
        )
        .await?;

    let data = certificates::generate_certificate(
        &mut conn,
        file_store.as_ref(),
        &certificate,
        query.debug,
    )
    .await?;
    let max_age = if query.debug { 0 } else { 300 };
    token.authorized_ok(
        HttpResponse::Ok()
            .content_type("image/png")
            .insert_header(("Cache-Control", format!("max-age={max_age}")))
            .body(data),
    )
}

/**
DELETE `/api/v0/main-frontend/certificates/configuration/{configuration_id}`

Deletes the given configuration.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn delete_certificate_configuration(
    configuration_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let course_id = models::course_module_certificate_configurations::get_course_id_of(
        &mut conn,
        *configuration_id,
    )
    .await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;
    models::course_module_certificate_configurations::delete(&mut conn, *configuration_id).await?;
    token.authorized_ok(web::Json(true))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(update_certificate_configuration))
        .route(
            "/generate",
            web::post().to(generate_course_module_completion_certificate),
        )
        .route(
            "/course-module/{course_module_id}/course-instance/{course_instance_id}",
            web::get().to(get_course_module_completion_certificate),
        )
        .route(
            "/{certificate_verification_id}",
            web::get().to(get_cerficate_by_verification_id),
        )
        .route(
            "/configuration/{certificate_configuration_id}",
            web::delete().to(delete_certificate_configuration),
        );
}
