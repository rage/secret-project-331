use chrono::{DateTime, Duration, Utc};
use models::{
    exams::{self, ExamEnrollment},
    pages::{self, Page},
};

use crate::prelude::*;

/**
GET /api/v0/course-material/exams/:id/enrollment
*/
#[instrument(skip(pool))]
pub async fn enrollment(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<ExamEnrollment>>> {
    let mut conn = pool.acquire().await?;
    let enrollment = exams::get_enrollment(&mut conn, *exam_id, user.id).await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;
    token.authorized_ok(web::Json(enrollment))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct IsTeacherTesting {
    pub is_teacher_testing: bool,
}
/**
POST /api/v0/course-material/exams/:id/enroll
*/
#[instrument(skip(pool))]
pub async fn enroll(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
    payload: web::Json<IsTeacherTesting>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let exam = exams::get(&mut conn, *exam_id).await?;

    // check that the exam is not over
    let now = Utc::now();
    if exam.ended_at_or(now, false) {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Exam is over".to_string(),
            None,
        ));
    }

    // enroll if teacher is testing regardless of exams starting time
    if payload.is_teacher_testing {
        exams::enroll(&mut conn, *exam_id, user.id, payload.is_teacher_testing).await?;
        let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;
        return token.authorized_ok(web::Json(()));
    }
    if exam.started_at_or(now, false) {
        // This check should probably be handled in the authorize function but I'm not sure of
        // the proper action type.
        let can_start =
            models::library::progressing::user_can_take_exam(&mut conn, *exam_id, user.id).await?;
        if !can_start {
            return Err(ControllerError::new(
                ControllerErrorType::Forbidden,
                "User is not allowed to enroll to the exam.".to_string(),
                None,
            ));
        }
        exams::enroll(&mut conn, *exam_id, user.id, payload.is_teacher_testing).await?;
        let token = skip_authorize();
        return token.authorized_ok(web::Json(()));
    }

    // no start time defined or it's still upcoming
    Err(ControllerError::new(
        ControllerErrorType::Forbidden,
        "Exam has not started yet".to_string(),
        None,
    ))
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExamData {
    pub id: Uuid,
    pub name: String,
    pub instructions: serde_json::Value,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub ended: bool,
    pub time_minutes: i32,
    pub enrollment_data: ExamEnrollmentData,
    pub language: String,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(tag = "tag")]
pub enum ExamEnrollmentData {
    /// The student has enrolled to the exam and started it.
    EnrolledAndStarted {
        page_id: Uuid,
        page: Box<Page>,
        enrollment: ExamEnrollment,
    },
    /// The student has not enrolled to the exam yet. However, the the exam is open.
    NotEnrolled { can_enroll: bool },
    /// The exam's start time is in the future, no one can enroll yet.
    NotYetStarted,
    /// The exam is still open but the student has run out of time.
    StudentTimeUp,
}

/**
GET /api/v0/course-material/exams/:id
*/
#[instrument(skip(pool))]
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
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Cannot fetch exam that has no start time".to_string(),
            None,
        ));
    };
    let ends_at = if let Some(ends_at) = exam.ends_at {
        ends_at
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Cannot fetch exam that has no end time".to_string(),
            None,
        ));
    };

    let ended = ends_at < Utc::now();

    if starts_at > Utc::now() {
        // exam has not started yet
        let token = authorize(&mut conn, Act::View, Some(user.id), Res::Exam(*exam_id)).await?;
        return token.authorized_ok(web::Json(ExamData {
            id: exam.id,
            name: exam.name,
            instructions: exam.instructions,
            starts_at,
            ends_at,
            ended,
            time_minutes: exam.time_minutes,
            enrollment_data: ExamEnrollmentData::NotYetStarted,
            language: exam.language,
        }));
    }

    let enrollment = if let Some(enrollment) =
        exams::get_enrollment(&mut conn, *exam_id, user.id).await?
    {
        // user has started the exam
        if Utc::now() < ends_at
            && Utc::now() > enrollment.started_at + Duration::minutes(exam.time_minutes.into())
        {
            // exam is still open but the student's time has expired
            let token = authorize(&mut conn, Act::View, Some(user.id), Res::Exam(*exam_id)).await?;
            return token.authorized_ok(web::Json(ExamData {
                id: exam.id,
                name: exam.name,
                instructions: exam.instructions,
                starts_at,
                ends_at,
                ended,
                time_minutes: exam.time_minutes,
                enrollment_data: ExamEnrollmentData::StudentTimeUp,
                language: exam.language,
            }));
        }
        enrollment
    } else {
        // user has not started the exam
        let token = authorize(&mut conn, Act::View, Some(user.id), Res::Exam(*exam_id)).await?;
        let can_enroll =
            models::library::progressing::user_can_take_exam(&mut conn, *exam_id, user.id).await?;
        return token.authorized_ok(web::Json(ExamData {
            id: exam.id,
            name: exam.name,
            instructions: exam.instructions,
            starts_at,
            ends_at,
            ended,
            time_minutes: exam.time_minutes,
            enrollment_data: ExamEnrollmentData::NotEnrolled { can_enroll },
            language: exam.language,
        }));
    };

    let page = pages::get_page(&mut conn, exam.page_id).await?;

    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Exam(*exam_id)).await?;
    token.authorized_ok(web::Json(ExamData {
        id: exam.id,
        name: exam.name,
        instructions: exam.instructions,
        starts_at,
        ends_at,
        ended,
        time_minutes: exam.time_minutes,
        enrollment_data: ExamEnrollmentData::EnrolledAndStarted {
            page_id: exam.page_id,
            page: Box::new(page),
            enrollment,
        },
        language: exam.language,
    }))
}

