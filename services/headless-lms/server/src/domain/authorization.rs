//! Common functionality related to authorization

use crate::prelude::*;
use crate::OAuthClient;
use actix_http::Payload;
use actix_session::Session;
use actix_session::SessionExt;
use actix_web::{FromRequest, HttpRequest, Responder};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use futures::Future;
use headless_lms_models::{self as models, roles::UserRole, users::User};
use headless_lms_utils::http::REQWEST_CLIENT;
use models::{roles::Role, CourseOrExamId};
use oauth2::basic::BasicTokenType;
use oauth2::EmptyExtraTokenFields;
use oauth2::HttpClientError;
use oauth2::ResourceOwnerPassword;
use oauth2::ResourceOwnerUsername;
use oauth2::StandardTokenResponse;
use oauth2::TokenResponse;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgConnection;
use std::env;
use std::pin::Pin;
use tracing_log::log;
#[cfg(feature = "ts_rs")]
pub use ts_rs::TS;
use uuid::Uuid;

const SESSION_KEY: &str = "user";

const MOOCFI_GRAPHQL_URL: &str = "https://www.mooc.fi/api";

// at least one field should be kept private to prevent initializing the struct outside of this module;
// this way FromRequest is the only way to create an AuthUser
/// Extractor for an authenticated user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub fetched_from_db_at: Option<DateTime<Utc>>,
    upstream_id: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub struct ActionOnResource {
    pub action: Action,
    pub resource: Resource,
}

impl AuthUser {
    /// The user's ID in TMC.
    pub fn upstream_id(&self) -> Option<i32> {
        self.upstream_id
    }
}

impl FromRequest for AuthUser {
    type Error = ControllerError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();
        Box::pin(async move {
            let req = req.clone();
            let session = req.get_session();
            let pool: Option<&web::Data<PgPool>> = req.app_data();
            match session.get::<AuthUser>(SESSION_KEY) {
                Ok(Some(user)) => Ok(verify_auth_user_exists(user, pool, &session).await?),
                Ok(None) => Err(ControllerError::new(
                    ControllerErrorType::Unauthorized,
                    "You are not currently logged in. Please sign in to continue.".to_string(),
                    None,
                )),
                Err(_) => {
                    // session had an invalid value
                    session.remove(SESSION_KEY);
                    Err(ControllerError::new(
                        ControllerErrorType::Unauthorized,
                        "Your session is invalid or has expired. Please sign in again.".to_string(),
                        None,
                    ))
                }
            }
        })
    }
}

/**
 * For making sure the user saved in the session still exists in the database. Check the user's existance when the session is at least 3 hours old, updates the session automatically, and returns an up-to-date AuthUser.
 */
async fn verify_auth_user_exists(
    auth_user: AuthUser,
    pool: Option<&web::Data<PgPool>>,
    session: &Session,
) -> Result<AuthUser, ControllerError> {
    if let Some(fetched_from_db_at) = auth_user.fetched_from_db_at {
        let time_now = Utc::now();
        let time_hour_ago = time_now - Duration::hours(3);
        if fetched_from_db_at > time_hour_ago {
            // No need to check for the auth user yet
            return Ok(auth_user);
        }
    }
    if let Some(pool) = pool {
        info!("Checking whether the user saved in the session still exists in the database.");
        let mut conn = pool.acquire().await?;
        let user = models::users::get_by_id(&mut conn, auth_user.id).await?;
        remember(session, user)?;
        match session.get::<AuthUser>(SESSION_KEY) {
            Ok(Some(session_user)) => Ok(session_user),
            Ok(None) => Err(ControllerError::new(
                ControllerErrorType::InternalServerError,
                "User did not persist in the session".to_string(),
                None,
            )),
            Err(e) => Err(ControllerError::new(
                ControllerErrorType::InternalServerError,
                "User did not persist in the session".to_string(),
                Some(e.into()),
            )),
        }
    } else {
        warn!("No database pool provided to verify_auth_user_exists");
        Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Unable to verify your user account. The database connection is unavailable."
                .to_string(),
            None,
        ))
    }
}

