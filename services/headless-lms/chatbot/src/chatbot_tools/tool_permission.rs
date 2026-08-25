//! What a chatbot tool requires of the caller before it is offered to the LLM, and again before
//! an answer to it is applied.

use headless_lms_authorization::{Action, Resource, is_permitted};

use crate::{prelude::*, user_context::ChatbotUserContext};

/// The privilege levels a chatbot tool can require.
///
/// Every variant above [ToolPermission::Anyone] is a question the application's existing
/// authorization vocabulary already answers, so a tool cannot bring a policy of its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolPermission {
    /// Anyone the chatbot itself is open to, including an anonymous visitor of a public chatbot.
    Anyone,
    /// May teach the course the chatbot belongs to: [Action::Teach] on it.
    TeachesCourse,
    /// Holds a global admin role: [Action::Administrate] on [Resource::GlobalPermissions].
    GlobalAdmin,
}

impl ToolPermission {
    /// Whether the caller described by `user_context` holds this permission.
    ///
    /// A denial is `Ok(false)`; the error case is a check that could not be made at all.
    pub async fn is_satisfied_by(
        self,
        conn: &mut PgConnection,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<bool> {
        match self {
            Self::Anyone => Ok(true),
            Self::TeachesCourse => holds_course_permission(conn, user_context, Action::Teach).await,
            Self::GlobalAdmin => holds_global_admin(conn, user_context).await,
        }
    }
}

/// Whether the caller may take `action` on the course the chatbot belongs to. A chatbot that
/// belongs to no course has no course permissions to hold, and an anonymous caller holds none
/// without a query.
async fn holds_course_permission(
    conn: &mut PgConnection,
    user_context: &ChatbotUserContext,
    action: Action,
) -> ChatbotResult<bool> {
    let (Some(_user_id), Some(course_id)) = (user_context.user_id, user_context.course_id) else {
        return Ok(false);
    };

    let roles = user_context.roles(conn).await?;
    Ok(is_permitted(conn, action, Resource::Course(course_id), roles).await?)
}

/// Whether the caller holds a global admin role. Anonymous callers fail closed without a query.
async fn holds_global_admin(
    conn: &mut PgConnection,
    user_context: &ChatbotUserContext,
) -> ChatbotResult<bool> {
    let Some(_user_id) = user_context.user_id else {
        return Ok(false);
    };

    let roles = user_context.roles(conn).await?;
    Ok(is_permitted(
        conn,
        Action::Administrate,
        Resource::GlobalPermissions,
        roles,
    )
    .await?)
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use headless_lms_models::roles::{Role, UserRole};
    use uuid::Uuid;

    use crate::user_context::ChatbotUserContext;

    /// A caller whose roles are known already, so that a test does not have to seed them into the
    /// database.
    pub fn context(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        roles: Vec<Role>,
    ) -> ChatbotUserContext {
        ChatbotUserContext::with_roles(user_id, course_id, None, roles)
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
    use headless_lms_models::{
        insert_data,
        test_helper::{Conn, init_app_conf},
    };

    /// An anonymous caller has no roles to check, so a permission that needs one has to fail
    /// closed rather than be waved through or error.
    #[tokio::test]
    async fn an_anonymous_caller_holds_only_the_open_permission() {
        insert_data!(:tx, :user, :org, :course);
        let context = context(None, Some(course), Vec::new());

        for permission in [
            ToolPermission::Anyone,
            ToolPermission::TeachesCourse,
            ToolPermission::GlobalAdmin,
        ] {
            let holds = permission
                .is_satisfied_by(tx.as_mut(), &context)
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
        insert_data!(:tx, :user, :org, :course);
        let context = context(Some(user), Some(course), Vec::new());

        assert!(
            !ToolPermission::TeachesCourse
                .is_satisfied_by(tx.as_mut(), &context)
                .await
                .expect("the check completes")
        );
    }

    #[tokio::test]
    async fn a_teacher_of_the_course_holds_the_course_permission() {
        insert_data!(:tx, :user, :org, :course);
        let context = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );

        assert!(
            ToolPermission::TeachesCourse
                .is_satisfied_by(tx.as_mut(), &context)
                .await
                .expect("the check completes")
        );
    }

    /// A chatbot that belongs to no course has no course permissions, which has to read as a
    /// denial rather than as a check that could not be made.
    #[tokio::test]
    async fn a_course_permission_cannot_hold_without_a_course() {
        insert_data!(:tx, :user, :org, :course);
        let context = context(
            Some(user),
            None,
            vec![course_role(user, course, UserRole::Teacher)],
        );

        assert!(
            !ToolPermission::TeachesCourse
                .is_satisfied_by(tx.as_mut(), &context)
                .await
                .expect("the check completes")
        );
    }

    /// `GlobalAdmin` requires the stricter `Administrate` action: a course teacher and a global
    /// `TeachingAndLearningServices` role must not satisfy it, only a global `Admin` role.
    #[tokio::test]
    async fn global_admin_requires_a_global_admin_role() {
        insert_data!(:tx, :user, :org, :course);
        let admin_context = context(
            Some(user),
            Some(course),
            vec![global_role(user, UserRole::Admin)],
        );
        assert!(
            ToolPermission::GlobalAdmin
                .is_satisfied_by(tx.as_mut(), &admin_context)
                .await
                .expect("the check completes")
        );

        let teacher_context = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );
        assert!(
            !ToolPermission::GlobalAdmin
                .is_satisfied_by(tx.as_mut(), &teacher_context)
                .await
                .expect("the check completes")
        );

        let tals_context = context(
            Some(user),
            Some(course),
            vec![global_role(user, UserRole::TeachingAndLearningServices)],
        );
        assert!(
            !ToolPermission::GlobalAdmin
                .is_satisfied_by(tx.as_mut(), &tals_context)
                .await
                .expect("the check completes")
        );
    }
}
