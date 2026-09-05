use crate::prelude::*;
use anyhow::anyhow;
use headless_lms_utils::services::tmc::TmcClient;
use models::{
    course_instance_enrollments::CourseEnrollmentsInfo, courses::Course,
    exercise_reset_logs::ExerciseResetLog, exercise_slide_submissions::UserCourseSubmissionTime,
    generated_certificates::UserCertificate, research_forms::ResearchFormQuestionAnswer,
    roles::Role, suspected_cheaters::UserSuspectedCheaterInfo,
    user_research_consents::UserResearchConsent, users::User,
};
use secrecy::{ExposeSecret, SecretString};
use std::collections::{HashMap, HashSet};
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
    hide_course_from_my_courses,
    unhide_course_from_my_courses,
    get_my_studies,
    get_my_certificates,
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyCourse {
    #[serde(flatten)]
    pub course: Course,
    /// Whether the course can be hidden from the "My courses" list. False for courses the user has
    /// not enrolled in or has a role in.
    pub can_hide: bool,
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
        (status = 200, description = "Courses for authenticated user", body = [MyCourse])
    )
)]
async fn get_my_courses(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<MyCourse>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let courses_enrolled_to =
        models::courses::all_courses_user_enrolled_to(&mut conn, user.id).await?;

    let courses_with_roles =
        models::courses::all_courses_with_roles_for_user(&mut conn, user.id).await?;

    let settings = models::user_course_settings::get_all_by_user_id(&mut conn, user.id).await?;
    let hidden_course_ids: HashSet<Uuid> = settings
        .iter()
        .filter(|s| s.hidden)
        .map(|s| s.current_course_id)
        .collect();
    let enrolled_course_ids: HashSet<Uuid> = settings.iter().map(|s| s.current_course_id).collect();
    let role_course_ids: HashSet<Uuid> = courses_with_roles.iter().map(|c| c.id).collect();

    let mut combined: Vec<Course> = courses_enrolled_to
        .clone()
        .into_iter()
        .chain(
            courses_with_roles
                .into_iter()
                .filter(|c| !courses_enrolled_to.iter().any(|c2| c.id == c2.id)),
        )
        // A course the user has a role in always stays visible and can't be hidden.
        .filter(|c| !hidden_course_ids.contains(&c.id) || role_course_ids.contains(&c.id))
        .collect();

    // Stable ordering so the "My courses" grid does not reshuffle between requests.
    combined.sort_by(|a, b| a.name.cmp(&b.name).then(a.id.cmp(&b.id)));

    let my_courses = combined
        .into_iter()
        .map(|course| {
            let can_hide =
                enrolled_course_ids.contains(&course.id) && !role_course_ids.contains(&course.id);
            MyCourse { course, can_hide }
        })
        .collect();

    token.authorized_ok(web::Json(my_courses))
}

