use crate::{
    controllers::{ControllerError, ControllerResult},
    domain::authorization::AuthUser,
    models::{
        courses::Course,
        exams::{self, ExamEnrollment},
        pages::{self, Page},
    },
};
use actix_web::web::{self, Json, ServiceConfig};
use chrono::{DateTime, Utc};
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

    let exam_id = id.into_inner();
    let exam = exams::get(&mut conn, exam_id).await?;

    // check that the exam is not over
    let now = dbg!(Utc::now());
    if let Some(ends_at) = dbg!(exam.ends_at) {
        if ends_at < now {
            return Err(ControllerError::Forbidden("Exam is over".to_string()));
        }
    }

    if let Some(starts_at) = exam.starts_at {
        if now > starts_at {
            exams::enroll(&mut conn, exam_id, user.id).await?;
            return Ok(Json(()));
        }
    }

    // no start time defined or it's still upcoming
    Err(ControllerError::Forbidden(
        "Exam has not started yet".to_string(),
    ))
}

#[derive(Debug, Serialize, TS)]
#[serde(tag = "tag")]
pub enum ExamData {
    EnrolledAndStarted {
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
    NotEnrolled {
        id: Uuid,
        name: String,
        instructions: String,
        starts_at: Option<DateTime<Utc>>,
        ends_at: Option<DateTime<Utc>>,
        time_minutes: i32,
    },
    NotYetStarted {
        id: Uuid,
        name: String,
        instructions: String,
        starts_at: Option<DateTime<Utc>>,
        ends_at: Option<DateTime<Utc>>,
        time_minutes: i32,
    },
}

pub async fn fetch_exam_for_user(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<ExamData>> {
    let mut conn = pool.acquire().await?;
    let id = id.into_inner();
    let exam = exams::get(&mut conn, id).await?;

    let starts_at = match exam.starts_at {
        Some(starts_at) => {
            if starts_at > Utc::now() {
                // exam has not started yet
                return Ok(Json(ExamData::NotYetStarted {
                    id: exam.id,
                    name: exam.name,
                    instructions: exam.instructions,
                    starts_at: exam.starts_at,
                    ends_at: exam.ends_at,
                    time_minutes: exam.time_minutes,
                }));
            }
            starts_at
        }
        None => {
            // exam has no start time yet
            return Ok(Json(ExamData::NotYetStarted {
                id: exam.id,
                name: exam.name,
                instructions: exam.instructions,
                starts_at: exam.starts_at,
                ends_at: exam.ends_at,
                time_minutes: exam.time_minutes,
            }));
        }
    };

    let enrollment = if let Some(enrollment) = exams::get_enrollment(&mut conn, id, user.id).await?
    {
        // user has started the exam
        enrollment
    } else {
        // user has not started the exam
        return Ok(Json(ExamData::NotEnrolled {
            id: exam.id,
            name: exam.name,
            instructions: exam.instructions,
            starts_at: exam.starts_at,
            ends_at: exam.ends_at,
            time_minutes: exam.time_minutes,
        }));
    };

    let page = pages::get_page(&mut conn, exam.page_id).await?;

    Ok(Json(ExamData::EnrolledAndStarted {
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
