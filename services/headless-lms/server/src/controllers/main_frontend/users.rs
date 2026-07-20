use crate::prelude::*;
use anyhow::anyhow;
use headless_lms_utils::services::tmc::TmcClient;
use models::{
    course_instance_enrollments::CourseEnrollmentsInfo, courses::Course,
    exercise_reset_logs::ExerciseResetLog, exercise_slide_submissions::UserCourseSubmissionTime,
    research_forms::ResearchFormQuestionAnswer, roles::Role,
    suspected_cheaters::UserSuspectedCheaterInfo, user_research_consents::UserResearchConsent,
    users::User,
};
use secrecy::{ExposeSecret, SecretString};
use utoipa::{OpenApi, ToSchema};

#[derive(OpenApi)]
#[openapi(paths(
    get_user,
    get_course_enrollments_for_user,
    get_user_suspected_cheaters,
    get_user_roles,
    post_user_consents,
    get_research_consent_by_user_id,
    get_all_research_form_answers_with_user_id,
    get_my_courses,
    get_user_reset_exercise_logs,
    get_user_course_submission_times,
    send_reset_password_email,
    reset_password_token_status,
    reset_user_password,
    change_user_password
))]
pub(crate) struct MainFrontendUsersApiDoc;

/**
GET `/api/v0/main-frontend/users/:id`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{user_id}",
    operation_id = "getUser",
    tag = "users",
    params(
        ("user_id" = Uuid, Path, description = "User id")
    ),
    responses(
        (status = 200, description = "User", body = User)
    )
)]
pub async fn get_user(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let user = models::users::get_by_id(&mut conn, *user_id).await?;

    // Same scope as the sibling user-details endpoints.
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    token.authorized_ok(web::Json(user))
}

/**
GET `/api/v0/main-frontend/users/:id/course-enrollments`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{user_id}/course-enrollments",
    operation_id = "getUserCourseEnrollments",
    tag = "users",
    params(
        ("user_id" = Uuid, Path, description = "User id")
    ),
    responses(
        (status = 200, description = "User course enrollments", body = CourseEnrollmentsInfo)
    )
)]
pub async fn get_course_enrollments_for_user(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<CourseEnrollmentsInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::course_instance_enrollments::get_course_enrollments_info_for_user(
        &mut conn, *user_id,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]

pub struct ConsentData {
    pub consent: bool,
}

/**
POST `/api/v0/main-frontend/users/user-research-consents` - Adds a research consent for a student.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/user-research-consents",
    operation_id = "createUserResearchConsent",
    tag = "users",
    request_body = ConsentData,
    responses(
        (status = 200, description = "User research consent", body = UserResearchConsent)
    )
)]
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
#[utoipa::path(
    get,
    path = "/get-user-research-consent",
    operation_id = "getUserResearchConsent",
    tag = "users",
    responses(
        (status = 200, description = "User research consent", body = UserResearchConsent)
    )
)]
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
#[utoipa::path(
    get,
    path = "/user-research-form-question-answers",
    operation_id = "getUserResearchFormQuestionAnswers",
    tag = "users",
    responses(
        (status = 200, description = "Research form answers for user", body = [ResearchFormQuestionAnswer])
    )
)]
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
#[utoipa::path(
    get,
    path = "/my-courses",
    operation_id = "getMyCourses",
    tag = "users",
    responses(
        (status = 200, description = "Courses for authenticated user", body = [Course])
    )
)]
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
#[utoipa::path(
    get,
    path = "/{user_id}/user-reset-exercise-logs",
    operation_id = "getUserResetExerciseLogs",
    tag = "users",
    params(
        ("user_id" = Uuid, Path, description = "User id")
    ),
    responses(
        (status = 200, description = "User reset exercise logs", body = [ExerciseResetLog])
    )
)]
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

/**
GET `/api/v0/main-frontend/users/:id/courses/:course_id/submission-times` - A user's exercise
submission times in a course, each tagged with its exercise and module. Teacher/admin (global) view.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{user_id}/courses/{course_id}/submission-times",
    operation_id = "getUserCourseSubmissionTimes",
    tag = "users",
    params(
        ("user_id" = Uuid, Path, description = "User id"),
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "User course submission times", body = [UserCourseSubmissionTime])
    )
)]
pub async fn get_user_course_submission_times(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<Vec<UserCourseSubmissionTime>>> {
    let (user_id, course_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::exercise_slide_submissions::get_user_course_submission_times(
        &mut conn, user_id, course_id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/users/:id/suspected-cheaters` - Cross-course suspected-cheater records for
a user, each paired with the course's applicable duration threshold. Teacher/admin (global) view;
read-only (confirm/dismiss happen on the per-course cheaters page).
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{user_id}/suspected-cheaters",
    operation_id = "getUserSuspectedCheaters",
    tag = "users",
    params(
        ("user_id" = Uuid, Path, description = "User id")
    ),
    responses(
        (status = 200, description = "User suspected-cheater records across courses", body = [UserSuspectedCheaterInfo])
    )
)]
pub async fn get_user_suspected_cheaters(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<Vec<UserSuspectedCheaterInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::suspected_cheaters::get_suspected_cheater_info_for_user(&mut conn, *user_id)
        .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/users/:id/roles` - All roles held by a user, across scopes. Teacher/admin
(global) view; used to label the account (e.g. staff/teacher) on the user-details page.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{user_id}/roles",
    operation_id = "getUserRoles",
    tag = "users",
    params(
        ("user_id" = Uuid, Path, description = "User id")
    ),
    responses(
        (status = 200, description = "User roles across scopes", body = [Role])
    )
)]
pub async fn get_user_roles(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<Vec<Role>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(auth_user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::roles::get_roles(&mut conn, *user_id).await?;

    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]

pub struct EmailData {
    pub email: String,
    pub language: String,
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/send-reset-password-email",
    operation_id = "sendResetPasswordEmail",
    tag = "users",
    request_body = EmailData,
    responses(
        (status = 200, description = "Reset password email accepted", body = bool)
    )
)]
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
                // The account may already exist under a different email but the same upstream_id
                // (e.g. the user changed their email in TMC). Reuse that row instead of inserting,
                // which would violate the users_upstream_id_active_uniq_idx unique index.
                match models::users::find_by_upstream_id(&mut conn, tmc_user.upstream_id).await? {
                    Some(existing_user) => Some(existing_user),
                    None => Some(
                        models::users::insert_with_upstream_id_and_moocfi_id(
                            &mut conn,
                            &tmc_user.email,
                            tmc_user.first_name.as_deref(),
                            tmc_user.last_name.as_deref(),
                            tmc_user.upstream_id,
                            tmc_user.id,
                        )
                        .await?,
                    ),
                }
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

#[derive(Debug, Deserialize, ToSchema)]
pub struct ResetPasswordTokenPayload {
    #[schema(value_type = String)]
    pub token: SecretString,
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/reset-password-token-status",
    operation_id = "getResetPasswordTokenStatus",
    tag = "users",
    request_body = ResetPasswordTokenPayload,
    responses(
        (status = 200, description = "Reset password token validity", body = bool)
    )
)]
pub async fn reset_password_token_status(
    pool: web::Data<PgPool>,
    payload: web::Json<ResetPasswordTokenPayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let password_token = match Uuid::parse_str(payload.token.expose_secret()) {
        Ok(u) => u,
        Err(_) => return token.authorized_ok(web::Json(false)),
    };

    let res =
        models::user_passwords::is_reset_password_token_valid(&mut conn, &password_token).await?;

    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ResetPasswordData {
    #[schema(value_type = String)]
    pub token: SecretString,
    #[schema(value_type = String)]
    pub new_password: SecretString,
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/reset-password",
    operation_id = "resetUserPassword",
    tag = "users",
    request_body = ResetPasswordData,
    responses(
        (status = 200, description = "Password reset status", body = bool)
    )
)]
pub async fn reset_user_password(
    pool: web::Data<PgPool>,
    payload: web::Json<ResetPasswordData>,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let token_uuid = Uuid::parse_str(payload.token.expose_secret())?;
    let password_hash = models::user_passwords::hash_password(&payload.new_password)
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

#[derive(Debug, Deserialize, ToSchema)]
pub struct ChangePasswordData {
    #[schema(value_type = String)]
    pub old_password: SecretString,
    #[schema(value_type = String)]
    pub new_password: SecretString,
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/change-password",
    operation_id = "changeUserPassword",
    tag = "users",
    request_body = ChangePasswordData,
    responses(
        (status = 200, description = "Password change status", body = bool)
    )
)]
pub async fn change_user_password(
    pool: web::Data<PgPool>,
    payload: web::Json<ChangePasswordData>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let password_hash = models::user_passwords::hash_password(&payload.new_password)
        .map_err(|e| anyhow!("Failed to hash password: {:?}", e))?;

    let res = models::user_passwords::change_user_password_with_old_password(
        &mut conn,
        user.id,
        &payload.old_password,
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
        "/{user_id}/course-enrollments",
        web::get().to(get_course_enrollments_for_user),
    )
    .route(
        "/{user_id}/user-reset-exercise-logs",
        web::get().to(get_user_reset_exercise_logs),
    )
    .route(
        "/{user_id}/courses/{course_id}/submission-times",
        web::get().to(get_user_course_submission_times),
    )
    .route(
        "/{user_id}/suspected-cheaters",
        web::get().to(get_user_suspected_cheaters),
    )
    .route("/{user_id}/roles", web::get().to(get_user_roles))
    .route(
        "/reset-password-token-status",
        web::post().to(reset_password_token_status),
    )
    .route("/reset-password", web::post().to(reset_user_password))
    .route("/change-password", web::post().to(change_user_password));
}
