mod conversions;
mod token;

use self::conversions::Convert;
use self::token::AuthToken;
use crate::{
    domain::authorization::{self, LoginToken},
    prelude::*,
    OAuthClient,
};
use headless_lms_utils::cache::Cache;
use mooc_langs_api as api;

/**
 * POST /api/v0/langs/login
 */
#[instrument(skip(pool, cache, app_conf))]
async fn login(
    pool: web::Data<PgPool>,
    client: web::Data<OAuthClient>,
    cache: web::Data<Cache>,
    login: web::Json<api::Login>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<api::Token>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let api::Login { email, password } = login.into_inner();
    let (user, auth_token) = if app_conf.test_mode {
        let user =
            authorization::authenticate_test_user(&mut conn, &email, &password, &app_conf).await?;
        let faux_token = LoginToken::new(
            oauth2::AccessToken::new(email.clone()),
            oauth2::basic::BasicTokenType::Bearer,
            oauth2::EmptyExtraTokenFields {},
        );
        (user, faux_token)
    } else {
        authorization::authenticate_moocfi_user(&mut conn, &client, email, password).await?
    };
    token::cache_user(&cache, &auth_token, &user).await;
    token.authorized_ok(web::Json(auth_token))
}

/**
 * GET /api/v0/langs/courses
 */
#[instrument(skip(pool))]
async fn courses(
    pool: web::Data<PgPool>,
    user: Option<AuthToken>,
) -> ControllerResult<web::Json<Vec<api::Course>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, user.map(|u| u.id), Res::AnyCourse).await?;

    let courses = models::courses::all_courses(&mut conn).await?.convert();
    token.authorized_ok(web::Json(courses))
}

/**
 * GET /api/v0/langs/courses/:id/course-instances
 */
#[instrument(skip(pool))]
async fn course_instances(
    pool: web::Data<PgPool>,
    course: web::Path<Uuid>,
    user: Option<AuthToken>,
) -> ControllerResult<web::Json<Vec<api::CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        user.map(|u| u.id),
        Res::Course(*course),
    )
    .await?;

    let courses = models::course_instances::get_course_instances_for_course(&mut conn, *course)
        .await?
        .convert();
    token.authorized_ok(web::Json(courses))
}

/**
 * GET /api/v0/langs/course-instances/:id/enrollment-background-questions
 */
#[instrument(skip(pool))]
async fn course_instance_enrollment_background_questions(
    pool: web::Data<PgPool>,
    course_instance: web::Path<Uuid>,
    user: Option<AuthToken>,
) -> ControllerResult<web::Json<Vec<api::CourseInstanceEnrollmentBackgroundQuestion>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        user.map(|u| u.id),
        Res::Course(*course_instance),
    )
    .await?;

    let course_instance =
        models::course_instances::get_course_instance(&mut conn, *course_instance).await?;
    let questions =
        models::course_background_questions::get_background_questions_for_course_instance(
            &mut conn,
            &course_instance,
        )
        .await?
        .convert();
    token.authorized_ok(web::Json(questions))
}

/**
 * POST /api/v0/langs/enroll
 */
#[instrument(skip(pool))]
async fn enroll(
    pool: web::Data<PgPool>,
    user: AuthToken,
    enrollment: web::Json<api::CourseInstanceEnrollment>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let enrollment = enrollment.into_inner();
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::CourseInstance(enrollment.course_instance_id),
    )
    .await?;

    let background_question_answers = enrollment.background_question_answers.convert();
    domain::course_instances::enroll(
        &mut conn,
        user.id,
        enrollment.course_instance_id,
        background_question_answers.as_slice(),
    )
    .await?;

    token.authorized_ok(HttpResponse::Ok().finish())
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/login", web::post().to(login))
        .route("/courses", web::get().to(courses))
        .route(
            "/courses/{id}/course-instances",
            web::get().to(course_instances),
        )
        .route(
            "/course-instances/{id}/enrollment-background-questions",
            web::get().to(course_instance_enrollment_background_questions),
        )
        .route("/enroll", web::post().to(enroll));
}
