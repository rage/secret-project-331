//! Controllers for requests starting with `/api/v0/main-frontend/course-instances`.

use bytes::Bytes;
use chrono::Utc;
use models::{
    course_instances::{self, CourseInstance, CourseInstanceForm, Points},
    courses,
    email_templates::{EmailTemplate, EmailTemplateNew},
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
        .route("/{course_instance_id}/points", web::get().to(points));
}