/**
POST `/api/v0/main-frontend/users/my-courses/:course_id/hide` - Hides a course from the
authenticated user's "My courses" list.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/my-courses/{course_id}/hide",
    operation_id = "hideCourseFromMyCourses",
    tag = "users",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course hidden from the user's my-courses list")
    )
)]
async fn hide_course_from_my_courses(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    // A course the user has a role in can't be hidden.
    let has_role = models::courses::all_courses_with_roles_for_user(&mut conn, user.id)
        .await?
        .iter()
        .any(|c| c.id == *course_id);
    if !has_role {
        models::user_course_settings::set_hidden(&mut conn, user.id, *course_id, true).await?;
    }

    token.authorized_ok(web::Json(()))
}

/**
POST `/api/v0/main-frontend/users/my-courses/:course_id/unhide` - Puts a previously hidden course
back into the authenticated user's "My courses" list.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/my-courses/{course_id}/unhide",
    operation_id = "unhideCourseFromMyCourses",
    tag = "users",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course restored to the user's my-courses list")
    )
)]
async fn unhide_course_from_my_courses(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    models::user_course_settings::set_hidden(&mut conn, user.id, *course_id, false).await?;

    token.authorized_ok(web::Json(()))
}

/// A course module as the student's own profile shows it, with their best visible completion.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyStudiesCourseModule {
    pub course_module_id: Uuid,
    /// `None` for the course's default module; the frontend labels those with the course name.
    pub name: Option<String>,
    pub order_number: i32,
    pub ects_credits: Option<f32>,
    pub uh_course_code: Option<String>,
    pub supports_credit_registration: bool,
    /// Exercise points the student has in the module, rounded to two decimals. Not ECTS credits.
    pub score_given: f32,
    /// Exercise points the module offers. `None` when it has no exercises.
    pub score_maximum: Option<u32>,
    /// Exercise points an automatic completion requires. `None` when the module is completed
    /// manually or sets no point threshold.
    pub score_required: Option<i32>,
    /// `None` when no completion may be shown to the student. May be a failed one, so check `passed`.
    pub completion: Option<MyStudiesCompletion>,
}

/// A completion as the student may see it. `needs_to_be_reviewed` ones are excluded so a student
/// cannot infer that they are under suspicion.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyStudiesCompletion {
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    /// `None` on pass/fail modules; the frontend falls back to `passed`.
    pub grade: Option<i32>,
    pub passed: bool,
    pub prerequisite_modules_completed: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyStudiesCourse {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_slug: String,
    pub organization_slug: String,
    pub language_code: String,
    pub first_enrolled_at: DateTime<Utc>,
    /// False when the student's active version of this course is a different language version.
    pub is_current: bool,
    /// Hidden courses are included here, unlike in `getMyCourses`, so the profile can offer unhiding.
    pub hidden: bool,
    /// The instance the per-module progress is fetched for. `None` if the enrolment has no instance.
    pub current_course_instance_id: Option<Uuid>,
    pub current_course_instance_name: Option<String>,
    pub supports_credit_registration: bool,
    pub modules: Vec<MyStudiesCourseModule>,
}

/// Summarises the courses the profile lists, i.e. the non-hidden ones.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyStudiesTotals {
    pub courses: i32,
    /// Counts passed completions only.
    pub completions: i32,
    /// Summed over passed completions only.
    pub ects: f32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyStudies {
    /// Drives whether the profile's credit-registration tab renders. Covers hidden courses too:
    /// hiding a course must not take away access to registering its credits.
    pub any_module_supports_credit_registration: bool,
    pub courses: Vec<MyStudiesCourse>,
    pub totals: MyStudiesTotals,
}

/**
GET `/api/v0/main-frontend/users/my-studies` - The authenticated user's own study record: every
course they are enrolled in, its modules, and their completions.

No user id parameter, so it cannot be pointed at another account. The teacher/admin equivalent is
`getUserCourseEnrollments`.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/my-studies",
    operation_id = "getMyStudies",
    tag = "users",
    responses(
        (status = 200, description = "The authenticated user's study record", body = MyStudies)
    )
)]
async fn get_my_studies(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<MyStudies>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let enrollments_info =
        models::course_instance_enrollments::get_course_enrollments_info_for_user(
            &mut conn, user.id,
        )
        .await?;
    let organizations = models::organizations::all_organizations_include_hidden(&mut conn).await?;
    let organization_slugs: HashMap<Uuid, String> =
        organizations.into_iter().map(|o| (o.id, o.slug)).collect();

    let course_ids: Vec<Uuid> = enrollments_info
        .course_enrollments
        .iter()
        .map(|enrollment| enrollment.course_id)
        .collect();
    let scores_by_module = models::user_exercise_states::get_user_course_module_scores(
        &mut conn,
        &course_ids,
        user.id,
    )
    .await?;

    let mut courses = Vec::with_capacity(enrollments_info.course_enrollments.len());

    for enrollment in enrollments_info.course_enrollments {
        // Best visible completion per module, matching the course material's
        // `get_user_module_completion_statuses_for_course`.
        let mut best_completion_by_module: HashMap<Uuid, MyStudiesCompletion> = HashMap::new();
        for course_module in &enrollment.course_modules {
            let visible_completions: Vec<_> = enrollment
                .course_module_completions
                .iter()
                .filter(|c| c.course_module_id == course_module.id && !c.needs_to_be_reviewed)
                .cloned()
                .collect();
            if let Some(best) =
                models::course_module_completions::select_best_completion(visible_completions)
            {
                // Failed completions are kept for the course's own table; only the totals omit them.
                best_completion_by_module.insert(
                    course_module.id,
                    MyStudiesCompletion {
                        course_module_completion_id: best.id,
                        completion_date: best.completion_date,
                        grade: best.grade,
                        passed: best.passed,
                        prerequisite_modules_completed: best.prerequisite_modules_completed,
                    },
                );
            }
        }

        let mut modules: Vec<MyStudiesCourseModule> = enrollment
            .course_modules
            .iter()
            .map(|course_module| {
                let score = scores_by_module.get(&course_module.id);
                MyStudiesCourseModule {
                    course_module_id: course_module.id,
                    name: course_module.name.clone(),
                    order_number: course_module.order_number,
                    ects_credits: course_module.ects_credits,
                    uh_course_code: course_module.uh_course_code.clone(),
                    supports_credit_registration: course_module
                        .enable_credit_registration_via_suotar,
                    score_given: score.map_or(0.0, |score| score.score_given),
                    score_maximum: score.and_then(|score| score.score_maximum),
                    score_required: score.and_then(|score| score.score_required),
                    completion: best_completion_by_module.remove(&course_module.id),
                }
            })
            .collect();
        modules.sort_by_key(|m| m.order_number);

        // Prefer the settings' instance: it is the one the course material shows progress for.
        let settings_instance_id = enrollment
            .user_course_settings
            .as_ref()
            .map(|s| s.current_course_instance_id);
        let current_instance = enrollment
            .course_instances
            .iter()
            .find(|ci| Some(ci.id) == settings_instance_id)
            .or_else(|| enrollment.course_instances.first());

        // Without an organization slug there is no url to the course, so skip it rather than fail the
        // whole study record.
        let Some(organization_slug) = organization_slugs
            .get(&enrollment.course.organization_id)
            .cloned()
        else {
            warn!(
                user_id = %user.id,
                course_id = %enrollment.course_id,
                organization_id = %enrollment.course.organization_id,
                "Skipping course from the user's studies because its organization is deleted"
            );
            continue;
        };

        courses.push(MyStudiesCourse {
            course_id: enrollment.course_id,
            course_name: enrollment.course.name.clone(),
            course_slug: enrollment.course.slug.clone(),
            organization_slug,
            language_code: enrollment.course.language_code.clone(),
            first_enrolled_at: enrollment.first_enrolled_at,
            is_current: enrollment.is_current,
            hidden: enrollment
                .user_course_settings
                .as_ref()
                .is_some_and(|s| s.hidden),
            current_course_instance_id: current_instance.map(|ci| ci.id),
            current_course_instance_name: current_instance.and_then(|ci| ci.name.clone()),
            supports_credit_registration: modules.iter().any(|m| m.supports_credit_registration),
            modules,
        });
    }

    // So the top of the page is what the student is working on now.
    courses.sort_by(|a, b| {
        b.is_current
            .cmp(&a.is_current)
            .then(b.first_enrolled_at.cmp(&a.first_enrolled_at))
    });

    let mut total_courses = 0;
    let mut total_completions = 0;
    let mut total_ects = 0.0;
    for course in courses.iter().filter(|c| !c.hidden) {
        total_courses += 1;
        for module in &course.modules {
            if module.completion.as_ref().is_some_and(|c| c.passed) {
                total_completions += 1;
                total_ects += module.ects_credits.unwrap_or(0.0);
            }
        }
    }

    let res = MyStudies {
        any_module_supports_credit_registration: courses
            .iter()
            .any(|c| c.supports_credit_registration),
        totals: MyStudiesTotals {
            courses: total_courses,
            completions: total_completions,
            ects: total_ects,
        },
        courses,
    };

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/users/my-certificates` - Every certificate the authenticated user holds.

No user id parameter, so it cannot be pointed at another account. Anyone holding a certificate's
verification id can already fetch its image; this only lists which ones are the caller's.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/my-certificates",
    operation_id = "getMyCertificates",
    tag = "users",
    responses(
        (status = 200, description = "The authenticated user's certificates", body = Vec<UserCertificate>)
    )
)]
async fn get_my_certificates(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<UserCertificate>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let res = models::generated_certificates::get_all_by_user_id(&mut conn, user.id).await?;

    token.authorized_ok(web::Json(res))
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
    .route("/my-studies", web::get().to(get_my_studies))
    .route("/my-certificates", web::get().to(get_my_certificates))
    .route(
        "/my-courses/{course_id}/hide",
        web::post().to(hide_course_from_my_courses),
    )
    .route(
        "/my-courses/{course_id}/unhide",
        web::post().to(unhide_course_from_my_courses),
    )
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
