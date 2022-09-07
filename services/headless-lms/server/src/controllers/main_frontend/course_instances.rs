//! Controllers for requests starting with `/api/v0/main-frontend/course-instances`.

use bytes::Bytes;
use chrono::{DateTime, Utc};
use models::{
    course_instance_enrollments,
    course_instances::{self, CourseInstance, CourseInstanceForm, Points},
    course_module_completions::{self, NewCourseModuleCompletion},
    course_modules, courses,
    email_templates::{EmailTemplate, EmailTemplateNew},
    library::{self, progressing::CourseInstanceCompletionSummary},
    users,
};
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::{
    controllers::prelude::*,
    domain::csv_export::{self, make_authorized_streamable, CSVExportAdapter},
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
    let course_instance_id = *course_instance_id;
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    // spawn handle that writes the csv row by row into the sender
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let res = csv_export::export_course_instance_points(
            &mut handle_conn,
            course_instance_id,
            CSVExportAdapter {
                sender,
                authorization_token: token,
            },
        )
        .await;
        if let Err(err) = res {
            tracing::error!("Failed to export course instance points: {}", err);
        }
    });

    let course_instance =
        course_instances::get_course_instance(&mut conn, course_instance_id).await?;
    let course = courses::get_course(&mut conn, course_instance.course_id).await?;

    // return response that streams data from the receiver

    return token.authorized_ok(
        HttpResponse::Ok()
            .append_header((
                "Content-Disposition",
                format!(
                    "attachment; filename=\"{} - {} - Point export {}.csv\"",
                    course.name,
                    course_instance.name.as_deref().unwrap_or("unnamed"),
                    Utc::today().format("%Y-%m-%d")
                ),
            ))
            .streaming(make_authorized_streamable(UnboundedReceiverStream::new(
                receiver,
            ))),
    );
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct TeacherManualCompletionRequest {
    pub course_module_id: Uuid,
    pub new_completions: Vec<TeacherManualCompletion>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct TeacherManualCompletion {
    pub user_id: Uuid,
    pub grade: Option<i32>,
    pub completion_date: Option<DateTime<Utc>>,
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
    let course_module = course_modules::get_by_id(&mut conn, data.course_module_id).await?;
    let instance = course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    if course_module.course_id != instance.course_id {
        return Err(ControllerError::BadRequest(
            "Course module not part of the course.".to_string(),
        ));
    }
    let course = courses::get_course(&mut conn, instance.course_id).await?;
    let mut tx = conn.begin().await?;
    for completion in data.new_completions {
        let user = users::get_by_id(&mut tx, completion.user_id).await?;
        let existing_completion =
            course_module_completions::get_by_course_module_instance_and_user_ids(
                &mut tx,
                data.course_module_id,
                *course_instance_id,
                completion.user_id,
            )
            .await
            .optional()?;
        if existing_completion.is_none() {
            course_module_completions::insert(
                &mut tx,
                &NewCourseModuleCompletion {
                    course_id: instance.course_id,
                    course_instance_id: instance.id,
                    course_module_id: data.course_module_id,
                    user_id: completion.user_id,
                    completion_date: completion.completion_date.unwrap_or_else(Utc::now),
                    completion_registration_attempt_date: None,
                    completion_language: course.language_code.clone(),
                    eligible_for_ects: true,
                    email: user.email,
                    grade: completion.grade,
                    passed: true,
                },
                None,
            )
            .await?;
        }
        // Else: create new entry anyway. TODO + remove database restraint.
    }
    tx.commit().await?;
    token.authorized_ok(web::Json(()))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ManualCompletionPreview {
    already_completed_users: Vec<Uuid>,
    first_time_completing_users: Vec<Uuid>,
    non_enrolled_users: Vec<Uuid>,
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
    let course_module = course_modules::get_by_id(&mut conn, data.course_module_id).await?;
    let instance = course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    if course_module.course_id != instance.course_id {
        return Err(ControllerError::BadRequest(
            "Course module not part of the course.".to_string(),
        ));
    }
    let mut already_completed_users = vec![];
    let mut first_time_completing_users = vec![];
    let mut non_enrolled_users = vec![];
    for completion in data.new_completions {
        let course_module_completion =
            course_module_completions::get_by_course_module_instance_and_user_ids(
                &mut conn,
                data.course_module_id,
                *course_instance_id,
                completion.user_id,
            )
            .await
            .optional()?;
        if course_module_completion.is_some() {
            already_completed_users.push(completion.user_id);
        } else {
            first_time_completing_users.push(completion.user_id);
        }
        let enrollment = course_instance_enrollments::get_by_user_and_course_instance_id(
            &mut conn,
            completion.user_id,
            instance.id,
        )
        .await
        .optional()?;
        if enrollment.is_none() {
            non_enrolled_users.push(completion.user_id);
        }
    }
    token.authorized_ok(web::Json(ManualCompletionPreview {
        already_completed_users,
        first_time_completing_users,
        non_enrolled_users,
    }))
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
            "/{course_instance_id}/points/export",
            web::get().to(point_export),
        )
        .route("/{course_instance_id}/edit", web::post().to(edit))
        .route("/{course_instance_id}/delete", web::post().to(delete))
        .route(
            "/{course_instance_id}/completions",
            web::get().to(completions),
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
            "/{course_instance_id}/reprocess-completions",
            web::post().to(post_reprocess_module_completions),
        );
}
