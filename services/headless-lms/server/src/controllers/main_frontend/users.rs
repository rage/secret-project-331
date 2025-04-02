use crate::prelude::*;
use models::{
    course_instance_enrollments::CourseInstanceEnrollmentsInfo, courses::Course,
    exercise_reset_logs::ExerciseResetLog, research_forms::ResearchFormQuestionAnswer,
    user_research_consents::UserResearchConsent, users::User,
};

/**
GET `/api/v0/main-frontend/users/:id`
*/
#[instrument(skip(pool))]
pub async fn get_user(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let user = models::users::get_by_id(&mut conn, *user_id).await?;

    let token = authorize(&mut conn, Act::Teach, Some(*user_id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(user))
}

/**
GET `/api/v0/main-frontend/users/:id/course-instance-enrollments`
*/
#[instrument(skip(pool))]
pub async fn get_course_instance_enrollments_for_user(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<CourseInstanceEnrollmentsInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let mut res =
        models::course_instance_enrollments::get_course_instance_enrollments_info_for_user(
            &mut conn, *user_id,
        )
        .await?;

    res.course_instance_enrollments
        .sort_by(|a, b| a.created_at.cmp(&b.created_at));

    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ConsentData {
    pub consent: bool,
}

/**
POST `/api/v0/main-frontend/users/user-research-consents` - Adds a research consent for a student.
*/
#[instrument(skip(pool))]
pub async fn post_user_consents(
    payload: web::Json<ConsentData>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<UserResearchConsent>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let res = models::user_research_consents::upsert(
        &mut conn,
        PKeyPolicy::Generate,
        user.id,
        payload.consent,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/users/get-user-research-consent` - Gets users research consent.
*/
#[instrument(skip(pool))]
pub async fn get_research_consent_by_user_id(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<UserResearchConsent>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let res =
        models::user_research_consents::get_research_consent_by_user_id(&mut conn, user.id).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/users/get-user-research-consents` - Gets all users research consents for a course specific research form.
*/
#[instrument(skip(pool))]
async fn get_all_research_form_answers_with_user_id(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<ResearchFormQuestionAnswer>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let res =
        models::research_forms::get_all_research_form_answers_with_user_id(&mut conn, user.id)
            .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/users/my-courses` - Gets all the courses the user has either started or gotten a permission to.
*/
#[instrument(skip(pool))]
async fn get_my_courses(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let courses_enrolled_to =
        models::courses::all_courses_user_enrolled_to(&mut conn, user.id).await?;

    let courses_with_roles =
        models::courses::all_courses_with_roles_for_user(&mut conn, user.id).await?;

    let combined = courses_enrolled_to
        .clone()
        .into_iter()
        .chain(
            courses_with_roles
                .into_iter()
                .filter(|c| !courses_enrolled_to.iter().any(|c2| c.id == c2.id)),
        )
        .collect();

    token.authorized_ok(web::Json(combined))
}

/**
GET `/api/v0/main-frontend/users/:id/user-reset-exercise-logs` - Get all logs of reset exercises for a user
*/
#[instrument(skip(pool))]
pub async fn get_user_reset_exercise_logs(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseResetLog>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res =
        models::exercise_reset_logs::get_exercise_reset_logs_for_user(&mut conn, *user_id).await?;

    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/user-research-form-question-answers",
        web::get().to(get_all_research_form_answers_with_user_id),
    )
    .route("/my-courses", web::get().to(get_my_courses))
    .route(
        "/get-user-research-consent",
        web::get().to(get_research_consent_by_user_id),
    )
    .route("/{user_id}", web::get().to(get_user))
    .route(
        "/{user_id}/course-instance-enrollments",
        web::get().to(get_course_instance_enrollments_for_user),
    )
    .route(
        "/user-research-consents",
        web::post().to(post_user_consents),
    )
    .route(
        "/{user_id}/user-reset-exercise-logs",
        web::get().to(get_user_reset_exercise_logs),
    );
}
