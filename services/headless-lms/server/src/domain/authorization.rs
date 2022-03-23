use actix_http::Payload;
use actix_session::{Session, UserSession};
use actix_web::{FromRequest, HttpRequest};
use anyhow::Result;
use chrono::{DateTime, Utc};
use futures::future::{err, ok, Ready};
use headless_lms_models::{self as models, roles::UserRole};
use models::{roles::Role, CourseOrExamId};

use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::controllers::{ControllerError, ControllerResult};

const SESSION_KEY: &str = "user";

// at least one field should be kept private to prevent initializing the struct outside of this module;
// this way FromRequest is the only way to create an AuthUser
/// Extractor for an authenticated user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
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
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let session = req.get_session();
        match session.get::<AuthUser>(SESSION_KEY) {
            Ok(Some(user)) => ok(user),
            Ok(None) => err(ControllerError::Unauthorized("Unauthorized.".to_string())),
            Err(_) => {
                // session had an invalid value
                session.remove(SESSION_KEY);
                err(ControllerError::Unauthorized("Unauthorized.".to_string()))
            }
        }
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
    };
    session
        .insert(SESSION_KEY, auth_user)
        .map_err(|_| anyhow::anyhow!("Failed to insert to session"))
}

/// Checks if the user is authenticated in the given session.
pub fn has_auth_user_session(session: &Session) -> bool {
    session.entries().get(SESSION_KEY).is_some()
}

/// Forgets authentication from the current session, if any.
pub fn forget(session: &Session) {
    session.remove(SESSION_KEY);
}

/// Describes an action that a user can take on some resource.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum Action {
    View,
    Edit,
    Grade,
    Teach,
    Download,
    Duplicate,
    DeleteAnswer,
    EditRole(UserRole),
}

/// The target of an action.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
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
    AnyCourse,
    Role,
    User,
    PlaygroundExample,
    ExerciseService,
}