/// Stores the user as authenticated in the given session.
pub fn remember(session: &Session, user: models::users::User) -> Result<()> {
    let auth_user = AuthUser {
        id: user.id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        deleted_at: user.deleted_at,
        upstream_id: user.upstream_id,
        fetched_from_db_at: Some(Utc::now()),
    };
    session
        .insert(SESSION_KEY, auth_user)
        .map_err(|_| anyhow::anyhow!("Failed to insert to session"))
}

/// Checks if the user is authenticated in the given session.
pub async fn has_auth_user_session(session: &Session, pool: web::Data<PgPool>) -> bool {
    match session.get::<AuthUser>(SESSION_KEY) {
        Ok(Some(sesssion_auth_user)) => {
            verify_auth_user_exists(sesssion_auth_user, Some(&pool), session)
                .await
                .is_ok()
        }
        _ => false,
    }
}

/// Forgets authentication from the current session, if any.
pub fn forget(session: &Session) {
    session.purge();
}

/// Describes an action that a user can take on some resource.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case", tag = "type", content = "variant")]
pub enum Action {
    ViewMaterial,
    View,
    Edit,
    Grade,
    Teach,
    Download,
    Duplicate,
    DeleteAnswer,
    EditRole(UserRole),
    CreateCoursesOrExams,
    /// Deletion that we usually don't want to allow.
    UsuallyUnacceptableDeletion,
    UploadFile,
    ViewUserProgressOrDetails,
    ViewInternalCourseStructure,
    ViewStats,
}

/// The target of an action.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case", tag = "type", content = "id")]
pub enum Resource {
    GlobalPermissions,
    Chapter(Uuid),
    Course(Uuid),
    CourseInstance(Uuid),
    Exam(Uuid),
    Exercise(Uuid),
    ExerciseSlideSubmission(Uuid),
    ExerciseTask(Uuid),
    ExerciseTaskGrading(Uuid),
    ExerciseTaskSubmission(Uuid),
    Organization(Uuid),
    Page(Uuid),
    StudyRegistry(String),
    AnyCourse,
    Role,
    User,
    PlaygroundExample,
    ExerciseService,
}

impl Resource {
    pub fn from_course_or_exam_id(course_or_exam_id: CourseOrExamId) -> Self {
        match course_or_exam_id {
            CourseOrExamId::Course(id) => Self::Course(id),
            CourseOrExamId::Exam(id) => Self::Exam(id),
        }
    }
}

/// Validates that user has right to function
#[derive(Copy, Clone, Debug)]
pub struct AuthorizationToken(());

impl AuthorizationToken {
    pub fn authorized_ok<T>(self, t: T) -> ControllerResult<T> {
        Ok(AuthorizedResponse {
            data: t,
            token: self,
        })
    }
}

/// Responder for AuthorizationToken
#[derive(Copy, Clone)]
pub struct AuthorizedResponse<T> {
    pub data: T,
    pub token: AuthorizationToken,
}

impl<T: Responder> Responder for AuthorizedResponse<T> {
    type Body = T::Body;

    fn respond_to(self, req: &HttpRequest) -> actix_web::HttpResponse<Self::Body> {
        T::respond_to(self.data, req)
    }
}

/**  Skips the authorize() and returns AuthorizationToken, needed in functions with anonymous and test users

# Example

```ignore
async fn example_function(
    // No user mentioned
) -> ControllerResult<....> {
    // We need to return ControllerResult -> AuthorizedResponse

    let token = skip_authorize();

    token.authorized_ok(web::Json(organizations))

}
```
*/
pub fn skip_authorize() -> AuthorizationToken {
    AuthorizationToken(())
}

/**  Can be used to check whether user is allowed to view some course material */
pub async fn authorize_access_to_course_material(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    course_id: Uuid,
) -> Result<AuthorizationToken, ControllerError> {
    let token = if models::courses::is_draft(conn, course_id).await? {
        info!("Course is in draft mode");
        if user_id.is_none() {
            return Err(ControllerError::new(
                ControllerErrorType::Unauthorized,
                "This course is currently in draft mode and not publicly available. Please log in if you have access permissions.".to_string(),
                None,
            ));
        }
        authorize(conn, Act::ViewMaterial, user_id, Res::Course(course_id)).await?
    } else if models::courses::is_joinable_by_code_only(conn, course_id).await? {
        info!("Course is joinable by code only");
        if models::join_code_uses::check_if_user_has_access_to_course(
            conn,
            user_id.unwrap(),
            course_id,
        )
        .await
        .is_err()
        {
            authorize(conn, Act::ViewMaterial, user_id, Res::Course(course_id)).await?;
        }
        skip_authorize()
    } else {
        // The course is publicly available, no need to authorize
        skip_authorize()
    };

    Ok(token)
}

