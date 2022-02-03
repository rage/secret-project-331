use chrono::{DateTime, Duration, Utc};
use models::{
    exams::{self, ExamEnrollment},
    pages::{self, Page},
};

use crate::controllers::prelude::*;

/**
GET /api/v0/course-material/exams/:id/enrollment
*/
#[cfg_attr(doc, generated_doc)]
pub async fn enrollment(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<ExamEnrollment>>> {
    let mut conn = pool.acquire().await?;
    let enrollment = exams::get_enrollment(&mut conn, *exam_id, user.id).await?;
    Ok(web::Json(enrollment))
}

/**
POST /api/v0/course-material/exams/:id/enroll
*/
#[cfg_attr(doc, generated_doc)]
pub async fn enroll(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let exam = exams::get(&mut conn, *exam_id).await?;

    // check that the exam is not over
    let now = Utc::now();
    if let Some(ends_at) = exam.ends_at {
        if ends_at < now {
            return Err(ControllerError::Forbidden("Exam is over".to_string()));
        }
    }

    if let Some(starts_at) = exam.starts_at {
        if now > starts_at {
            exams::enroll(&mut conn, *exam_id, user.id).await?;
            return Ok(web::Json(()));
        }
    }

    // no start time defined or it's still upcoming
    Err(ControllerError::Forbidden(
        "Exam has not started yet".to_string(),
    ))
}

#[derive(Debug, Serialize, TS)]
pub struct ExamData {
    pub id: Uuid,
    pub name: String,
    pub instructions: String,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub time_minutes: i32,
    pub enrollment_data: ExamEnrollmentData,
}

#[derive(Debug, Serialize, TS)]
#[serde(tag = "tag")]
pub enum ExamEnrollmentData {
    EnrolledAndStarted {
        page_id: Uuid,
        page: Box<Page>,
        enrollment: ExamEnrollment,
    },
    NotEnrolled,
    NotYetStarted,
    StudentTimeUp,
}

/**
GET /api/v0/course-material/exams/:id
*/
#[cfg_attr(doc, generated_doc)]
pub async fn fetch_exam_for_user(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExamData>> {
    let mut conn = pool.acquire().await?;
    let exam = exams::get(&mut conn, *exam_id).await?;

    let starts_at = if let Some(starts_at) = exam.starts_at {
        starts_at
    } else {
        return Err(ControllerError::Forbidden(
            "Cannot fetch exam that has no start time".to_string(),
        ));
    };
    let ends_at = if let Some(ends_at) = exam.ends_at {
        ends_at
    } else {
        return Err(ControllerError::Forbidden(
            "Cannot fetch exam that has no end time".to_string(),
        ));
    };

    if starts_at > Utc::now() {
        // exam has not started yet
        return Ok(web::Json(ExamData {
            id: exam.id,
            name: exam.name,
            instructions: exam.instructions,
            starts_at,
            ends_at,
            time_minutes: exam.time_minutes,
            enrollment_data: ExamEnrollmentData::NotYetStarted,
        }));
    }

    let enrollment =
        if let Some(enrollment) = exams::get_enrollment(&mut conn, *exam_id, user.id).await? {
            // user has started the exam
            if Utc::now() < ends_at
                && Utc::now() > enrollment.started_at + Duration::minutes(exam.time_minutes.into())
            {
                // exam is still open but the student's time has expired
                return Ok(web::Json(ExamData {
                    id: exam.id,
                    name: exam.name,
                    instructions: exam.instructions,
                    starts_at,
                    ends_at,
                    time_minutes: exam.time_minutes,
                    enrollment_data: ExamEnrollmentData::StudentTimeUp,
                }));
            }
            enrollment
        } else {
            // user has not started the exam
            return Ok(web::Json(ExamData {
                id: exam.id,
                name: exam.name,
                instructions: exam.instructions,
                starts_at,
                ends_at,
                time_minutes: exam.time_minutes,
                enrollment_data: ExamEnrollmentData::NotEnrolled,
            }));
        };

    let page = pages::get_page(&mut conn, exam.page_id).await?;

    Ok(web::Json(ExamData {
        id: exam.id,
        name: exam.name,
        instructions: exam.instructions,
        starts_at,
        ends_at,
        time_minutes: exam.time_minutes,
        enrollment_data: ExamEnrollmentData::EnrolledAndStarted {
            page_id: exam.page_id,
            page: Box::new(page),
            enrollment,
        },
    }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}/enrollment", web::get().to(enrollment))
        .route("/{id}/enroll", web::post().to(enroll))
        .route("/{id}", web::get().to(fetch_exam_for_user));
}
