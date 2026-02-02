use crate::prelude::*;
use anyhow::anyhow;
use headless_lms_utils::tmc::TmcClient;
use models::{
    course_instance_enrollments::CourseInstanceEnrollmentsInfo, courses::Course,
    exercise_reset_logs::ExerciseResetLog, research_forms::ResearchFormQuestionAnswer,
    user_research_consents::UserResearchConsent, users::User,
};
use secrecy::SecretString;

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

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailData {
    pub email: String,
    pub language: String,
}

#[instrument(skip(pool))]
pub async fn send_reset_password_email(
    pool: web::Data<PgPool>,
    payload: web::Json<EmailData>,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let email = &payload.email.trim().to_lowercase();
    let language = &payload.language;

    let reset_template = models::email_templates::get_generic_email_template_by_type_and_language(
        &mut conn,
        models::email_templates::EmailTemplateType::ResetPasswordEmail,
        language,
    )
    .await
    .map_err(|_e| {
        anyhow::anyhow!(
            "Password reset email template not configured. Missing template 'reset-password-email' for language '{}'",
            language
        )
    })?;

    let user = match models::users::get_by_email(&mut conn, email).await {
        Ok(user) => Some(user),
        Err(_) => {
            // If the user does not exist in the courses.mooc.fi database,
            // check TMC for the user and create a new user in courses.mooc.fi if found.
            if let Ok(tmc_user) = tmc_client.get_user_from_tmc_with_email(email.clone()).await {
                Some(
                    models::users::insert_with_upstream_id_and_moocfi_id(
                        &mut conn,
                        &tmc_user.email,
                        tmc_user.first_name.as_deref(),
                        tmc_user.last_name.as_deref(),
                        tmc_user.upstream_id,
                        tmc_user.id,
                    )
                    .await?,
                )
            } else {
                None
            }
        }
    };

    if let Some(user) = user {
        let token = Uuid::new_v4();

        let _password_token =
            models::user_passwords::insert_password_reset_token(&mut conn, user.id, token).await?;

        let _ =
            models::email_deliveries::insert_email_delivery(&mut conn, user.id, reset_template.id)
                .await?;
    }

    token.authorized_ok(web::Json(true))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResetPasswordTokenPayload {
    pub token: String,
}

#[instrument(skip(pool))]
pub async fn reset_password_token_status(
    pool: web::Data<PgPool>,
    payload: web::Json<ResetPasswordTokenPayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let password_token = match Uuid::parse_str(&payload.token) {
        Ok(u) => u,
        Err(_) => return token.authorized_ok(web::Json(false)),
    };

    let res =
        models::user_passwords::is_reset_password_token_valid(&mut conn, &password_token).await?;

    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ResetPasswordData {
    pub token: String,
    pub new_password: String,
}

#[instrument(skip(pool))]
pub async fn reset_user_password(
    pool: web::Data<PgPool>,
    payload: web::Json<ResetPasswordData>,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let token_uuid = Uuid::parse_str(&payload.token)?;
    let password_hash = models::user_passwords::hash_password(&SecretString::new(
        payload.new_password.clone().into(),
    ))
    .map_err(|e| anyhow!("Failed to hash password: {:?}", e))?;

    let res = models::user_passwords::change_user_password_with_password_reset_token(
        &mut conn,
        token_uuid,
        &password_hash,
        &tmc_client,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChangePasswordData {
    pub old_password: String,
    pub new_password: String,
}

#[instrument(skip(pool))]
pub async fn change_user_password(
    pool: web::Data<PgPool>,
    payload: web::Json<ChangePasswordData>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let password_hash = models::user_passwords::hash_password(&SecretString::new(
        payload.new_password.clone().into(),
    ))
    .map_err(|e| anyhow!("Failed to hash password: {:?}", e))?;
    let old_password = SecretString::new(payload.old_password.clone().into());

    let res = models::user_passwords::change_user_password_with_old_password(
        &mut conn,
        user.id,
        &old_password,
        &password_hash,
    )
    .await?;

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
    .route(
        "/user-research-consents",
        web::post().to(post_user_consents),
    )
    .route(
        "/send-reset-password-email",
        web::post().to(send_reset_password_email),
    )
    .route("/{user_id}", web::get().to(get_user))
    .route(
        "/{user_id}/course-instance-enrollments",
        web::get().to(get_course_instance_enrollments_for_user),
    )
    .route(
        "/{user_id}/user-reset-exercise-logs",
        web::get().to(get_user_reset_exercise_logs),
    )
    .route(
        "/reset-password-token-status",
        web::post().to(reset_password_token_status),
    )
    .route("/reset-password", web::post().to(reset_user_password))
    .route("/change-password", web::post().to(change_user_password));
}