/**  Can be used to check whether user is allowed to view some course material */
pub async fn authorize_access_to_tmc_server(
    request: &HttpRequest,
) -> Result<AuthorizationToken, ControllerError> {
    let tmc_server_secret_for_communicating_to_secret_project =
        env::var("TMC_SERVER_SECRET_FOR_COMMUNICATING_TO_SECRET_PROJECT")
            .expect("TMC_SERVER_SECRET_FOR_COMMUNICATING_TO_SECRET_PROJECT must be defined");
    // check authorization header
    let auth_header = request
        .headers()
        .get("Authorization")
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::Unauthorized,
                "TMC server authorization failed: Missing Authorization header.".to_string(),
                None,
            )
        })?
        .to_str()
        .map_err(|_| {
            ControllerError::new(
                ControllerErrorType::Unauthorized,
                "TMC server authorization failed: Invalid Authorization header format.".to_string(),
                None,
            )
        })?;
    // If auth header correct one, grant access
    if auth_header == tmc_server_secret_for_communicating_to_secret_project {
        return Ok(skip_authorize());
    }
    Err(ControllerError::new(
        ControllerErrorType::Unauthorized,
        "TMC server authorization failed: Invalid authorization token.".to_string(),
        None,
    ))
}

/**  Can be used to check whether user is allowed to view some course material. Chapters can be closed and and limited to certain people only. */
pub async fn can_user_view_chapter(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    course_id: Option<Uuid>,
    chapter_id: Option<Uuid>,
) -> Result<bool, ControllerError> {
    if let Some(course_id) = course_id {
        if let Some(chapter_id) = chapter_id {
            if !models::chapters::is_open(&mut *conn, chapter_id).await? {
                if user_id.is_none() {
                    return Ok(false);
                }
                // If the user has been granted access to view the material, then they can see the unopened chapters too
                // This is important because sometimes teachers wish to test unopened chapters with real students
                let permission =
                    authorize(conn, Act::ViewMaterial, user_id, Res::Course(course_id)).await;

                return Ok(permission.is_ok());
            }
        }
    }
    Ok(true)
}

/**
The authorization token is the only way to return a controller result, and should only be used in controller functions that return a response to the user.


let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

token.authorized_ok(web::Json(cms_page_info))


*/
pub async fn authorize(
    conn: &mut PgConnection,
    action: Action,
    user_id: Option<Uuid>,
    resource: Resource,
) -> Result<AuthorizationToken, ControllerError> {
    let user_roles = if let Some(user_id) = user_id {
        models::roles::get_roles(conn, user_id)
            .await
            .map_err(|original_err| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    format!("Failed to fetch user roles: {}", original_err),
                    Some(original_err.into()),
                )
            })?
    } else {
        Vec::new()
    };

    authorize_with_fetched_list_of_roles(conn, action, user_id, resource, &user_roles).await
}

/// Creates a ControllerError for authorization failures with more information in the source error
fn create_authorization_error(user_roles: &[Role], action: Option<Action>) -> ControllerError {
    let mut detail_message = String::new();

    if user_roles.is_empty() {
        detail_message.push_str("You don't have any assigned roles.");
    } else {
        detail_message.push_str("Your current roles are: ");
        let roles_str = user_roles
            .iter()
            .map(|r| format!("{:?} ({})", r.role, r.domain_description()))
            .collect::<Vec<_>>()
            .join(", ");
        detail_message.push_str(&roles_str);
    }

    if let Some(act) = action {
        detail_message.push_str(&format!("\nAction attempted: {:?}", act));
    }

    // Create the controller error
    ControllerError::new(
        ControllerErrorType::Forbidden,
        "Unauthorized. Please contact course staff if you believe you should have access."
            .to_string(),
        Some(ControllerError::new(ControllerErrorType::Forbidden, detail_message, None).into()),
    )
}

