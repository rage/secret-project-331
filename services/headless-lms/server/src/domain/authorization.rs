//! Actix plumbing around the authorization policy engine in [headless_lms_authorization].

use crate::prelude::*;
use actix_web::{HttpRequest, Responder};

pub use headless_lms_authorization::error::{AuthorizationError, AuthorizationErrorType};
pub use headless_lms_authorization::{
    Action, ActionOnResource, AuthorizationToken, Resource, authorize, authorize_access_to_chatbot,
    authorize_access_to_course_material, authorize_with_fetched_list_of_roles,
    can_user_view_chapter, is_permitted, is_user_global_admin, skip_authorize,
};

/// A controller's response payload. Only [AuthorizedOk::authorized_ok] can build one, so
/// answering a request requires having passed an authorization check.
#[derive(Copy, Clone)]
pub struct AuthorizedResponse<T> {
    pub data: T,
}

impl<T: Responder> Responder for AuthorizedResponse<T> {
    type Body = T::Body;

    fn respond_to(self, req: &HttpRequest) -> actix_web::HttpResponse<Self::Body> {
        T::respond_to(self.data, req)
    }
}

/// Turns a token into a [ControllerResult], which is the only way for a controller to build
/// one. Lives here rather than on [AuthorizationToken] itself because the response type is
/// tied to actix, which the policy engine deliberately does not depend on.
pub trait AuthorizedOk {
    fn authorized_ok<T>(self, t: T) -> ControllerResult<T>;
}

impl AuthorizedOk for AuthorizationToken {
    fn authorized_ok<T>(self, t: T) -> ControllerResult<T> {
        Ok(AuthorizedResponse { data: t })
    }
}

#[cfg(test)]
mod test {
    use super::*;
    // Explicit: a workspace-wide test build enables the models crate's test-helpers feature, whose
    // own insert_data! then clashes with ours in the globs below.
    use crate::insert_data;
    use crate::test_helper::*;
    use headless_lms_models::*;
    use models::roles::{RoleDomain, UserRole};

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
        let org = organizations::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "auth",
            "auth",
            Some("auth"),
            false,
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
