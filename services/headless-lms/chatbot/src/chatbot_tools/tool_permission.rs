//! What a chatbot tool requires of the caller before it is offered to the LLM, and again before
//! an answer to it is applied.

use headless_lms_authorization::{
    Action, Resource, authorize_with_fetched_list_of_roles,
    error::{AuthorizationError, AuthorizationErrorType},
};

use crate::{azure_chatbot::ChatbotUserContext, prelude::*};

/// The privilege levels a chatbot tool can require.
///
/// Every variant above [ToolPermission::LoggedInUser] is a question the application's existing
/// authorization vocabulary already answers, so a tool cannot bring a policy of its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolPermission {
    /// Anyone the chatbot itself is open to, including an anonymous visitor of a public chatbot.
    Anyone,
    /// Any logged-in user. Says nothing about their relationship to the course.
    LoggedInUser,
    /// May teach the course the chatbot belongs to: [Action::Teach] on it.
    TeachesCourse,
    /// May see the course's statistics: [Action::ViewStats] on it.
    ViewsCourseStats,
    /// Holds a global admin role: [Action::Administrate] on [Resource::GlobalPermissions].
    GlobalAdmin,
}

impl ToolPermission {
    /// Whether the caller described by `user_context` holds this permission.
    ///
    /// Answers from the roles snapshot in the context, so a request pays for its roles once
    /// however many tools it checks, and an anonymous caller is refused everything above
    /// [ToolPermission::Anyone] without a query. A denial is `Ok(false)`; the error case is a
    /// check that could not be made at all.
    pub async fn is_satisfied_by(
        self,
        conn: &mut PgConnection,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<bool> {
        match self {
            Self::Anyone => Ok(true),
            Self::LoggedInUser => Ok(user_context.user_id.is_some()),
            Self::TeachesCourse => holds_course_permission(conn, user_context, Action::Teach).await,
            Self::ViewsCourseStats => {
                holds_course_permission(conn, user_context, Action::ViewStats).await
            }
            Self::GlobalAdmin => {
                holds_permission(
                    conn,
                    user_context,
                    Action::Administrate,
                    Resource::GlobalPermissions,
                )
                .await
            }
        }
    }
}

/// Whether the caller may take `action` on the course the chatbot belongs to. A chatbot that
/// belongs to no course has no course permissions to hold.
async fn holds_course_permission(
    conn: &mut PgConnection,
    user_context: &ChatbotUserContext,
    action: Action,
) -> ChatbotResult<bool> {
    match user_context.course_id {
        Some(course_id) => {
            holds_permission(conn, user_context, action, Resource::Course(course_id)).await
        }
        None => Ok(false),
    }
}

/// Runs one authorization check against the request's roles snapshot rather than fetching roles
/// again, reading a denial as `false` and letting a failed check through as an error.
async fn holds_permission(
    conn: &mut PgConnection,
    user_context: &ChatbotUserContext,
    action: Action,
    resource: Resource,
) -> ChatbotResult<bool> {
    let Some(user_id) = user_context.user_id else {
        return Ok(false);
    };

    match authorize_with_fetched_list_of_roles(
        conn,
        action,
        Some(user_id),
        resource,
        &user_context.roles,
    )
    .await
    {
        Ok(_token) => Ok(true),
        Err(error) if is_denial(&error) => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn is_denial(error: &AuthorizationError) -> bool {
    matches!(
        error.error_type(),
        AuthorizationErrorType::Unauthorized | AuthorizationErrorType::Forbidden
    )
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use headless_lms_models::roles::{Role, UserRole};
    use uuid::Uuid;

    use crate::{azure_chatbot::ChatbotUserContext, conversation_context::ChatbotSurface};

    /// A caller of the dialog surface with the roles they hold given as a snapshot, which is how
    /// a request carries them.
    pub fn context(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        roles: Vec<Role>,
    ) -> ChatbotUserContext {
        ChatbotUserContext {
            user_id,
            course_id,
            course_name: None,
            surface: ChatbotSurface::CourseMaterialDialog,
            roles,
        }
    }

    pub fn course_role(user_id: Uuid, course_id: Uuid, role: UserRole) -> Role {
        Role {
            is_global: false,
            organization_id: None,
            course_id: Some(course_id),
            course_instance_id: None,
            exam_id: None,
            role,
            user_id,
        }
    }

    pub fn global_role(user_id: Uuid, role: UserRole) -> Role {
        Role {
            is_global: true,
            organization_id: None,
            course_id: None,
            course_instance_id: None,
            exam_id: None,
            role,
            user_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::roles::UserRole;

    use super::{test_helpers::*, *};
    use crate::test_helper::{Conn, CourseFixture, insert_course};

    const EVERY_PERMISSION: [ToolPermission; 5] = [
        ToolPermission::Anyone,
        ToolPermission::LoggedInUser,
        ToolPermission::TeachesCourse,
        ToolPermission::ViewsCourseStats,
        ToolPermission::GlobalAdmin,
    ];

    /// An anonymous caller has no roles to check, so everything above `Anyone` has to fail closed
    /// rather than be waved through or error.
    #[tokio::test]
    async fn an_anonymous_caller_holds_only_the_open_permission() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { course_id, .. } = insert_course(tx.conn()).await;
        let context = context(None, Some(course_id), Vec::new());

        for permission in EVERY_PERMISSION {
            let holds = permission
                .is_satisfied_by(tx.conn(), &context)
                .await
                .expect("the check completes");
            assert_eq!(
                holds,
                permission == ToolPermission::Anyone,
                "{permission:?} for an anonymous caller"
            );
        }
    }

    #[tokio::test]
    async fn a_logged_in_learner_holds_nothing_that_needs_a_role() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { user_id, course_id } = insert_course(tx.conn()).await;
        let context = context(Some(user_id), Some(course_id), Vec::new());

        for permission in EVERY_PERMISSION {
            let holds = permission
                .is_satisfied_by(tx.conn(), &context)
                .await
                .expect("the check completes");
            let expected = matches!(
                permission,
                ToolPermission::Anyone | ToolPermission::LoggedInUser
            );
            assert_eq!(holds, expected, "{permission:?} for a learner");
        }
    }

    #[tokio::test]
    async fn a_teacher_of_the_course_holds_the_course_permissions_but_not_admin() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { user_id, course_id } = insert_course(tx.conn()).await;
        let context = context(
            Some(user_id),
            Some(course_id),
            vec![course_role(user_id, course_id, UserRole::Teacher)],
        );

        for permission in EVERY_PERMISSION {
            let holds = permission
                .is_satisfied_by(tx.conn(), &context)
                .await
                .expect("the check completes");
            assert_eq!(
                holds,
                permission != ToolPermission::GlobalAdmin,
                "{permission:?} for a teacher of the course"
            );
        }
    }

    /// The stats viewer role exists to hand out course statistics without handing out teaching,
    /// which is the difference between the two course permissions.
    #[tokio::test]
    async fn a_stats_viewer_sees_the_stats_without_teaching() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { user_id, course_id } = insert_course(tx.conn()).await;
        let context = context(
            Some(user_id),
            Some(course_id),
            vec![course_role(user_id, course_id, UserRole::StatsViewer)],
        );

        assert!(
            ToolPermission::ViewsCourseStats
                .is_satisfied_by(tx.conn(), &context)
                .await
                .expect("the check completes")
        );
        assert!(
            !ToolPermission::TeachesCourse
                .is_satisfied_by(tx.conn(), &context)
                .await
                .expect("the check completes")
        );
    }

    #[tokio::test]
    async fn a_global_admin_holds_everything() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { user_id, course_id } = insert_course(tx.conn()).await;
        let context = context(
            Some(user_id),
            Some(course_id),
            vec![global_role(user_id, UserRole::Admin)],
        );

        for permission in EVERY_PERMISSION {
            assert!(
                permission
                    .is_satisfied_by(tx.conn(), &context)
                    .await
                    .expect("the check completes"),
                "{permission:?} for a global admin"
            );
        }
    }

    /// A chatbot that belongs to no course has no course permissions, which has to read as a
    /// denial rather than as a check that could not be made.
    #[tokio::test]
    async fn a_course_permission_cannot_hold_without_a_course() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { user_id, course_id } = insert_course(tx.conn()).await;
        let context = context(
            Some(user_id),
            None,
            vec![course_role(user_id, course_id, UserRole::Teacher)],
        );

        for permission in [
            ToolPermission::TeachesCourse,
            ToolPermission::ViewsCourseStats,
        ] {
            assert!(
                !permission
                    .is_satisfied_by(tx.conn(), &context)
                    .await
                    .expect("the check completes"),
                "{permission:?} without a course"
            );
        }
    }
}