/// Same as `authorize`, but takes as an argument `Vec<Role>` so that we avoid fetching the roles from the database for optimization reasons. This is useful when we're checking multiple authorizations at once.
pub async fn authorize_with_fetched_list_of_roles(
    conn: &mut PgConnection,
    action: Action,
    _user_id: Option<Uuid>,
    resource: Resource,
    user_roles: &[Role],
) -> Result<AuthorizationToken, ControllerError> {
    // check global role
    for role in user_roles {
        if role.is_global() && has_permission(role.role, action) {
            return Ok(AuthorizationToken(()));
        }
    }

    // for this resource, the domain of the role does not matter (e.g. organization role, course role, etc.)
    if resource == Resource::AnyCourse {
        for role in user_roles {
            if has_permission(role.role, action) {
                return Ok(AuthorizationToken(()));
            }
        }
    }

    // for some resources, we need to get more information from the database
    match resource {
        Resource::Chapter(id) => {
            // if trying to View a chapter that is not open, check for permission to view the material
            let action =
                if matches!(action, Action::View) && !models::chapters::is_open(conn, id).await? {
                    Action::ViewMaterial
                } else {
                    action
                };
            // there are no chapter roles so we check the course instead
            let course_id = models::chapters::get_course_id(conn, id).await?;
            check_course_permission(conn, user_roles, action, course_id).await
        }
        Resource::Course(id) => check_course_permission(conn, user_roles, action, id).await,
        Resource::CourseInstance(id) => {
            check_course_instance_permission(conn, user_roles, action, id).await
        }
        Resource::Exercise(id) => {
            // an exercise can be part of a course or an exam
            let course_or_exam_id = models::exercises::get_course_or_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseSlideSubmission(id) => {
            //an exercise slide submissions can be part of a course or an exam
            let course_or_exam_id =
                models::exercise_slide_submissions::get_course_and_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseTask(id) => {
            // an exercise task can be part of a course or an exam
            let course_or_exam_id = models::exercise_tasks::get_course_or_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseTaskSubmission(id) => {
            // an exercise task submission can be part of a course or an exam
            let course_or_exam_id =
                models::exercise_task_submissions::get_course_and_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseTaskGrading(id) => {
            // a grading can be part of a course or an exam
            let course_or_exam_id =
                models::exercise_task_gradings::get_course_or_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, user_roles, action, course_or_exam_id).await
        }
        Resource::Organization(id) => check_organization_permission(user_roles, action, id).await,
        Resource::Page(id) => {
            // a page can be part of a course or an exam
            let course_or_exam_id = models::pages::get_course_and_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, user_roles, action, course_or_exam_id).await
        }
        Resource::StudyRegistry(secret_key) => {
            check_study_registry_permission(conn, secret_key, action).await
        }
        Resource::Exam(exam_id) => check_exam_permission(conn, user_roles, action, exam_id).await,
        Resource::Role
        | Resource::User
        | Resource::AnyCourse
        | Resource::PlaygroundExample
        | Resource::ExerciseService
        | Resource::GlobalPermissions => {
            // permissions for these resources have already been checked
            Err(create_authorization_error(user_roles, Some(action)))
        }
    }
}

async fn check_organization_permission(
    roles: &[Role],
    action: Action,
    organization_id: Uuid,
) -> Result<AuthorizationToken, ControllerError> {
    if action == Action::View {
        // anyone can view an organization regardless of roles
        return Ok(AuthorizationToken(()));
    };

    // check organization role
    for role in roles {
        if role.is_role_for_organization(organization_id) && has_permission(role.role, action) {
            return Ok(AuthorizationToken(()));
        }
    }
    Err(create_authorization_error(roles, Some(action)))
}

/// Also checks organization role which is valid for courses.
async fn check_course_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    action: Action,
    course_id: Uuid,
) -> Result<AuthorizationToken, ControllerError> {
    // check course role
    for role in roles {
        if role.is_role_for_course(course_id) && has_permission(role.role, action) {
            return Ok(AuthorizationToken(()));
        }
    }
    let organization_id = models::courses::get_organization_id(conn, course_id).await?;
    check_organization_permission(roles, action, organization_id).await
}

/// Also checks organization and course roles which are valid for course instances.
async fn check_course_instance_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    mut action: Action,
    course_instance_id: Uuid,
) -> Result<AuthorizationToken, ControllerError> {
    // if trying to View a course instance that is not open, we check for permission to Teach
    if action == Action::View
        && !models::course_instances::is_open(conn, course_instance_id).await?
    {
        action = Action::Teach;
    }

    // check course instance role
    for role in roles {
        if role.is_role_for_course_instance(course_instance_id) && has_permission(role.role, action)
        {
            return Ok(AuthorizationToken(()));
        }
    }
    let course_id = models::course_instances::get_course_id(conn, course_instance_id).await?;
    check_course_permission(conn, roles, action, course_id).await
}

