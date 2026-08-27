//! What a chatbot tool requires of the caller before it is offered to the LLM, again before an
//! answer to it is applied, and once more before a confirmed answer runs a mutation.

use std::marker::PhantomData;

use headless_lms_authorization::{
    Action, AuthorizationToken, Resource, authorize_with_fetched_list_of_roles,
    error::AuthorizationErrorType, is_permitted, skip_authorize,
};

use crate::{chatbot_tools::ChatbotToolDeclaration, prelude::*, user_context::ChatbotTurnContext};

/// The privilege levels a chatbot tool can require.
///
/// Every variant above [ToolPermission::Anyone] is a question the application's existing
/// authorization vocabulary already answers, so a tool cannot bring a policy of its own.
///
/// A variant says what the caller may do, never what the call targets: an action tool takes its
/// target user and course from model-produced arguments, and nothing here checks those. Only
/// [GlobalAdmin](Self::GlobalAdmin) being global closes that gap. An action tool declaring
/// [TeachesCourse](Self::TeachesCourse) would let a teacher of one course act on another, and
/// needs per-argument authorization first — see
/// [resolve_course_scope](crate::chatbot_tools::course_scope::resolve_course_scope).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolPermission {
    /// Anyone the chatbot itself is open to, including an anonymous visitor of a public chatbot.
    Anyone,
    /// May teach the course the chatbot belongs to: [Action::Teach] on it.
    TeachesCourse,
    /// Holds a global admin role: [Action::Administrate] on [Resource::GlobalPermissions].
    GlobalAdmin,
}

/// What a [ToolPermission] amounts to for one particular turn, so that the boolean answer and the
/// token-producing answer cannot decide it differently.
enum RequiredCheck {
    /// Nothing beyond the chatbot's own access check.
    Unnecessary,
    /// Cannot hold: this turn has nothing to check it against.
    Impossible,
    On(Action, Resource),
}

