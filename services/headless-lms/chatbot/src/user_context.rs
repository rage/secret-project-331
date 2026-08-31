use headless_lms_authorization::{Resource, fetch_user_roles};
use headless_lms_models::chatbot_configurations::ChatbotConfiguration;
use headless_lms_models::roles::Role;
use tokio::sync::OnceCell;

use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::tool_category::EnabledToolCategories;
use crate::prelude::*;

/// Context for a chatbot turn, in two halves:
/// - who is asking: `user_id`, `course_id`, `course_name`, and the roles fetched from them.
/// - what the configuration offers: `enabled_tool_categories`, read once per request from the
///   same configuration row the turn is assembled from.
pub struct ChatbotTurnContext {
    pub user_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub course_name: Option<String>,
    /// The conversation this turn belongs to. `None` only in tests that build a context without
    /// one; every production call site has a conversation id in scope.
    pub conversation_id: Option<Uuid>,
    pub enabled_tool_categories: EnabledToolCategories,
    roles: OnceCell<Vec<Role>>,
}

impl ChatbotTurnContext {
    /// Collects what a chatbot request needs to know about its caller and about what the
    /// chatbot's configuration offers.
    pub fn new(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        course_name: Option<String>,
        conversation_id: Uuid,
        configuration: &ChatbotConfiguration,
    ) -> Self {
        Self {
            user_id,
            course_id,
            course_name,
            conversation_id: Some(conversation_id),
            enabled_tool_categories: EnabledToolCategories::from_configuration(configuration),
            roles: OnceCell::new(),
        }
    }

    /// The resource an offer-time check runs against, before any call has named a target: the
    /// course this chatbot belongs to, or global permissions for a chatbot that belongs to none.
    pub fn turn_resource(&self) -> Resource {
        match self.course_id {
            Some(course_id) => Resource::Course(course_id),
            None => Resource::GlobalPermissions,
        }
    }

    /// The caller's roles, fetched the first time an authorization check needs them.
    ///
    /// One roles query per request however many authorization checks ask for them, and none at
    /// all for a request whose tools need no role.
    pub(crate) async fn roles(&self, conn: &mut PgConnection) -> ChatbotResult<&[Role]> {
        let roles = self
            .roles
            .get_or_try_init(|| async {
                fetch_user_roles(conn, self.user_id)
                    .await
                    .map_err(ChatbotError::from)
            })
            .await?;
        Ok(roles)
    }

    #[cfg(test)]
    pub(crate) fn with_roles(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        course_name: Option<String>,
        roles: Vec<Role>,
    ) -> Self {
        Self::with_roles_and_categories(
            user_id,
            course_id,
            course_name,
            roles,
            EnabledToolCategories::all(),
        )
    }

    /// Like [Self::with_roles], but with a specific enabled-category set instead of everything
    /// enabled — for tests of the category gate itself rather than of authorization.
    #[cfg(test)]
    pub(crate) fn with_roles_and_categories(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        course_name: Option<String>,
        roles: Vec<Role>,
        enabled_tool_categories: EnabledToolCategories,
    ) -> Self {
        Self {
            user_id,
            course_id,
            course_name,
            conversation_id: None,
            enabled_tool_categories,
            roles: OnceCell::new_with(Some(roles)),
        }
    }
}