/// Also checks organization role which is valid for exams.
async fn check_exam_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    action: Action,
    exam_id: Uuid,
) -> Result<AuthorizationToken, ControllerError> {
    // check exam role
    for role in roles {
        if role.is_role_for_exam(exam_id) && has_permission(role.role, action) {
            return Ok(AuthorizationToken(()));
        }
    }
    let organization_id = models::exams::get_organization_id(conn, exam_id).await?;
    check_organization_permission(roles, action, organization_id).await
}

async fn check_course_or_exam_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    action: Action,
    course_or_exam_id: CourseOrExamId,
) -> Result<AuthorizationToken, ControllerError> {
    match course_or_exam_id {
        CourseOrExamId::Course(course_id) => {
            check_course_permission(conn, roles, action, course_id).await
        }
        CourseOrExamId::Exam(exam_id) => check_exam_permission(conn, roles, action, exam_id).await,
    }
}

async fn check_study_registry_permission(
    conn: &mut PgConnection,
    secret_key: String,
    action: Action,
) -> Result<AuthorizationToken, ControllerError> {
    let _registrar = models::study_registry_registrars::get_by_secret_key(conn, &secret_key)
        .await
        .map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::Forbidden,
                format!("Study registry access denied: Invalid or missing secret key. The operation {:?} cannot be performed.", action),
                Some(original_error.into()),
            )
        })?;
    Ok(AuthorizationToken(()))
}

// checks whether the role is allowed to perform the action
fn has_permission(user_role: UserRole, action: Action) -> bool {
    use Action::*;
    use UserRole::*;

    match user_role {
        Admin => true,
        Teacher => matches!(
            action,
            View | Teach
                | Edit
                | Grade
                | Duplicate
                | DeleteAnswer
                | EditRole(Teacher | Assistant | Reviewer | MaterialViewer | StatsViewer)
                | CreateCoursesOrExams
                | ViewMaterial
                | UploadFile
                | ViewUserProgressOrDetails
                | ViewInternalCourseStructure
                | ViewStats
        ),
        Assistant => matches!(
            action,
            View | Edit
                | Grade
                | DeleteAnswer
                | EditRole(Assistant | Reviewer | MaterialViewer)
                | Teach
                | ViewMaterial
                | ViewUserProgressOrDetails
                | ViewInternalCourseStructure
        ),
        Reviewer => matches!(
            action,
            View | Grade | ViewMaterial | ViewInternalCourseStructure
        ),
        CourseOrExamCreator => matches!(action, CreateCoursesOrExams),
        MaterialViewer => matches!(action, ViewMaterial),
        TeachingAndLearningServices => {
            matches!(
                action,
                View | ViewMaterial | ViewUserProgressOrDetails | ViewInternalCourseStructure
            )
        }
        StatsViewer => matches!(action, ViewStats),
    }
}

pub fn parse_secret_key_from_header(header: &HttpRequest) -> Result<&str, ControllerError> {
    let raw_token = header
        .headers()
        .get("Authorization")
        .map_or(Ok(""), |x| x.to_str())
        .map_err(|_| anyhow::anyhow!("Authorization header contains invalid characters."))?;
    if !raw_token.starts_with("Basic") {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Access denied: Authorization header must use Basic authentication format.".to_string(),
            None,
        ));
    }
    let secret_key = raw_token.split(' ').nth(1).ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::Forbidden,
            "Access denied: Malformed authorization token, expected 'Basic <token>' format."
                .to_string(),
            None,
        )
    })?;
    Ok(secret_key)
}

