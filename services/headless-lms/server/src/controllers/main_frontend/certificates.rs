use crate::{controllers::helpers::file_uploading, prelude::*};
use actix_multipart::form::{MultipartForm, tempfile::TempFile};
use chrono::Utc;
use headless_lms_certificates as certificates;
use headless_lms_utils::{file_store::file_utils, icu4x::Icu4xBlob};
use models::{
    certificate_configurations::{
        CertificateTextAnchor, DatabaseCertificateConfiguration, PaperSize,
    },
    generated_certificates::GeneratedCertificate,
};

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CertificateConfigurationUpdate {
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
    metadata: actix_multipart::form::json::Json<CertificateConfigurationUpdate>,
    #[multipart(rename = "file")]
    files: Vec<TempFile>,
}

/**
POST `/api/v0/main-frontend/certificates/`

Updates the certificate configuration for a given module.
*/

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
    match result {
        Ok(files_to_delete) => {
            tx.commit().await?;
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
            // do not commit in error branch
            drop(tx);
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
    let mut tx = conn.begin().await?;
    let mut files_to_delete = vec![];

    let metadata = payload.metadata.into_inner();
    // save new svgs, if any
    let mut new_background_svg_file: Option<(Uuid, String)> = None;
    let mut new_overlay_svg_file: Option<(Uuid, String)> = None;
    for file in payload.files {
        let Some(file_name) = file.file_name else {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Missing file name in multipart request".to_string(),
                None,
            ));
        };
        let (file, _temp_path) = file.file.into_parts();
        let content = file_utils::file_to_payload(file);
        match (
            metadata.background_svg_file_name.as_ref(),
            metadata.overlay_svg_file_name.as_ref(),
        ) {
            (Some(background_svg_file_name), _) if background_svg_file_name == &file_name => {
                info!("Saving new background svg file");
                // upload new background svg
                let (id, path) = file_uploading::upload_certificate_svg(
                    &mut tx,
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
                info!("Saving new overlay svg file");
                // upload new overlay svg
                let (id, path) = file_uploading::upload_certificate_svg(
                    &mut tx,
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
        models::certificate_configurations::get_default_configuration_by_course_module_and_course_instance(
            &mut tx,
            metadata.course_module_id,
            metadata.course_instance_id,
        )
        .await
        .optional()?;
    // get new or existing background svg data for the update struct
    // also ensure that a background svg already exists or a new one is uploaded and delete old image if replaced
    let (background_svg_file_upload_id, background_svg_path) =
        match (&existing_configuration, &new_background_svg_file) {
            (Some(existing_configuration), None) => {
                // configuration exists and no new background was uploaded, use old values
                (
                    existing_configuration.background_svg_file_upload_id,
                    existing_configuration.background_svg_path.clone(),
                )
            }
            (existing, Some(background_svg_file)) => {
                // configuration exists and a new background was uploaded, delete old one
                if let Some(existing) = existing {
                    files_to_delete.push(existing.background_svg_file_upload_id);
                }
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
    // get new or existing overlay svg data for the update struct
    // also check if the old overlay svgs need to be deleted
    let overlay_data = match (
        &existing_configuration,
        &new_overlay_svg_file,
        metadata.clear_overlay_svg_file,
    ) {
        (_, Some(new_overlay), _) => {
            // new overlay was uploaded, use new values
            Some(new_overlay.clone())
        }
        (Some(existing), None, false) => {
            // no new overlay and no deletion requested, use old data
            existing
                .overlay_svg_file_upload_id
                .zip(existing.overlay_svg_path.clone())
        }
        (Some(existing), None, true) => {
            // requested deletion of old overlay
            if let Some(existing_overlay) = existing.overlay_svg_file_upload_id {
                files_to_delete.push(existing_overlay);
            }
            None
        }
        (None, None, _) => {
            // no action needed
            None
        }
    };
    let (overlay_svg_file_id, overlay_svg_file_path) = overlay_data.unzip();
    let conf = DatabaseCertificateConfiguration {
        id: existing_configuration
            .as_ref()
            .map(|c| c.id)
            .unwrap_or(Uuid::new_v4()),
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
        models::certificate_configurations::update(&mut tx, existing_configuration.id, &conf)
            .await?;
    } else {
        let inserted_configuration =
            models::certificate_configurations::insert(&mut tx, &conf).await?;
        models::certificate_configuration_to_requirements::insert(
            &mut tx,
            inserted_configuration.id,
            Some(metadata.course_module_id),
            metadata.course_instance_id,
        )
        .await?;
    }
    tx.commit().await?;
    Ok(files_to_delete)
}

#[derive(Debug, Deserialize)]
pub struct CertificateGenerationRequest {
    pub certificate_configuration_id: Uuid,
    pub name_on_certificate: String,
}

/**
POST `/api/v0/main-frontend/certificates/generate`

Generates a certificate for a given certificate configuration id.
*/
#[instrument(skip(pool))]
pub async fn generate_generated_certificate(
    request: web::Json<CertificateGenerationRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;

    let requirements = models::certificate_configuration_to_requirements::get_all_requirements_for_certificate_configuration(
        &mut conn,
        request.certificate_configuration_id,
    ).await?;

    if !requirements
        .has_user_completed_all_requirements(&mut conn, user.id)
        .await?
    {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Cannot generate certificate; user has not completed all the requirements to be eligible for this certificate."
                .to_string(),
            None,
        ));
    }
    // Skip authorization: each user should be able to generate their own certificate for any module
    let token = skip_authorize();
    // generate_and_insert verifies that the user can generate the certificate
    models::generated_certificates::generate_and_insert(
        &mut conn,
        user.id,
        &request.name_on_certificate,
        request.certificate_configuration_id,
    )
    .await?;

    token.authorized_ok(web::Json(true))
}

/**
GET `/api/v0/main-frontend/certificates/get-by-configuration-id/{certificate_configuration_id}`

Fetches the user's certificate for the given course module and course instance.
*/
#[instrument(skip(pool))]
pub async fn get_generated_certificate(
    certificate_configuration_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<GeneratedCertificate>>> {
    let mut conn = pool.acquire().await?;

    // Each user should be able to view their own certificate
    let token = skip_authorize();
    let certificate = models::generated_certificates::get_certificate_for_user(
        &mut conn,
        user.id,
        certificate_configuration_id.into_inner(),
    )
    .await
    .optional()?;

    token.authorized_ok(web::Json(certificate))
}

#[derive(Debug, Deserialize)]
pub struct CertificateQuery {
    #[serde(default)]
    debug: bool,
    #[serde(default)]
    /// If true, the certificate will be rendered using the course certificate configuration id instead of the certificate verification id.
    /// In this case the certificate is just a test certificate that is not stored in the database.
    /// This is intended for testing the certificate rendering works correctly.
    test_certificate_configuration_id: Option<Uuid>,
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
    file_store: web::Data<dyn FileStore>,
    query: web::Query<CertificateQuery>,
    icu4x_blob: web::Data<Icu4xBlob>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    // everyone needs to be able to view the certificate in order to verify its validity
    let token = skip_authorize();

    let certificate =
        if let Some(test_certificate_configuration_id) = query.test_certificate_configuration_id {
            // For testing the certificate
            GeneratedCertificate {
                id: Uuid::new_v4(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                user_id: Uuid::new_v4(),
                certificate_configuration_id: test_certificate_configuration_id,
                name_on_certificate: "Example user".to_string(),
                verification_id: "test".to_string(),
            }
        } else {
            models::generated_certificates::get_certificate_by_verification_id(
                &mut conn,
                &certificate_verification_id,
            )
            .await?
        };

    let data = certificates::generate_certificate(
        &mut conn,
        file_store.as_ref(),
        &certificate,
        query.debug,
        **icu4x_blob,
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
#[instrument(skip(pool))]
pub async fn delete_certificate_configuration(
    configuration_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let related_course_instance_ids =
        models::certificate_configurations::get_required_course_instance_ids(
            &mut conn,
            *configuration_id,
        )
        .await?;
    let mut token = None;
    if related_course_instance_ids.is_empty() {
        token =
            Some(authorize(&mut conn, Act::Teach, Some(user.id), Res::GlobalPermissions).await?);
    }
    for course_instance_id in related_course_instance_ids {
        token = Some(
            authorize(
                &mut conn,
                Act::Teach,
                Some(user.id),
                Res::CourseInstance(course_instance_id),
            )
            .await?,
        );
    }
    models::certificate_configurations::delete(&mut conn, *configuration_id).await?;
    token
        .expect("Never None at this point")
        .authorized_ok(web::Json(true))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(update_certificate_configuration))
        .route("/generate", web::post().to(generate_generated_certificate))
        .route(
            "/get-by-configuration-id/{certificate_configuration_id}",
            web::get().to(get_generated_certificate),
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
