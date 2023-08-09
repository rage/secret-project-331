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
use models::{roles::Role, CourseOrExamId};
use oauth2::basic::BasicTokenType;
use oauth2::reqwest::AsyncHttpClientError;
use oauth2::EmptyExtraTokenFields;
use oauth2::ResourceOwnerPassword;
use oauth2::ResourceOwnerUsername;
use oauth2::StandardTokenResponse;
use oauth2::TokenResponse;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use std::pin::Pin;
#[cfg(feature = "ts_rs")]
pub use ts_rs::TS;
use uuid::Uuid;

const SESSION_KEY: &str = "user";

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
                    "Unauthorized.".to_string(),
                    None,
                )),
                Err(_) => {
                    // session had an invalid value
                    session.remove(SESSION_KEY);
                    Err(ControllerError::new(
                        ControllerErrorType::Unauthorized,
                        "Unauthorized.".to_string(),
                        // Don't want to leak too many details from the error to the user
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
            "No database pool provided to verify_auth_user_exists".to_string(),
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
}

/// The target of an action.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
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
    MaterialReference,
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
        if user_id.is_none() {
            return Err(ControllerError::new(
                ControllerErrorType::Unauthorized,
                "The course is not public".to_string(),
                None,
            ));
        }
        authorize(conn, Act::ViewMaterial, user_id, Res::Course(course_id)).await?
    } else {
        skip_authorize()
    };
    Ok(token)
}

/**  Can be used to check whether user is allowed to view some course material */
pub async fn can_user_view_not_open_chapter(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    course_id: Uuid,
) -> Result<bool, ControllerError> {
    if user_id.is_none() {
        return Ok(false);
    }
    let permission = authorize(conn, Act::Edit, user_id, Res::Course(course_id)).await;
    Ok(permission.is_ok())
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
                    original_err.to_string(),
                    Some(original_err.into()),
                )
            })?
    } else {
        Vec::new()
    };

    authorize_with_fetched_list_of_roles(conn, action, user_id, resource, &user_roles).await
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
            // if trying to View a chapter that is not open, check for permission to Teach
            let action =
                if matches!(action, Action::View) && !models::chapters::is_open(conn, id).await? {
                    Action::Teach
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
            Err(ControllerError::new(
                ControllerErrorType::Forbidden,
                "Unauthorized".to_string(),
                None,
            ))
        }
        Resource::MaterialReference => {
            check_material_reference_permissions(user_roles, action).await
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
    Err(ControllerError::new(
        ControllerErrorType::Forbidden,
        "Unauthorized".to_string(),
        None,
    ))
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

async fn check_material_reference_permissions(
    roles: &[Role],
    action: Action,
) -> Result<AuthorizationToken, ControllerError> {
    for role in roles {
        if has_permission(role.role, action) {
            return Ok(AuthorizationToken(()));
        }
    }
    Err(ControllerError::new(
        ControllerErrorType::Forbidden,
        "Unauthorized".to_string(),
        None,
    ))
}

async fn check_study_registry_permission(
    conn: &mut PgConnection,
    secret_key: String,
    _action: Action,
) -> Result<AuthorizationToken, ControllerError> {
    let _registrar =
        models::study_registry_registrars::get_by_secret_key(conn, &secret_key).await?;
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
                | EditRole(Teacher | Assistant | Reviewer | MaterialViewer)
                | CreateCoursesOrExams
                | ViewMaterial
                | UploadFile
                | ViewUserProgressOrDetails
                | ViewInternalCourseStructure
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
    }
}

pub fn parse_secret_key_from_header(header: &HttpRequest) -> Result<&str, ControllerError> {
    let raw_token = header
        .headers()
        .get("Authorization")
        .map_or(Ok(""), |x| x.to_str())
        .map_err(|_| anyhow::anyhow!("Access denied.".to_string()))?;
    if !raw_token.starts_with("Basic") {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Access denied".to_string(),
            None,
        ));
    }
    let secret_key = raw_token.split(' ').nth(1).ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::Forbidden,
            "Malformed authorization token".to_string(),
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
    let token = exchange_password_with_moocfi(client, email, password).await?;
    let user = get_user_from_moocfi(&token, conn).await?;
    Ok((user, token))
}

pub type LoginToken = StandardTokenResponse<EmptyExtraTokenFields, BasicTokenType>;
pub async fn exchange_password_with_moocfi(
    client: &OAuthClient,
    email: String,
    password: String,
) -> anyhow::Result<LoginToken> {
    let token = client
        .exchange_password(
            &ResourceOwnerUsername::new(email),
            &ResourceOwnerPassword::new(password),
        )
        .request_async(async_http_client_with_headers)
        .await?;
    Ok(token)
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphQLRquest<'a> {
    query: &'a str,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiCurrentUserResponse {
    pub data: MoocfiCurrentUserResponseData,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiCurrentUserResponseData {
    #[serde(rename = "currentUser")]
    pub current_user: MoocfiCurrentUser,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiCurrentUser {
    pub id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub upstream_id: i32,
}

pub async fn get_user_from_moocfi(
    token: &LoginToken,
    conn: &mut PgConnection,
) -> anyhow::Result<User> {
    info!("Getting user details from mooc.fi");
    let moocfi_graphql_url = "https://www.mooc.fi/api";
    let client = reqwest::Client::default();
    let res = client
        .post(moocfi_graphql_url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&GraphQLRquest {
            query: r#"
{
    currentUser {
    id
    email
    first_name
    last_name
    upstream_id
    }
}
            "#,
        })
        .bearer_auth(token.access_token().secret())
        .send()
        .await
        .context("Failed to send request to Mooc.fi")?;
    if !res.status().is_success() {
        return Err(anyhow::anyhow!("Failed to get current user from Mooc.fi"));
    }
    let current_user_response: MoocfiCurrentUserResponse = res
        .json()
        .await
        .context("Unexpected response from Mooc.fi")?;
    let MoocfiCurrentUser {
        id: moocfi_id,
        first_name,
        last_name,
        email,
        upstream_id,
    } = current_user_response.data.current_user;

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
    } else if email == "user@example.com" && password == "user" {
        models::users::get_by_email(conn, "user@example.com").await?
    } else if email == "assistant@example.com" && password == "assistant" {
        models::users::get_by_email(conn, "assistant@example.com").await?
    } else if email == "creator@example.com" && password == "creator" {
        models::users::get_by_email(conn, "creator@example.com").await?
    } else if email == "student1@example.com" && password == "student.1" {
        models::users::get_by_email(conn, "student1@example.com").await?
    } else if email == "student2@example.com" && password == "student.2" {
        models::users::get_by_email(conn, "student2@example.com").await?
    } else if email == "student3@example.com" && password == "student.3" {
        models::users::get_by_email(conn, "student3@example.com").await?
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
 * HTTP Client used only for authing with TMC server, this is to ensure that TMC server
 * does not rate limit auth requests from backend
 */
async fn async_http_client_with_headers(
    mut request: oauth2::HttpRequest,
) -> Result<oauth2::HttpResponse, AsyncHttpClientError> {
    let ratelimit_api_key = std::env::var("RATELIMIT_PROTECTION_SAFE_API_KEY")
        .expect("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined");
    request.headers.append(
        "RATELIMIT-PROTECTION-SAFE-API-KEY",
        ratelimit_api_key.parse().map_err(|_err| {
            AsyncHttpClientError::Other("Invalid RATELIMIT API key.".to_string())
        })?,
    );
    let result = oauth2::reqwest::async_http_client(request).await?;
    Ok(result)
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