/// Authenticates the user with mooc.fi, returning the authenticated user and their oauth token.
pub async fn authenticate_moocfi_user(
    conn: &mut PgConnection,
    client: &OAuthClient,
    email: String,
    password: String,
) -> anyhow::Result<(User, LoginToken)> {
    info!("Attempting to authenticate user with TMC");
    let token = exchange_password_with_tmc(client, email.clone(), password).await?;
    debug!("Successfully obtained OAuth token from TMC");
    let user = get_user_from_moocfi_by_login_token(&token, conn).await?;
    info!("Successfully authenticated user {} with mooc.fi", user.id);
    Ok((user, token))
}

pub type LoginToken = StandardTokenResponse<EmptyExtraTokenFields, BasicTokenType>;
pub async fn exchange_password_with_tmc(
    client: &OAuthClient,
    email: String,
    password: String,
) -> anyhow::Result<LoginToken> {
    let token = client
        .exchange_password(
            &ResourceOwnerUsername::new(email),
            &ResourceOwnerPassword::new(password),
        )
        .request_async(&async_http_client_with_headers)
        .await?;
    Ok(token)
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphQLRequest<'a> {
    query: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    variables: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiUserResponse {
    pub data: MoocfiUserResponseData,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiUserResponseData {
    pub user: MoocfiUser,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiUser {
    pub id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub upstream_id: i32,
}

pub async fn get_user_from_moocfi_by_login_token(
    token: &LoginToken,
    conn: &mut PgConnection,
) -> anyhow::Result<User> {
    info!("Getting user details from mooc.fi");

    let res = REQWEST_CLIENT
        .post(MOOCFI_GRAPHQL_URL)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&GraphQLRequest {
            query: r#"
{
    user: currentUser {
      id
      email
      first_name
      last_name
      upstream_id
    }
}"#,
            variables: None,
        })
        .bearer_auth(token.access_token().secret())
        .send()
        .await
        .context("Failed to send request to Mooc.fi")?;

    if !res.status().is_success() {
        error!(
            "Failed to get user from mooc.fi with status {}",
            res.status()
        );
        return Err(anyhow::anyhow!("Failed to get current user from Mooc.fi"));
    }

    debug!("Received response from mooc.fi, parsing user data");
    let current_user_response: MoocfiUserResponse = res
        .json()
        .await
        .context("Unexpected response from Mooc.fi")?;

    debug!(
        "Creating or fetching user with mooc.fi id {}",
        current_user_response.data.user.id
    );
    let user = get_or_create_user_from_moocfi_response(&mut *conn, current_user_response.data.user)
        .await?;
    info!(
        "Successfully got user details from mooc.fi for user {}",
        user.id
    );

    Ok(user)
}

pub async fn get_user_from_moocfi_by_tmc_access_token_and_upstream_id(
    conn: &mut PgConnection,
    tmc_access_token: &str,
    upstream_id: &i32,
) -> anyhow::Result<User> {
    info!("Getting user details from mooc.fi");
    let client = reqwest::Client::default();

    let res = client
        .post(MOOCFI_GRAPHQL_URL)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .bearer_auth(tmc_access_token)
        .json(&GraphQLRequest {
            query: r#"
query ($upstreamId: Int) {
  user(upstream_id: $upstreamId) {
    id
    email
    first_name
    last_name
    upstream_id
  }
}"#,
            variables: Some(json!({ "upstreamId": upstream_id })),
        })
        .send()
        .await
        .context("Failed to send request to Mooc.fi")?;
    if !res.status().is_success() {
        return Err(anyhow::anyhow!("Failed to get current user from Mooc.fi"));
    }
    let current_user_response: MoocfiUserResponse = res
        .json()
        .await
        .context("Unexpected response from Mooc.fi")?;

    let user = get_or_create_user_from_moocfi_response(&mut *conn, current_user_response.data.user)
        .await?;
    Ok(user)
}

async fn get_or_create_user_from_moocfi_response(
    conn: &mut PgConnection,
    moocfi_user: MoocfiUser,
) -> anyhow::Result<User> {
    let MoocfiUser {
        id: moocfi_id,
        first_name,
        last_name,
        email,
        upstream_id,
    } = moocfi_user;

    // fetch existing user or create new one
    let user =
        match models::users::find_by_upstream_id(conn, upstream_id).await? {
            Some(existing_user) => existing_user,
            None => {
                models::users::insert_with_upstream_id_and_moocfi_id(
                    conn,
                    &email,
                    // convert empty names to None
                    first_name.as_deref().and_then(|n| {
                        if n.trim().is_empty() {
                            None
                        } else {
                            Some(n)
                        }
                    }),
                    last_name
                        .as_deref()
                        .and_then(|n| if n.trim().is_empty() { None } else { Some(n) }),
                    upstream_id,
                    moocfi_id,
                )
                .await?
            }
        };
    Ok(user)
}

// Only used for testing, not to use in production.
pub async fn authenticate_test_user(
    conn: &mut PgConnection,
    email: &str,
    password: &str,
    application_configuration: &ApplicationConfiguration,
) -> anyhow::Result<User> {
    // Sanity check to ensure this is not called outside of test mode. The whole application configuration is passed to this function instead of just the boolean to make mistakes harder.
    assert!(application_configuration.test_mode);
    let user = if email == "admin@example.com" && password == "admin" {
        models::users::get_by_email(conn, "admin@example.com").await?
    } else if email == "teacher@example.com" && password == "teacher" {
        models::users::get_by_email(conn, "teacher@example.com").await?
    } else if email == "language.teacher@example.com" && password == "language.teacher" {
        models::users::get_by_email(conn, "language.teacher@example.com").await?
    } else if email == "material.viewer@example.com" && password == "material.viewer" {
        models::users::get_by_email(conn, "material.viewer@example.com").await?
    } else if email == "user@example.com" && password == "user" {
        models::users::get_by_email(conn, "user@example.com").await?
    } else if email == "assistant@example.com" && password == "assistant" {
        models::users::get_by_email(conn, "assistant@example.com").await?
    } else if email == "creator@example.com" && password == "creator" {
        models::users::get_by_email(conn, "creator@example.com").await?
    } else if email == "student1@example.com" && password == "student1" {
        models::users::get_by_email(conn, "student1@example.com").await?
    } else if email == "student2@example.com" && password == "student2" {
        models::users::get_by_email(conn, "student2@example.com").await?
    } else if email == "student3@example.com" && password == "student3" {
        models::users::get_by_email(conn, "student3@example.com").await?
    } else if email == "student4@example.com" && password == "student4" {
        models::users::get_by_email(conn, "student4@example.com").await?
    } else if email == "student5@example.com" && password == "student5" {
        models::users::get_by_email(conn, "student5@example.com").await?
    } else if email == "teaching-and-learning-services@example.com"
        && password == "teaching-and-learning-services"
    {
        models::users::get_by_email(conn, "teaching-and-learning-services@example.com").await?
    } else if email == "student-without-research-consent@example.com"
        && password == "student-without-research-consent"
    {
        models::users::get_by_email(conn, "student-without-research-consent@example.com").await?
    } else if email == "langs@example.com" && password == "langs" {
        models::users::get_by_email(conn, "langs@example.com").await?
    } else {
        anyhow::bail!("Invalid email or password");
    };
    Ok(user)
}

// Only used for testing, not to use in production.
pub async fn authenticate_test_token(
    conn: &mut PgConnection,
    token: &str,
    application_configuration: &ApplicationConfiguration,
) -> anyhow::Result<User> {
    // Sanity check to ensure this is not called outside of test mode. The whole application configuration is passed to this function instead of just the boolean to make mistakes harder.
    assert!(application_configuration.test_mode);
    let user = models::users::get_by_email(conn, token).await?;
    Ok(user)
}

/**
 Gets the rate limit protection API key from environment variables and converts it to a header value.
 This key is used to bypass rate limiting when making requests to TMC server.
*/
fn get_ratelimit_api_key() -> Result<reqwest::header::HeaderValue, HttpClientError<reqwest::Error>>
{
    let key = match std::env::var("RATELIMIT_PROTECTION_SAFE_API_KEY") {
        Ok(key) => {
            debug!("Found RATELIMIT_PROTECTION_SAFE_API_KEY");
            key
        }
        Err(e) => {
            error!(
                "RATELIMIT_PROTECTION_SAFE_API_KEY environment variable not set: {}",
                e
            );
            return Err(HttpClientError::Other(
                "RATELIMIT_PROTECTION_SAFE_API_KEY must be defined".to_string(),
            ));
        }
    };

    key.parse::<reqwest::header::HeaderValue>().map_err(|err| {
        error!("Invalid RATELIMIT API key format: {}", err);
        HttpClientError::Other("Invalid RATELIMIT API key.".to_string())
    })
}

/**
 HTTP Client used only for authenticating with TMC server. This function:
 1. Ensures TMC server does not rate limit auth requests from backend by adding a special header
 2. Converts between oauth2 crate's internal http types and our reqwest types:
    - Converts oauth2::HttpRequest to a reqwest::Request
    - Makes the request using our REQWEST_CLIENT
    - Converts the reqwest::Response back to oauth2::HttpResponse
*/
async fn async_http_client_with_headers(
    oauth_request: oauth2::HttpRequest,
) -> Result<oauth2::HttpResponse, HttpClientError<reqwest::Error>> {
    debug!("Making OAuth request to TMC server");

    if log::log_enabled!(log::Level::Trace) {
        // Only log the URL path, not query parameters which may contain credentials
        if let Ok(url) = oauth_request.uri().to_string().parse::<reqwest::Url>() {
            trace!("OAuth request path: {}", url.path());
        }
    }

    let parsed_key = get_ratelimit_api_key()?;

    debug!("Building request to TMC server");
    let request = REQWEST_CLIENT
        .request(
            oauth_request.method().clone(),
            oauth_request
                .uri()
                .to_string()
                .parse::<reqwest::Url>()
                .map_err(|e| HttpClientError::Other(format!("Invalid URL: {}", e)))?,
        )
        .headers(oauth_request.headers().clone())
        .version(oauth_request.version())
        .header("RATELIMIT-PROTECTION-SAFE-API-KEY", parsed_key)
        .body(oauth_request.body().to_vec());

    debug!("Sending request to TMC server");
    let response = request
        .send()
        .await
        .map_err(|e| HttpClientError::Other(format!("Failed to execute request: {}", e)))?;

    // Log response status and version, but not headers or body which may contain tokens
    debug!(
        "Received response from TMC server - Status: {}, Version: {:?}",
        response.status(),
        response.version()
    );

    let status = response.status();
    let version = response.version();
    let headers = response.headers().clone();

    debug!("Reading response body");
    let body_bytes = response
        .bytes()
        .await
        .map_err(|e| HttpClientError::Other(format!("Failed to read response body: {}", e)))?
        .to_vec();

    debug!("Building OAuth response");
    let mut builder = oauth2::http::Response::builder()
        .status(status)
        .version(version);

    if let Some(builder_headers) = builder.headers_mut() {
        builder_headers.extend(headers.iter().map(|(k, v)| (k.clone(), v.clone())));
    }

    let oauth_response = builder
        .body(body_bytes)
        .map_err(|e| HttpClientError::Other(format!("Failed to construct response: {}", e)))?;

    debug!("Successfully completed OAuth request");
    Ok(oauth_response)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;
    use headless_lms_models::*;
    use models::roles::RoleDomain;

    #[actix_web::test]
    async fn test_authorization() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let user = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "auth@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        let org = organizations::insert(tx.as_mut(), PKeyPolicy::Generate, "auth", "auth", "auth")
            .await
            .unwrap();

        authorize(
            tx.as_mut(),
            Action::Edit,
            Some(user),
            Resource::Organization(org),
        )
        .await
        .unwrap_err();

        roles::insert(
            tx.as_mut(),
            user,
            UserRole::Teacher,
            RoleDomain::Organization(org),
        )
        .await
        .unwrap();

        authorize(
            tx.as_mut(),
            Action::Edit,
            Some(user),
            Resource::Organization(org),
        )
        .await
        .unwrap();
    }

    #[actix_web::test]
    async fn course_role_chapter_resource() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module, :chapter);

        authorize(
            tx.as_mut(),
            Action::Edit,
            Some(user),
            Resource::Chapter(chapter),
        )
        .await
        .unwrap_err();

        roles::insert(
            tx.as_mut(),
            user,
            UserRole::Teacher,
            RoleDomain::Course(course),
        )
        .await
        .unwrap();

        authorize(
            tx.as_mut(),
            Action::Edit,
            Some(user),
            Resource::Chapter(chapter),
        )
        .await
        .unwrap();
    }

    #[actix_web::test]
    async fn anonymous_user_can_view_open_course() {
        insert_data!(:tx, :user, :org, :course);

        authorize(tx.as_mut(), Action::View, None, Resource::Course(course))
            .await
            .unwrap();
    }
}
