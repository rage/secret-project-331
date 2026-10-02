//! What a chatbot tool requires of its caller: checked against the turn before the tool is
//! offered to the LLM, and against the call's own arguments before it runs.
//!
//! A tool states its requirements in the application's own authorization vocabulary rather than a
//! chatbot-local one, so a tool cannot bring a policy of its own and the chatbot cannot drift from
//! what the equivalent HTTP endpoint allows.

use std::marker::PhantomData;

use headless_lms_authorization::{
    Action, AuthorizationToken, Resource,
    authorize_access_to_course_material_with_fetched_list_of_roles,
    authorize_with_fetched_list_of_roles, error::AuthorizationErrorType, skip_authorize,
};

use crate::{prelude::*, user_context::ChatbotTurnContext};

/// One check a tool's caller must pass. A tool lists every resource its call touches; all of them
/// must pass, so a call naming both a user and a course is authorized for both.
#[derive(Debug, Clone, PartialEq)]
pub enum ToolRequirement {
    /// The ordinary application check, exactly as a controller would make it.
    ActionOnResource(Action, Resource),
    /// Access to a course's material, as `authorize_access_to_course_material` decides it: draft
    /// state, joinability and anonymous access included. Not expressible as an action on a
    /// resource, which is why it is its own variant.
    CourseMaterial(Uuid),
}

impl ToolRequirement {
    /// A check against the course the call names.
    pub fn on_course(action: Action, course_id: Uuid) -> Self {
        Self::ActionOnResource(action, Resource::Course(course_id))
    }

    /// A check against the user the call targets. Only a global role can hold anything on a user,
    /// so this is a global capability that names its target rather than a per-user rule.
    pub fn on_user(action: Action, user_id: Uuid) -> Self {
        Self::ActionOnResource(action, Resource::User(user_id))
    }

    /// A check against the turn itself, for deciding what to offer the LLM before any call has
    /// named a target: the chatbot's own course, or global permissions when it has none.
    pub fn on_turn(action: Action, user_context: &ChatbotTurnContext) -> Self {
        Self::ActionOnResource(action, user_context.turn_resource())
    }

    /// A global capability, held only through a global role.
    pub fn global(action: Action) -> Self {
        Self::ActionOnResource(action, Resource::GlobalPermissions)
    }
}

/// The token proving `requirements` all passed, or `None` when any of them did not.
///
/// A denial is not an error: the chatbot answers one by telling the model the call was aborted,
/// not by failing the request. The error case is a check that could not be completed.
///
/// An empty slice passes without a query, for a tool the chatbot's own access check already
/// covers.
async fn authorize_requirements(
    conn: &mut PgConnection,
    user_context: &ChatbotTurnContext,
    requirements: &[ToolRequirement],
) -> ChatbotResult<Option<AuthorizationToken>> {
    let mut token = skip_authorize();
    for requirement in requirements {
        let roles = user_context.roles(conn).await?;
        let outcome = match requirement {
            ToolRequirement::ActionOnResource(action, resource) => {
                authorize_with_fetched_list_of_roles(conn, *action, resource.clone(), roles).await
            }
            ToolRequirement::CourseMaterial(course_id) => {
                authorize_access_to_course_material_with_fetched_list_of_roles(
                    conn,
                    user_context.user_id,
                    *course_id,
                    roles,
                )
                .await
            }
        };
        match outcome {
            Ok(granted) => token = granted,
            Err(error)
                if matches!(
                    error.error_type(),
                    AuthorizationErrorType::Forbidden | AuthorizationErrorType::Unauthorized
                ) =>
            {
                return Ok(None);
            }
            Err(error) => return Err(error.into()),
        }
    }
    Ok(Some(token))
}

/// Whether `requirements` all pass, for the callers that decide what to offer or whether to abort
/// rather than gating a mutation.
pub async fn requirements_are_satisfied(
    conn: &mut PgConnection,
    user_context: &ChatbotTurnContext,
    requirements: &[ToolRequirement],
) -> ChatbotResult<bool> {
    Ok(authorize_requirements(conn, user_context, requirements)
        .await?
        .is_some())
}

/// Proof that the caller was authorized for `Tool` before the tool ran.
///
/// Wraps the application-wide [AuthorizationToken] and adds the two things a chatbot tool boundary
/// needs that a controller's does not: *which* tool the check was for, as the type parameter, so a
/// proof minted for one tool cannot be handed to another; and *who* was checked, so an audit row
/// cannot name a user the check never saw. Every field is private, so [authorize_tool_call] is the
/// only way to obtain one.
pub struct ToolAuthorization<Tool> {
    acting_user_id: Uuid,
    /// Kept only as evidence that the ordinary `authorize` path produced a token for this caller.
    _authorization: AuthorizationToken,
    _tool: PhantomData<fn() -> Tool>,
}

impl<Tool> ToolAuthorization<Tool> {
    /// The user whose permission was verified, and therefore the one an action tool must record as
    /// the actor.
    pub fn acting_user_id(&self) -> Uuid {
        self.acting_user_id
    }
}

