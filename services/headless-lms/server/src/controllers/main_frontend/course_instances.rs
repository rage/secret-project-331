//! Controllers for requests starting with `/api/v0/main-frontend/course-instances`.

use chrono::Utc;
use models::{
    course_instances::{self, CourseInstance, CourseInstanceForm, Points},
    course_module_certificate_configurations::CourseModuleCertificateConfiguration,
    courses,
    email_templates::{EmailTemplate, EmailTemplateNew},
    exercises::ExerciseStatusSummaryForUser,
    library::{
        self,
        progressing::{
            CourseInstanceCompletionSummary, ManualCompletionPreview,
            TeacherManualCompletionRequest,
        },
    },
};

use crate::{
    domain::csv_export::{
        course_instance_export::CompletionsExportOperation, general_export,
        points::PointExportOperation,
    },
    prelude::*,
};

/**
GET /course-instances/:id
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_course_instance(
    course_instance_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CourseInstance>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let course_instance =
        models::course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    token.authorized_ok(web::Json(course_instance))
}

#[generated_doc]
#[instrument(skip(payload, pool))]
async fn post_new_email_template(
    course_instance_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplateNew>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let new_email_template = payload.0;
    let email_template = models::email_templates::insert_email_template(
        &mut conn,
        *course_instance_id,
        new_email_template,
        None,
    )
    .await?;
    token.authorized_ok(web::Json(email_template))
}

/**
POST `/api/v0/main-frontend/course-instances/{course_instance_id}/reprocess-completions`

Reprocesses all module completions for the given course instance. Only available to admins.
*/
#[generated_doc]
#[instrument(skip(pool, user))]
async fn post_reprocess_module_completions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_instance_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    models::library::progressing::process_all_course_instance_completions(
        &mut conn,
        *course_instance_id,
    )
    .await?;
    token.authorized_ok(web::Json(true))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn get_email_templates_by_course_instance_id(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<EmailTemplate>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;

    let email_templates =
        models::email_templates::get_email_templates(&mut conn, *course_instance_id).await?;
    token.authorized_ok(web::Json(email_templates))
}

/**
GET `/api/v0/main-frontend/course-instances/${courseInstanceId}/export-points` - gets CSV of course instance points based on course_instance ID.
*/
#[instrument(skip(pool))]
pub async fn point_export(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;

    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let course = courses::get_course(&mut conn, course_instance.course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"{} - {} - Point export {}.csv\"",
            course.name,
            course_instance.name.as_deref().unwrap_or("unnamed"),
            Utc::now().format("%Y-%m-%d")
        ),
        PointExportOperation {
            course_instance_id: *course_instance_id,
        },
        token,
    )
    .await
}

#[generated_doc]
#[instrument(skip(pool))]
async fn points(
    course_instance_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Points>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let points = course_instances::get_points(&mut conn, *course_instance_id, *pagination).await?;
    token.authorized_ok(web::Json(points))
}

/**
GET `/api/v0/main-frontend/course-instances/{course_instance_id}/completions`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn completions(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseInstanceCompletionSummary>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let completions =
        library::progressing::get_course_instance_completion_summary(&mut conn, &course_instance)
            .await?;
    token.authorized_ok(web::Json(completions))
}

/**
POST `/api/v0/main-frontend/course-instances/{course_instance_id}/completions`
*/
#[instrument(skip(pool, payload))]
async fn post_completions(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<TeacherManualCompletionRequest>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let data = payload.0;
    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    library::progressing::add_manual_completions(&mut conn, user.id, &course_instance, &data)
        .await?;
    token.authorized_ok(web::Json(()))
}

#[instrument(skip(pool, payload))]
async fn preview_post_completions(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<TeacherManualCompletionRequest>,
) -> ControllerResult<web::Json<ManualCompletionPreview>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let data = payload.0;
    let instance = course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let preview =
        library::progressing::get_manual_completion_result_preview(&mut conn, &instance, &data)
            .await?;
    token.authorized_ok(web::Json(preview))
}

/**
POST /course-instances/:id/edit
*/
#[instrument(skip(pool))]
pub async fn edit(
    update: web::Json<CourseInstanceForm>,
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    course_instances::edit(&mut conn, *course_instance_id, update.into_inner()).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
POST /course-instances/:id/delete
*/
#[instrument(skip(pool))]
async fn delete(
    id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*id),
    )
    .await?;
    models::course_instances::delete(&mut conn, *id).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
GET /course-instances/:id/export-completions - gets CSV of course completion based on course_instance ID.
*/
#[instrument(skip(pool))]
pub async fn completions_export(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;

    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let course = courses::get_course(&mut conn, course_instance.course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"{} - {} - Completions export {}.csv\"",
            course.name,
            course_instance.name.as_deref().unwrap_or("unnamed"),
            Utc::now().format("%Y-%m-%d")
        ),
        CompletionsExportOperation {
            course_instance_id: *course_instance_id,
        },
        token,
    )
    .await
}
/**
GET /course-instances/:id/certificate-configurations - gets the certificate configurations of the given course instance
*/
#[instrument(skip(pool))]
pub async fn certificate_configurations(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseModuleCertificateConfiguration>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;

    let certificate_configurations = models::course_module_certificate_configurations::get_course_module_certificate_configurations_by_course_instance(&mut conn, *course_instance_id).await?;
    token.authorized_ok(web::Json(certificate_configurations))
}

/**
GET /course-instances/:id/status-for-all-exercises/:user_id - Returns a status for all exercises in a course instance for a given user.
*/
#[instrument(skip(pool))]
#[generated_doc]
async fn get_all_exercise_statuses_by_course_instance_id(
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseStatusSummaryForUser>>> {
    let (course_instance_id, user_id) = params.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(course_instance_id),
    )
    .await?;

    let res = models::exercises::get_all_exercise_statuses_by_user_id_and_course_instance_id(
        &mut conn,
        course_instance_id,
        user_id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_instance_id}", web::get().to(get_course_instance))
        .route(
            "/{course_instance_id}/email-templates",
            web::post().to(post_new_email_template),
        )
        .route(
            "/{course_instance_id}/email-templates",
            web::get().to(get_email_templates_by_course_instance_id),
        )
        .route(
            "/{course_instance_id}/export-points",
            web::get().to(point_export),
        )
        .route("/{course_instance_id}/edit", web::post().to(edit))
        .route("/{course_instance_id}/delete", web::post().to(delete))
        .route(
            "/{course_instance_id}/completions",
            web::get().to(completions),
        )
        .route(
            "/{course_instance_id}/export-completions",
            web::get().to(completions_export),
        )
        .route(
            "/{course_instance_id}/completions",
            web::post().to(post_completions),
        )
        .route(
            "/{course_instance_id}/completions/preview",
            web::post().to(preview_post_completions),
        )
        .route("/{course_instance_id}/points", web::get().to(points))
        .route(
            "/{course_instance_id}/status-for-all-exercises/{user_id}",
            web::get().to(get_all_exercise_statuses_by_course_instance_id),
        )
        .route(
            "/{course_instance_id}/reprocess-completions",
            web::post().to(post_reprocess_module_completions),
        )
        .route(
            "/{course_instance_id}/certificate-configurations",
            web::get().to(certificate_configurations),
        );
}
