//! Controllers for requests starting with `/api/v0/main-frontend/course-instances`.

use crate::{
    controllers::ControllerResult,
    domain::{authorization::AuthUser, csv_export},
    models::{
        course_instances::{self, CourseInstance, CourseInstanceForm, Points},
        courses,
        email_templates::{EmailTemplate, EmailTemplateNew},
    },
    utils::pagination::Pagination,
};
use actix_web::{
    web::{self, Json, ServiceConfig},
    HttpResponse,
};
use bytes::Bytes;
use chrono::Utc;
use sqlx::PgPool;
use std::io::{self, Write};
use tokio::sync::mpsc::UnboundedSender;
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;

/**
GET /course-instances/:id
*/
#[instrument(skip(pool))]
async fn get_course_instance(
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<CourseInstance>> {
    let mut conn = pool.acquire().await?;
    let course_instance = crate::models::course_instances::get_course_instance(
        &mut conn,
        request_course_instance_id.into_inner(),
    )
    .await?;
    Ok(Json(course_instance))
}

#[instrument(skip(payload, pool))]
async fn post_new_email_template(
    request_course_instance_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplateNew>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let new_email_template = payload.0;
    let email_template = crate::models::email_templates::insert_email_template(
        &mut conn,
        *request_course_instance_id,
        new_email_template,
        None,
    )
    .await?;
    Ok(Json(email_template))
}

#[instrument(skip(pool))]
async fn get_email_templates_by_course_instance_id(
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<Vec<EmailTemplate>>> {
    let mut conn = pool.acquire().await?;

    let email_templates =
        crate::models::email_templates::get_email_templates(&mut conn, *request_course_instance_id)
            .await?;
    Ok(Json(email_templates))
}

struct Adapter {
    sender: UnboundedSender<ControllerResult<Bytes>>,
}

impl Write for Adapter {
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }

    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let bytes = Bytes::copy_from_slice(buf);
        self.sender
            .send(Ok(bytes))
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        Ok(buf.len())
    }
}

#[instrument(skip(pool))]
pub async fn point_export(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    let course_instance_id = course_instance_id.into_inner();

    // spawn handle that writes the csv row by row into the sender
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let res = csv_export::export_course_instance_points(
            &mut handle_conn,
            course_instance_id,
            Adapter { sender },
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
    Ok(HttpResponse::Ok()
        .append_header((
            "Content-Disposition",
            format!(
                "attachment; filename=\"{} - {} - Point export {}.csv\"",
                course.name,
                course_instance.name.as_deref().unwrap_or("unnamed"),
                Utc::today().format("%Y-%m-%d")
            ),
        ))
        .streaming(UnboundedReceiverStream::new(receiver)))
}

#[instrument(skip(pool))]
async fn points(
    course_instance_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Points>> {
    let mut conn = pool.acquire().await?;
    let points =
        course_instances::get_points(&mut conn, course_instance_id.into_inner(), &pagination)
            .await?;
    Ok(Json(points))
}

/**
POST /course-instances/:id/edit
*/
#[instrument(skip(pool))]
pub async fn edit(
    update: web::Json<CourseInstanceForm>,
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    course_instances::edit(
        &mut conn,
        course_instance_id.into_inner(),
        update.into_inner(),
    )
    .await?;
    Ok(HttpResponse::Ok().finish())
}

/**
POST /course-instances/:id/delete
*/
#[instrument(skip(pool))]
async fn delete(id: web::Path<Uuid>, pool: web::Data<PgPool>) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    crate::models::course_instances::delete(&mut conn, *id).await?;
    Ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_course_instances_routes(cfg: &mut ServiceConfig) {
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
