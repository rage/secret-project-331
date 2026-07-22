use crate::{
    domain::authorization::{self, get_or_create_user_from_tmc_mooc_fi_response},
    prelude::*,
};
use actix_web::{FromRequest, http::header};
use futures_util::{FutureExt, future::LocalBoxFuture};
use headless_lms_utils::{cache::Cache, services::tmc::TmcClient};
use models::users::User;
use secrecy::{ExposeSecret, SecretString};
use std::ops::{Deref, DerefMut};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct UserFromTMCAccessToken(User);

impl Deref for UserFromTMCAccessToken {
    type Target = User;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for UserFromTMCAccessToken {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl FromRequest for UserFromTMCAccessToken {
    type Error = ControllerError;
    type Future = LocalBoxFuture<'static, Result<Self, ControllerError>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_http::Payload) -> Self::Future {
        let pool = req
            .app_data::<web::Data<PgPool>>()
            .expect("Missing database pool")
            .clone();
        let app_conf = req
            .app_data::<web::Data<ApplicationConfiguration>>()
            .expect("Missing application configuration")
            .clone();
        let cache = req
            .app_data::<web::Data<Cache>>()
            .expect("Missing cache")
            .clone();

        let auth_header = req
            .headers()
            .get(header::AUTHORIZATION)
            .map(|hv| String::from_utf8_lossy(hv.as_bytes()))
            .and_then(|h| h.strip_prefix("Bearer ").map(str::to_string))
            .map(|o| SecretString::new(o.into()));

        let tmc_client: web::Data<TmcClient> = req
            .app_data::<web::Data<TmcClient>>()
            .expect("Missing TMC client")
            .clone();
        async move {
            let Some(token) = auth_header else {
                return Err(ControllerError::new(
                    ControllerErrorType::Unauthorized,
                    "Missing bearer token".to_string(),
                    None,
                ));
            };
            let mut conn = pool.acquire().await?;

            let user = if app_conf.test_mode {
                warn!("Using test credentials. Normal accounts won't work.");
                authorization::authenticate_test_token(&mut conn, &token, &app_conf)
                    .await
                    .map_err(|err| {
                        ControllerError::new(
                            ControllerErrorType::Unauthorized,
                            "Could not find user".to_string(),
                            Some(err),
                        )
                    })?
            } else {
                match load_user(&cache, &token).await {
                    Some(user) => user,
                    None => {
                        let tmc_user = tmc_client
                            .get_user_from_tmc_mooc_fi_by_tmc_access_token(&token.clone())
                            .await
                            .map_err(map_tmc_token_validation_error)?;

                        debug!(
                            "Creating or fetching user with TMC id {} and mooc.fi UUID {}",
                            tmc_user.id,
                            tmc_user
                                .courses_mooc_fi_user_id
                                .map(|uuid| uuid.to_string())
                                .unwrap_or_else(|| "None (will generate new UUID)".to_string())
                        );
                        let user = get_or_create_user_from_tmc_mooc_fi_response(
                            &mut conn, tmc_user, &token,
                        )
                        .await?;
                        info!(
                            "Successfully got user details from mooc.fi for user {}",
                            user.id
                        );
                        cache_user(&cache, &token, &user).await;
                        user
                    }
                }
            };

            Ok(Self(user))
        }
        .boxed_local()
    }
}

/// Maps a TMC-access-token validation error to a controller error.
///
/// An upstream 401/403 means the token is invalid or expired, so we answer 401 and the
/// client clears its credentials and re-logs in. Anything else (TMC unreachable, an
/// upstream 5xx, a deserialization failure) is a transport/server problem, not a bad
/// token, and must stay a 5xx so a network blip does not silently log the user out.
fn map_tmc_token_validation_error(err: UtilError) -> ControllerError {
    let upstream_status = match err.error_type() {
        UtilErrorType::TmcHttpStatusError(status) => Some(*status),
        _ => None,
    };
    match upstream_status {
        Some(401) | Some(403) => ControllerError::new(
            ControllerErrorType::Unauthorized,
            "The TMC access token was rejected; it is invalid or expired.".to_string(),
            Some(err.into()),
        ),
        _ => err.into(),
    }
}

#[derive(Debug, Deserialize)]
#[allow(unused)]
struct TmcUser {
    id: i32,
    username: String,
    email: String,
    administrator: bool,
}

fn token_to_cache_key(token: &SecretString) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(token.expose_secret().as_bytes());
    format!("user:{}", hasher.finalize().to_hex())
}

pub async fn cache_user(cache: &Cache, token: &SecretString, user: &User) {
    cache
        .cache_json(
            token_to_cache_key(token),
            user,
            Duration::from_secs(60 * 60),
        )
        .await;
}

pub async fn load_user(cache: &Cache, token: &SecretString) -> Option<User> {
    cache.get_json(token_to_cache_key(token)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{ResponseError, http::StatusCode};

    fn map(error_type: UtilErrorType) -> StatusCode {
        let err = UtilError::new(error_type, "test error".to_string(), None);
        map_tmc_token_validation_error(err).status_code()
    }

    #[test]
    fn upstream_401_maps_to_unauthorized() {
        assert_eq!(
            map(UtilErrorType::TmcHttpStatusError(401)),
            StatusCode::UNAUTHORIZED
        );
    }

    #[test]
    fn upstream_403_maps_to_unauthorized() {
        assert_eq!(
            map(UtilErrorType::TmcHttpStatusError(403)),
            StatusCode::UNAUTHORIZED
        );
    }

    #[test]
    fn upstream_500_stays_internal_server_error() {
        assert_eq!(
            map(UtilErrorType::TmcHttpStatusError(500)),
            StatusCode::INTERNAL_SERVER_ERROR
        );
        assert_eq!(
            map(UtilErrorType::TmcHttpStatusError(503)),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[test]
    fn transport_failure_stays_internal_server_error() {
        assert_eq!(
            map(UtilErrorType::TmcHttpError),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[test]
    fn other_errors_stay_internal_server_error() {
        assert_eq!(
            map(UtilErrorType::DeserializationError),
            StatusCode::INTERNAL_SERVER_ERROR
        );
        assert_eq!(map(UtilErrorType::Other), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
