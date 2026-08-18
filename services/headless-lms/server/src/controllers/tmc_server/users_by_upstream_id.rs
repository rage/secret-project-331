/*!
Handlers for HTTP requests to `/api/v0/tmc-server/users-by-upstream-id`.

These endpoints are used by the TMC server so that it can integrate with this system.
*/

use crate::{
    domain::authorization::{
        authorize_access_from_tmc_server_to_course_mooc_fi,
        get_or_create_user_from_tmc_mooc_fi_response,
    },
    prelude::*,
};
use headless_lms_utils::services::tmc::TmcClient;
use models::users::User;

/**
GET `/api/v0/tmc-server/users-by-upstream-id/:id` Endpoint that TMC server uses to get user information by using its own ids.

Only works if the authorization header is set to a secret value.
*/
#[instrument(skip(pool))]
pub async fn get_user_by_upstream_id(
    upstream_id: web::Path<i32>,
    pool: web::Data<PgPool>,
    request: HttpRequest,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_access_from_tmc_server_to_course_mooc_fi(&request).await?;
    let tmc_user = tmc_client
        .get_user_from_tmc_mooc_fi_by_tmc_access_token_and_upstream_id(&upstream_id)
        .await?;

    debug!(
        "Creating or fetching user with TMC id {} and mooc.fi UUID {}",
        tmc_user.id,
        tmc_user
            .courses_mooc_fi_user_id
            .map(|uuid| uuid.to_string())
            .unwrap_or_else(|| "None (will generate new UUID)".to_string())
    );
    let user = get_or_create_user_from_tmc_mooc_fi_response(
        &mut conn,
        tmc_user,
        tmc_client.get_admin_access_token(),
    )
    .await?;
    info!(
        "Successfully got user details from mooc.fi for user {}",
        user.id
    );

    token.authorized_ok(web::Json(user))
}

#[derive(Debug, Serialize)]
pub struct UserMigrationStatusResponse {
    pub shadow_user_exists: bool,
    pub courses_mooc_fi_user_id: Option<Uuid>,
    pub password_set: bool,
    pub deleted_at: Option<DateTime<Utc>>,
}

/**
GET `/api/v0/tmc-server/users-by-upstream-id/:id/status` Read-only status check for the TMC
server's admin UI: does a courses.mooc.fi shadow user exist for this upstream id, and does it
already have a password set. Unlike `get_user_by_upstream_id`, this never calls tmc.mooc.fi and
never creates a user -- it's a plain read, safe to call on every admin page view.

Only works if the authorization header is set to a secret value.
*/
#[instrument(skip(pool))]
pub async fn get_migration_status_by_upstream_id(
    upstream_id: web::Path<i32>,
    pool: web::Data<PgPool>,
    request: HttpRequest,
) -> ControllerResult<web::Json<UserMigrationStatusResponse>> {
    let token = authorize_access_from_tmc_server_to_course_mooc_fi(&request).await?;
    let mut conn = pool.acquire().await?;

    let response = match models::users::find_by_upstream_id(&mut conn, *upstream_id).await? {
        Some(user) => {
            let password_set =
                models::user_passwords::check_if_users_password_is_stored(&mut conn, user.id)
                    .await?;
            UserMigrationStatusResponse {
                shadow_user_exists: true,
                courses_mooc_fi_user_id: Some(user.id),
                password_set,
                deleted_at: user.deleted_at,
            }
        }
        None => UserMigrationStatusResponse {
            shadow_user_exists: false,
            courses_mooc_fi_user_id: None,
            password_set: false,
            deleted_at: None,
        },
    };

    token.authorized_ok(web::Json(response))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{user_id}", web::get().to(get_user_by_upstream_id))
        .route(
            "/{user_id}/status",
            web::get().to(get_migration_status_by_upstream_id),
        );
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;
    use models::user_passwords;
    use models::users;
    use secrecy::SecretString;

    #[actix_web::test]
    async fn migration_status_reflects_shadow_user_and_password_state() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let upstream_id = 987_654_321;
        let moocfi_id = Uuid::new_v4();

        assert!(
            users::find_by_upstream_id(tx.as_mut(), upstream_id)
                .await
                .unwrap()
                .is_none()
        );

        let user = users::insert_with_upstream_id_and_moocfi_id(
            tx.as_mut(),
            "migration-status-test@example.com",
            None,
            None,
            upstream_id,
            moocfi_id,
        )
        .await
        .unwrap();

        let found = users::find_by_upstream_id(tx.as_mut(), upstream_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(found.id, user.id);
        assert!(
            !user_passwords::check_if_users_password_is_stored(tx.as_mut(), user.id)
                .await
                .unwrap()
        );

        let hash =
            user_passwords::hash_password(&SecretString::new("test-password".to_string().into()))
                .unwrap();
        user_passwords::upsert_user_password(tx.as_mut(), user.id, &hash)
            .await
            .unwrap();

        assert!(
            user_passwords::check_if_users_password_is_stored(tx.as_mut(), user.id)
                .await
                .unwrap()
        );
    }
}
