/*!
Decides whether a user may perform an [Action] on a [Resource].

A passing check hands out an [AuthorizationToken]. Its only field is private, so the token
cannot be forged outside this crate and therefore proves that a check was made; callers that
answer requests are expected to require one before responding.
*/

pub mod error;

use error::{AuthorizationError, AuthorizationErrorType, AuthorizationResult, authorization_err};
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::chatbot_configurations::ChatbotConfiguration;
use headless_lms_models::{self as models, CourseOrExamId, roles::Role, roles::UserRole};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use tracing::info;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub struct ActionOnResource {
    pub action: Action,
    pub resource: Resource,
}

/// Describes an action that a user can take on some resource.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
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
    Administrate,
}

/// The target of an action.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
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

/// Proof that an authorization check passed.
#[derive(Copy, Clone, Debug)]
pub struct AuthorizationToken(());

/**  Skips the authorize() and returns AuthorizationToken, needed in functions with anonymous and test users

# Example

```ignore
async fn example_function(
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

/** Handles authorization for global chatbots and course chatbots */
pub async fn authorize_access_to_chatbot(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    chatbot_configuration: &ChatbotConfiguration,
) -> AuthorizationResult<AuthorizationToken> {
    let token = if chatbot_configuration.publicly_accessible {
        skip_authorize()
    } else {
        match (user_id, chatbot_configuration.course_id) {
            (Some(_), Some(course_id)) => {
                authorize_access_to_course_material(conn, user_id, course_id).await?
            }
            _ => {
                return Err(authorization_err!(
                    Unauthorized,
                    "You are not authorized to access the chatbot.".to_string()
                ));
            }
        }
    };

    Ok(token)
}

/**  Can be used to check whether user is allowed to view some course material */
pub async fn authorize_access_to_course_material(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    course_id: Uuid,
) -> AuthorizationResult<AuthorizationToken> {
    let token = if models::courses::is_draft(conn, course_id).await? {
        info!("Course is in draft mode");
        if user_id.is_none() {
            return Err(authorization_err!(
                Unauthorized,
                "This course is currently in draft mode and not publicly available. Please log in if you have access permissions.".to_string()
            ));
        }
        authorize(
            conn,
            Action::ViewMaterial,
            user_id,
            Resource::Course(course_id),
        )
        .await?
    } else if models::courses::is_joinable_by_code_only(conn, course_id).await? {
        info!("Course is joinable by code only");
        if let Some(user_id_value) = user_id {
            if models::join_code_uses::check_if_user_has_access_to_course(
                conn,
                user_id_value,
                course_id,
            )
            .await
            .is_err()
            {
                authorize(
                    conn,
                    Action::ViewMaterial,
                    user_id,
                    Resource::Course(course_id),
                )
                .await?;
            }
        } else {
            return Err(authorization_err!(
                Unauthorized,
                "This course requires authentication to access".to_string()
            ));
        }
        skip_authorize()
    } else {
        // The course is publicly available, no need to authorize
        skip_authorize()
    };

    Ok(token)
}

/** Can be used to check whether a user is allowed to view some course material. Chapters can be closed and limited to certain people only. */
pub async fn can_user_view_chapter(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    course_id: Option<Uuid>,
    chapter_id: Option<Uuid>,
) -> AuthorizationResult<bool> {
    if let Some(course_id) = course_id
        && let Some(chapter_id) = chapter_id
        && !models::chapters::is_open(&mut *conn, chapter_id).await?
    {
        if user_id.is_none() {
            return Ok(false);
        }
        // If the user has been granted access to view the material, then they can see the unopened chapters too
        // This is important because sometimes teachers wish to test unopened chapters with real students
        let permission = authorize(
            conn,
            Action::ViewMaterial,
            user_id,
            Resource::Course(course_id),
        )
        .await;

        return Ok(permission.is_ok());
    }
    Ok(true)
}

