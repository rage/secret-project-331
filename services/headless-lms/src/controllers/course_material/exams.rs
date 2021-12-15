use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::{
        courses::Course,
        exams::{self, ExamEnrollment},
        pages::{self, Page},
    },
};
use actix_web::web::{self, Json, ServiceConfig};
use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use ts_rs::TS;
use uuid::Uuid;

pub async fn enrollment(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<Option<ExamEnrollment>>> {
    let mut conn = pool.acquire().await?;
    let enrollment = exams::get_enrollment(&mut conn, id.into_inner(), user.id).await?;
    Ok(Json(enrollment))
}

pub async fn enroll(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<()>> {
    let mut conn = pool.acquire().await?;
    exams::enroll(&mut conn, id.into_inner(), user.id).await?;
    Ok(Json(()))
}

#[derive(Debug, Serialize, TS)]
#[serde(tag = "tag")]
pub enum ExamData {
    EnrolledAndOpen {
        id: Uuid,
        name: String,
        instructions: String,
        page_id: Uuid,
        courses: Vec<Course>,
        starts_at: DateTime<Utc>,
        ends_at: Option<DateTime<Utc>>,
        time_minutes: i32,
        page: Box<Page>,
        enrollment: ExamEnrollment,
    },
    EnrolledAndClosed,
    NotEnrolled,
    OutOfTime,
}

pub async fn fetch_exam_for_user(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<ExamData>> {
    let mut conn = pool.acquire().await?;
    let id = id.into_inner();

    let enrollment = if let Some(enrollment) = exams::get_enrollment(&mut conn, id, user.id).await?
    {
        // user has started the exam
        enrollment
    } else {
        // user has not started the exam
        return Ok(Json(ExamData::NotEnrolled));
    };

    let exam = exams::get(&mut conn, id).await?;

    // check if the user's time is up
    if Utc::now() > enrollment.started_at + Duration::minutes(exam.time_minutes.into()) {
        return Ok(Json(ExamData::OutOfTime));
    }

    // check if the exam is closed
    let starts_at = match exam.starts_at {
        Some(starts_at) => {
            if starts_at > Utc::now() {
                // hasn't started yet
                return Ok(Json(ExamData::EnrolledAndClosed));
            }
            if let Some(ends_at) = exam.ends_at {
                if ends_at < Utc::now() {
                    // already ended
                    return Ok(Json(ExamData::EnrolledAndClosed));
                }
            }
            starts_at
        }
        None => {
            // no start time defined
            return Ok(Json(ExamData::EnrolledAndClosed));
        }
    };

    let page = pages::get_page(&mut conn, exam.page_id).await?;

    Ok(Json(ExamData::EnrolledAndOpen {
        id: exam.id,
        name: exam.name,
        instructions: exam.instructions,
        page_id: exam.page_id,
        courses: exam.courses,
        starts_at,
        ends_at: exam.ends_at,
        time_minutes: exam.time_minutes,
        page: Box::new(page),
        enrollment,
    }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_exams_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}/enrollment", web::get().to(enrollment))
        .route("/{id}/enroll", web::post().to(enroll))
        .route("/{id}", web::get().to(fetch_exam_for_user));
}