impl ToolPermission {
    /// Whether the caller described by `user_context` holds this permission.
    ///
    /// A denial is `Ok(false)`; the error case is a check that could not be made at all. Use
    /// [authorize_tool] instead where the answer has to gate a mutation, since a bare `false`
    /// leaves nothing behind to prove the check happened.
    pub async fn is_satisfied_by(
        self,
        conn: &mut PgConnection,
        user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<bool> {
        match self.required_check(user_context) {
            RequiredCheck::Unnecessary => Ok(true),
            RequiredCheck::Impossible => Ok(false),
            RequiredCheck::On(action, resource) => {
                let roles = user_context.roles(conn).await?;
                Ok(is_permitted(conn, action, resource, roles).await?)
            }
        }
    }

    fn required_check(self, user_context: &ChatbotTurnContext) -> RequiredCheck {
        match self {
            Self::Anyone => RequiredCheck::Unnecessary,
            // An anonymous caller holds no role, so anything above `Anyone` is settled without a
            // query.
            _ if user_context.user_id.is_none() => RequiredCheck::Impossible,
            Self::TeachesCourse => match user_context.course_id {
                Some(course_id) => RequiredCheck::On(Action::Teach, Resource::Course(course_id)),
                // A chatbot that belongs to no course has no course permissions to hold.
                None => RequiredCheck::Impossible,
            },
            Self::GlobalAdmin => {
                RequiredCheck::On(Action::Administrate, Resource::GlobalPermissions)
            }
        }
    }
}

/// Proof that the caller was checked against `Tool`'s [ToolPermission] before the tool ran.
///
/// Wraps the application-wide [AuthorizationToken] and adds the two things a chatbot tool
/// boundary needs that a controller's does not: *which* tool the check was for, as the type
/// parameter, so a proof minted for one tool cannot be handed to another; and *who* was checked,
/// so an audit row cannot name a user the check never saw. Every field is private, so
/// [authorize_tool] is the only way to obtain one.
pub struct ToolAuthorization<Tool> {
    acting_user_id: Uuid,
    /// Kept only as evidence that the ordinary `authorize` path produced a token for this caller.
    _authorization: AuthorizationToken,
    _tool: PhantomData<fn() -> Tool>,
}

impl<Tool> ToolAuthorization<Tool> {
    /// The user whose permission was verified, and therefore the one an action tool must record
    /// as the actor.
    pub fn acting_user_id(&self) -> Uuid {
        self.acting_user_id
    }
}

/// Proof that `user_context`'s caller may use `Tool`, or `None` when they may not.
///
/// `None` covers a caller who lacks [ChatbotToolDeclaration::PERMISSION] and one who is not
/// logged in at all: whatever runs behind this proof records an actor, and an anonymous caller is
/// nobody. A denial is not an error because the chatbot answers one by telling the model the call
/// was aborted rather than by failing the request; the error case is a check that could not be
/// made.
pub async fn authorize_tool<Tool: ChatbotToolDeclaration>(
    conn: &mut PgConnection,
    user_context: &ChatbotTurnContext,
) -> ChatbotResult<Option<ToolAuthorization<Tool>>> {
    let Some(acting_user_id) = user_context.user_id else {
        return Ok(None);
    };
    let Some(authorization) = authorization_token_for(conn, user_context, Tool::PERMISSION).await?
    else {
        return Ok(None);
    };
    Ok(Some(ToolAuthorization {
        acting_user_id,
        _authorization: authorization,
        _tool: PhantomData,
    }))
}

/// The [AuthorizationToken] behind `permission`, or `None` when the caller does not hold it.
async fn authorization_token_for(
    conn: &mut PgConnection,
    user_context: &ChatbotTurnContext,
    permission: ToolPermission,
) -> ChatbotResult<Option<AuthorizationToken>> {
    let (action, resource) = match permission.required_check(user_context) {
        RequiredCheck::Unnecessary => return Ok(Some(skip_authorize())),
        RequiredCheck::Impossible => return Ok(None),
        RequiredCheck::On(action, resource) => (action, resource),
    };
    let roles = user_context.roles(conn).await?;
    match authorize_with_fetched_list_of_roles(conn, action, resource, roles).await {
        Ok(token) => Ok(Some(token)),
        Err(error)
            if matches!(
                error.error_type(),
                AuthorizationErrorType::Forbidden | AuthorizationErrorType::Unauthorized
            ) =>
        {
            Ok(None)
        }
        Err(error) => Err(error.into()),
    }
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use headless_lms_models::{
        chatbot_configurations::ToolCategory,
        roles::{Role, UserRole},
    };
    use uuid::Uuid;

    use crate::{
        chatbot_tools::tool_category::EnabledToolCategories, user_context::ChatbotTurnContext,
    };

    /// A caller whose roles are known already, so that a test does not have to seed them into the
    /// database. Every category is enabled, so this is for tests of permissions, not categories.
    pub fn context(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        roles: Vec<Role>,
    ) -> ChatbotTurnContext {
        ChatbotTurnContext::with_roles(user_id, course_id, None, roles)
    }

    /// Like [context], but with a specific enabled-category set instead of everything enabled —
    /// for tests of the category gate.
    pub fn context_with_categories(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        roles: Vec<Role>,
        categories: &[ToolCategory],
    ) -> ChatbotTurnContext {
        ChatbotTurnContext::with_roles_and_categories(
            user_id,
            course_id,
            None,
            roles,
            EnabledToolCategories::only(categories),
        )
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

    /// The proof an action tool needs exists only for a caller who passes the tool's own
    /// permission: a mutation cannot be reached by a caller the check would have refused, and the
    /// actor it names is the caller that was checked.
    #[tokio::test]
    async fn only_a_permitted_caller_gets_a_tool_authorization() {
        use crate::chatbot_tools::action_tools::edit_user_account::EditUserAccountTool;

        insert_data!(:tx, :user, :org, :course);

        let learner = context(Some(user), Some(course), Vec::new());
        assert!(
            authorize_tool::<EditUserAccountTool>(tx.as_mut(), &learner)
                .await
                .expect("the check completes")
                .is_none()
        );

        let anonymous = context(None, Some(course), Vec::new());
        assert!(
            authorize_tool::<EditUserAccountTool>(tx.as_mut(), &anonymous)
                .await
                .expect("the check completes")
                .is_none()
        );

        let admin = context(
            Some(user),
            Some(course),
            vec![global_role(user, UserRole::Admin)],
        );
        let authorization = authorize_tool::<EditUserAccountTool>(tx.as_mut(), &admin)
            .await
            .expect("the check completes")
            .expect("an admin is authorized");
        assert_eq!(authorization.acting_user_id(), user);
    }
}