/// Checks whether the user may perform `action` on `resource`, fetching their roles.
///
/// The returned token is the only way to build a controller response, so only call this from a
/// controller function:
///
/// ```ignore
/// let token = authorize(&mut conn, Action::Edit, Some(user.id), Resource::Page(*page_id)).await?;
/// token.authorized_ok(web::Json(cms_page_info))
/// ```
pub async fn authorize(
    conn: &mut PgConnection,
    action: Action,
    user_id: Option<Uuid>,
    resource: Resource,
) -> AuthorizationResult<AuthorizationToken> {
    let user_roles = fetch_user_roles(conn, user_id).await?;

    authorize_with_fetched_list_of_roles(conn, action, user_id, resource, &user_roles).await
}

/// Whether the user holds a global admin role.
///
/// Answers the same question as `authorize(Administrate, GlobalPermissions)`, as a boolean for
/// the callers that branch on admin status rather than gate on it. Errors only when the user's
/// roles cannot be fetched.
pub async fn is_user_global_admin(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> AuthorizationResult<bool> {
    let user_roles = fetch_user_roles(conn, Some(user_id)).await?;

    Ok(authorize_with_fetched_list_of_roles(
        conn,
        Action::Administrate,
        Some(user_id),
        Resource::GlobalPermissions,
        &user_roles,
    )
    .await
    .is_ok())
}

/// The roles a user holds, for callers that check several permissions and want to pay for the
/// roles query once by passing the result to [authorize_with_fetched_list_of_roles].
///
/// An anonymous request has no roles rather than an error, and costs no query.
pub async fn fetch_user_roles(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
) -> AuthorizationResult<Vec<Role>> {
    match user_id {
        Some(user_id) => models::roles::get_roles(conn, user_id)
            .await
            .map_err(|original_err| {
                authorization_err!(
                    InternalServerError,
                    format!("Failed to fetch user roles: {}", original_err),
                    original_err
                )
            }),
        None => Ok(Vec::new()),
    }
}

/// Builds the generic Forbidden error shown to the user, nesting the actual roles and attempted
/// action in the source error so they only surface in logs.
fn create_authorization_error(user_roles: &[Role], action: Option<Action>) -> AuthorizationError {
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

    authorization_err!(
        Forbidden,
        "Unauthorized. Please contact course staff if you believe you should have access."
            .to_string(),
        authorization_err!(Forbidden, detail_message)
    )
}

/// Same as [authorize], but takes already-fetched roles instead of querying for them; use when
/// checking several actions for the same user.
pub async fn authorize_with_fetched_list_of_roles(
    conn: &mut PgConnection,
    action: Action,
    _user_id: Option<Uuid>,
    resource: Resource,
    user_roles: &[Role],
) -> AuthorizationResult<AuthorizationToken> {
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
) -> AuthorizationResult<AuthorizationToken> {
    if action == Action::View {
        // anyone can view an organization regardless of roles
        return Ok(AuthorizationToken(()));
    };

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
) -> AuthorizationResult<AuthorizationToken> {
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
) -> AuthorizationResult<AuthorizationToken> {
    // if trying to View a course instance that is not open, we check for permission to Teach
    if action == Action::View
        && !models::course_instances::is_open(conn, course_instance_id).await?
    {
        action = Action::Teach;
    }

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
) -> AuthorizationResult<AuthorizationToken> {
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
) -> AuthorizationResult<AuthorizationToken> {
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
) -> AuthorizationResult<AuthorizationToken> {
    let _registrar = models::study_registry_registrars::get_by_secret_key(conn, &secret_key)
        .await
        .map_err(|original_error| {
            authorization_err!(
                Forbidden,
                format!("Study registry access denied: Invalid or missing secret key. The operation {:?} cannot be performed.", action),
                original_error
            )
        })?;
    Ok(AuthorizationToken(()))
}

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
                View | ViewMaterial
                    | ViewUserProgressOrDetails
                    | ViewInternalCourseStructure
                    | ViewStats
            )
        }
        StatsViewer => matches!(action, ViewStats),
    }
}