/**
GET /api/v0/course-material/exams/:id/fetch-exam-for-testing

Fetches an exam for testing.
*/
#[instrument(skip(pool))]
pub async fn fetch_exam_for_testing(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExamData>> {
    let mut conn = pool.acquire().await?;
    let exam = exams::get(&mut conn, *exam_id).await?;

    let starts_at = Utc::now();
    let ends_at = if let Some(ends_at) = exam.ends_at {
        ends_at
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Cannot fetch exam that has no end time".to_string(),
            None,
        ));
    };
    let ended = ends_at < Utc::now();

    let enrollment = if let Some(enrollment) =
        exams::get_enrollment(&mut conn, *exam_id, user.id).await?
    {
        enrollment
    } else {
        // user has not started the exam
        let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;
        let can_enroll =
            models::library::progressing::user_can_take_exam(&mut conn, *exam_id, user.id).await?;
        return token.authorized_ok(web::Json(ExamData {
            id: exam.id,
            name: exam.name,
            instructions: exam.instructions,
            starts_at,
            ends_at,
            ended,
            time_minutes: exam.time_minutes,
            enrollment_data: ExamEnrollmentData::NotEnrolled { can_enroll },
            language: exam.language,
        }));
    };

    let page = pages::get_page(&mut conn, exam.page_id).await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;
    token.authorized_ok(web::Json(ExamData {
        id: exam.id,
        name: exam.name,
        instructions: exam.instructions,
        starts_at,
        ends_at,
        ended,
        time_minutes: exam.time_minutes,
        enrollment_data: ExamEnrollmentData::EnrolledAndStarted {
            page_id: exam.page_id,
            page: Box::new(page),
            enrollment,
        },
        language: exam.language,
    }))
}

/**
GET /api/v0/course-material/exams/:id/reset-exam-progress

Used for testing an exam, resets exercise submissions and restarts the exam time.
*/
#[instrument(skip(pool))]
pub async fn reset_exam_progress(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;

    let started_at = Utc::now();
    exams::update_exam_start_time(&mut conn, *exam_id, user.id, started_at).await?;

    models::exercise_slide_submissions::delete_exercise_submissions_with_exam_id_and_user_id(
        &mut conn, *exam_id, user.id,
    )
    .await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;
    token.authorized_ok(web::Json(()))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ShowExerciseAnswers {
    pub show_exercise_answers: bool,
}
/**
GET /api/v0/course-material/exams/:id/update-show-exercise-answers

Used for testing an exam, updates wheter exercise answers are shown.
*/
#[instrument(skip(pool))]
pub async fn update_show_exercise_answers(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
    payload: web::Json<ShowExerciseAnswers>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let show_answers = payload.show_exercise_answers;
    exams::update_show_exercise_answers(&mut conn, *exam_id, user.id, show_answers).await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;
    token.authorized_ok(web::Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}/enrollment", web::get().to(enrollment))
        .route("/{id}/enroll", web::post().to(enroll))
        .route("/{id}", web::get().to(fetch_exam_for_user))
        .route(
            "/testexam/{id}/fetch-exam-for-testing",
            web::get().to(fetch_exam_for_testing),
        )
        .route(
            "/testexam/{id}/update-show-exercise-answers",
            web::post().to(update_show_exercise_answers),
        )
        .route(
            "/testexam/{id}/reset-exam-progress",
            web::post().to(reset_exam_progress),
        );
}
