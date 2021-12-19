use crate::{
    controllers::ControllerError,
    controllers::ControllerResult,
    models::{self, roles::UserRole},
};
use actix_http::Payload;
use actix_session::{Session, UserSession};
use actix_web::{FromRequest, HttpRequest};
use anyhow::Result;
use chrono::{DateTime, Utc};
use futures::future::{err, ok, Ready};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
pub enum Action {
    View,
    Edit,
    Grade,
    Teach,
    Download,
    Duplicate,
    DeleteAnswer,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
pub enum Resource {
    Chapter(Uuid),
    Course(Uuid),
    Exam(Uuid),
    ExerciseTask(Uuid),
    Exercise(Uuid),
    Grading(Uuid),
    Organization(Uuid),
    Page(Uuid),
    Submission(Uuid),
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
    user_id: Uuid,
    resource: Resource,
) -> ControllerResult<()> {
    let user_roles = crate::models::roles::get_roles(conn, user_id)
        .await
        .map_err(|original_err| ControllerError::InternalServerError(original_err.to_string()))?;

    // check global role
    for role in &user_roles {
        if role.is_global() && has_permission(role.role, action) {
            return Ok(());
        }
    }

    if resource == Resource::AnyCourse {
        for role in &user_roles {
            if has_permission(role.role, action) {
                return Ok(());
            }
        }
    }

    let (exam_id, course_id, organization_id) = match resource {
        Resource::Chapter(chapter_id) => (
            None,
            Some(crate::models::chapters::get_course_id(conn, chapter_id).await?),
            None,
        ),
        Resource::Course(course_id) => (None, Some(course_id), None),
        Resource::ExerciseTask(id) => (
            None,
            Some(crate::models::exercise_tasks::get_course_id(conn, id).await?),
            None,
        ),
        Resource::Exercise(id) => (
            None,
            Some(crate::models::exercises::get_course_id(conn, id).await?),
            None,
        ),
        Resource::Grading(id) => (
            None,
            crate::models::gradings::get_course_id(conn, id).await?,
            None,
        ),
        Resource::Organization(id) => (None, None, Some(id)),
        Resource::Page(id) => {
            let (course_id, exam_id) =
                crate::models::pages::get_course_and_exam_id(conn, id).await?;
            (exam_id, course_id, None)
        }
        Resource::Submission(id) => {
            let (course_id, exam_id) =
                crate::models::submissions::get_course_and_exam_id(conn, id).await?;
            (exam_id, course_id, None)
        }
        Resource::Exam(exam_id) => (Some(exam_id), None, None),
        Resource::Role
        | Resource::User
        | Resource::AnyCourse
        | Resource::PlaygroundExample
        | Resource::ExerciseService => (None, None, None),
    };

    // check exam role
    if let Some(exam_id) = exam_id {
        for role in &user_roles {
            if role.is_role_for_exam(exam_id) && has_permission(role.role, action) {
                return Ok(());
            }
        }
    }

    // check course role
    if let Some(course_id) = course_id {
        for role in &user_roles {
            if role.is_role_for_course(course_id) && has_permission(role.role, action) {
                return Ok(());
            }
        }
    }

    // check organization role
    // if we didn't get an organization id yet, get one from the course id if we have one
    let organization_id = if let (None, Some(course_id)) = (organization_id, course_id) {
        Some(crate::models::courses::get_organization_id(conn, course_id).await?)
    } else {
        organization_id
    };
    if let Some(organization_id) = organization_id {
        for role in &user_roles {
            if role.is_role_for_organization(organization_id) && has_permission(role.role, action) {
                return Ok(());
            }
        }
    }

    Err(ControllerError::Forbidden("Unauthorized".to_string()))
}

fn has_permission(user_role: UserRole, action: Action) -> bool {
    use Action::*;
    use UserRole::*;

    match user_role {
        Admin => true,
        Assistant => matches!(action, View | Edit | Grade | DeleteAnswer),
        Teacher => matches!(
            action,
            View | Teach | Edit | Grade | Duplicate | DeleteAnswer
        ),
        Reviewer => matches!(action, View | Grade),
    }
}