/// Can user_id action the resource?
pub async fn authorize(
    conn: &mut PgConnection,
    action: Action,
    user_id: Option<Uuid>,
    resource: Resource,
) -> ControllerResult<()> {
    let user_roles = if let Some(user_id) = user_id {
        models::roles::get_roles(conn, user_id)
            .await
            .map_err(|original_err| {
                ControllerError::InternalServerError(original_err.to_string())
            })?
    } else {
        Vec::new()
    };

    // check global role
    for role in &user_roles {
        if role.is_global() && has_permission(role.role, action) {
            return Ok(());
        }
    }

    // for this resource, the domain of the role does not matter (e.g. organization role, course role, etc.)
    if resource == Resource::AnyCourse {
        for role in &user_roles {
            if has_permission(role.role, action) {
                return Ok(());
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
            check_course_permission(conn, &user_roles, action, course_id).await
        }
        Resource::Course(id) => check_course_permission(conn, &user_roles, action, id).await,
        Resource::CourseInstance(id) => {
            check_course_instance_permission(conn, &user_roles, action, id).await
        }
        Resource::Exercise(id) => {
            // an exercise can be part of a course or an exam
            let course_or_exam_id = models::exercises::get_course_or_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, &user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseSlideSubmission(id) => {
            //an exercise slide submissions can be part of a course or an exam
            let course_or_exam_id =
                models::exercise_slide_submissions::get_course_and_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, &user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseTask(id) => {
            // an exercise task can be part of a course or an exam
            let course_or_exam_id = models::exercise_tasks::get_course_or_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, &user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseTaskSubmission(id) => {
            // an exercise task submission can be part of a course or an exam
            let course_or_exam_id =
                models::exercise_task_submissions::get_course_and_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, &user_roles, action, course_or_exam_id).await
        }
        Resource::ExerciseTaskGrading(id) => {
            // a grading can be part of a course or an exam
            let course_or_exam_id =
                models::exercise_task_gradings::get_course_or_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, &user_roles, action, course_or_exam_id).await
        }
        Resource::Organization(id) => check_organization_permission(&user_roles, action, id).await,
        Resource::Page(id) => {
            // a page can be part of a course or an exam
            let course_or_exam_id = models::pages::get_course_and_exam_id(conn, id).await?;
            check_course_or_exam_permission(conn, &user_roles, action, course_or_exam_id).await
        }
        Resource::Exam(exam_id) => check_exam_permission(conn, &user_roles, action, exam_id).await,
        Resource::Role
        | Resource::User
        | Resource::AnyCourse
        | Resource::PlaygroundExample
        | Resource::ExerciseService
        | Resource::GlobalPermissions => {
            // permissions for these resources have already been checked
            Err(ControllerError::Forbidden("Unauthorized".to_string()))
        }
    }
}

async fn check_organization_permission(
    roles: &[Role],
    action: Action,
    organization_id: Uuid,
) -> ControllerResult<()> {
    if action == Action::View {
        // anyone can view an organization regardless of roles
        return Ok(());
    };

    // check organization role
    for role in roles {
        if role.is_role_for_organization(organization_id) && has_permission(role.role, action) {
            return Ok(());
        }
    }
    Err(ControllerError::Forbidden("Unauthorized".to_string()))
}

/// Also checks organization role which is valid for courses.
async fn check_course_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    mut action: Action,
    course_id: Uuid,
) -> ControllerResult<()> {
    // if trying to View a draft course, check for permission to Teach instead
    if action == Action::View && models::courses::is_draft(conn, course_id).await? {
        action = Action::Teach;
    }

    // check course role
    for role in roles {
        if role.is_role_for_course(course_id) && has_permission(role.role, action) {
            return Ok(());
        }
    }
    let organization_id = models::courses::get_organization_id(conn, course_id).await?;
    return check_organization_permission(roles, action, organization_id).await;
}

/// Also checks organization and course roles which are valid for course instances.
async fn check_course_instance_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    mut action: Action,
    course_instance_id: Uuid,
) -> ControllerResult<()> {
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
            return Ok(());
        }
    }
    let course_id = models::course_instances::get_course_id(conn, course_instance_id).await?;
    return check_course_permission(conn, roles, action, course_id).await;
}

/// Also checks organization role which is valid for exams.
async fn check_exam_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    action: Action,
    exam_id: Uuid,
) -> ControllerResult<()> {
    // check exam role
    for role in roles {
        if role.is_role_for_exam(exam_id) && has_permission(role.role, action) {
            return Ok(());
        }
    }
    let organization_id = models::exams::get_organization_id(conn, exam_id).await?;
    return check_organization_permission(roles, action, organization_id).await;
}

async fn check_course_or_exam_permission(
    conn: &mut PgConnection,
    roles: &[Role],
    action: Action,
    course_or_exam_id: CourseOrExamId,
) -> ControllerResult<()> {
    match course_or_exam_id {
        CourseOrExamId::Course(course_id) => {
            check_course_permission(conn, roles, action, course_id).await
        }
        CourseOrExamId::Exam(exam_id) => check_exam_permission(conn, roles, action, exam_id).await,
    }
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
                | EditRole(Teacher | Assistant | Reviewer)
        ),
        Assistant => matches!(
            action,
            View | Edit | Grade | DeleteAnswer | EditRole(Assistant | Reviewer)
        ),
        Reviewer => matches!(action, View | Grade),
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;
    use headless_lms_models::*;
    use models::roles::RoleDomain;

    #[tokio::test]
    async fn test_authorization() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let user = users::insert(tx.as_mut(), "auth@example.com", None, None)
            .await
            .unwrap();
        let org = organizations::insert(tx.as_mut(), "auth", "auth", "auth", Uuid::new_v4())
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

    #[tokio::test]
    async fn course_role_chapter_resource() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :chapter);

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

    #[tokio::test]
    async fn anonymous_user_can_view_open_course() {
        insert_data!(:tx, :user, :org, :course);

        authorize(tx.as_mut(), Action::View, None, Resource::Course(course))
            .await
            .unwrap();
    }
}