/// Proof that the caller may make this call of `Tool`, or `None` when they may not.
///
/// `requirements` are the ones the call's own arguments produce, not the ones the turn was offered
/// under: the target is chosen by the model, so it is the target that has to be authorized.
/// `None` also covers a caller who is not logged in, since whatever runs behind this proof records
/// an actor and an anonymous caller is nobody.
pub async fn authorize_tool_call<Tool>(
    conn: &mut PgConnection,
    user_context: &ChatbotTurnContext,
    requirements: &[ToolRequirement],
) -> ChatbotResult<Option<ToolAuthorization<Tool>>> {
    let Some(acting_user_id) = user_context.user_id else {
        return Ok(None);
    };
    let Some(authorization) = authorize_requirements(conn, user_context, requirements).await?
    else {
        return Ok(None);
    };
    Ok(Some(ToolAuthorization {
        acting_user_id,
        _authorization: authorization,
        _tool: PhantomData,
    }))
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
    /// database. Every category is enabled, so this is for tests of authorization, not categories.
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

    /// A tool the chatbot's own access check already covers asks nothing further, of anyone.
    #[tokio::test]
    async fn no_requirements_pass_for_an_anonymous_caller() {
        insert_data!(:tx, :user, :org, :course);
        let anonymous = context(None, Some(course), Vec::new());

        assert!(
            requirements_are_satisfied(tx.as_mut(), &anonymous, &[])
                .await
                .expect("the check completes")
        );
    }

    /// The point of the whole scheme: the course a call names decides the answer, not the course
    /// the chatbot happens to sit on.
    #[tokio::test]
    async fn a_teacher_is_authorized_only_on_the_course_they_teach() {
        insert_data!(:tx, :user, :org, :course);
        let requirement = [ToolRequirement::on_course(Action::Teach, course)];

        let teacher_here = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );
        assert!(
            requirements_are_satisfied(tx.as_mut(), &teacher_here, &requirement)
                .await
                .expect("the check completes")
        );

        let teacher_elsewhere = context(
            Some(user),
            Some(course),
            vec![course_role(user, Uuid::new_v4(), UserRole::Teacher)],
        );
        assert!(
            !requirements_are_satisfied(tx.as_mut(), &teacher_elsewhere, &requirement)
                .await
                .expect("the check completes"),
            "a teacher of another course must not be authorized on this one"
        );
    }

    /// Every requirement has to pass: a caller who holds one but not the other is refused.
    #[tokio::test]
    async fn requirements_are_all_required() {
        insert_data!(:tx, :user, :org, :course);
        let teacher = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );

        assert!(
            !requirements_are_satisfied(
                tx.as_mut(),
                &teacher,
                &[
                    ToolRequirement::on_course(Action::Teach, course),
                    ToolRequirement::global(Action::AdministrateUserAccount),
                ]
            )
            .await
            .expect("the check completes")
        );
    }

    /// Account administration is deliberately out of reach of course roles, and naming the target
    /// user does not widen it.
    #[tokio::test]
    async fn account_administration_needs_a_global_admin() {
        insert_data!(:tx, :user, :org, :course);
        let requirement = [ToolRequirement::on_user(
            Action::AdministrateUserAccount,
            user,
        )];

        let teacher = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );
        assert!(
            !requirements_are_satisfied(tx.as_mut(), &teacher, &requirement)
                .await
                .expect("the check completes")
        );

        let admin = context(
            Some(user),
            Some(course),
            vec![global_role(user, UserRole::Admin)],
        );
        assert!(
            requirements_are_satisfied(tx.as_mut(), &admin, &requirement)
                .await
                .expect("the check completes")
        );
    }

    /// The proof exists only for a caller the check would have let through, and the actor it names
    /// is the caller that was checked.
    #[tokio::test]
    async fn only_an_authorized_caller_gets_a_tool_authorization() {
        struct SomeTool;

        insert_data!(:tx, :user, :org, :course);
        let requirement = [ToolRequirement::global(Action::AdministrateUserAccount)];

        let learner = context(Some(user), Some(course), Vec::new());
        assert!(
            authorize_tool_call::<SomeTool>(tx.as_mut(), &learner, &requirement)
                .await
                .expect("the check completes")
                .is_none()
        );

        let anonymous = context(None, Some(course), Vec::new());
        assert!(
            authorize_tool_call::<SomeTool>(tx.as_mut(), &anonymous, &requirement)
                .await
                .expect("the check completes")
                .is_none()
        );

        let admin = context(
            Some(user),
            Some(course),
            vec![global_role(user, UserRole::Admin)],
        );
        let authorization = authorize_tool_call::<SomeTool>(tx.as_mut(), &admin, &requirement)
            .await
            .expect("the check completes")
            .expect("an admin is authorized");
        assert_eq!(authorization.acting_user_id(), user);
    }
}
