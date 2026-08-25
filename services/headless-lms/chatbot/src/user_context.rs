use headless_lms_authorization::fetch_user_roles;
use headless_lms_models::roles::Role;
use tokio::sync::OnceCell;

use crate::chatbot_error::ChatbotResult;
use crate::prelude::*;

/// Context about the user and course for a chatbot interaction.
/// Passed to tool implementations so they can access user-specific data.
pub struct ChatbotUserContext {
    pub user_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub course_name: Option<String>,
    /// The conversation this turn belongs to. `None` only in tests that build a context without
    /// one; every production call site has a conversation id in scope.
    pub conversation_id: Option<Uuid>,
    roles: OnceCell<Vec<Role>>,
}

impl ChatbotUserContext {
    /// Collects what a chatbot request needs to know about its caller.
    pub fn new(
        user_id: Option<Uuid>,
        course_id: Option<Uuid>,
        course_name: Option<String>,
        conversation_id: Uuid,
    ) -> Self {
        Self {
            user_id,
            course_id,
            course_name,
            conversation_id: Some(conversation_id),
            roles: OnceCell::new(),
        }
    }

    /// The caller's roles, fetched the first time a tool permission needs them.
    ///
    /// One roles query per request however many tool permissions ask for them, and none at all
    /// for a request whose tools need no role.
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
        Self {
            user_id,
            course_id,
            course_name,
            conversation_id: None,
            roles: OnceCell::new_with(Some(roles)),
        }
    }
}
