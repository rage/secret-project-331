use crate::{
    domain::authorization::{self, LoginToken},
    prelude::*,
};
use actix_web::{FromRequest, http::header};
use futures_util::{FutureExt, future::LocalBoxFuture};
use headless_lms_utils::cache::Cache;
use models::users::User;
use oauth2::TokenResponse;
use std::ops::{Deref, DerefMut};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct AuthToken(User);

impl Deref for AuthToken {
    type Target = User;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for AuthToken {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl FromRequest for AuthToken {
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
            .and_then(|h| h.strip_prefix("Bearer ").map(str::to_string));
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
                        let token = LoginToken::new(
                            oauth2::AccessToken::new(token),
                            oauth2::basic::BasicTokenType::Bearer,
                            oauth2::EmptyExtraTokenFields {},
                        );
                        let user =
                            authorization::get_user_from_moocfi_by_login_token(&token, &mut conn)
                                .await?;
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

#[derive(Debug, Deserialize)]
#[allow(unused)]
struct TmcUser {
    id: i32,
    username: String,
    email: String,
    administrator: bool,
}

pub async fn cache_user(cache: &Cache, token: &LoginToken, user: &User) {
    cache
        .cache_json(
            token.access_token().secret(),
            user,
            Duration::from_secs(60 * 60),
        )
        .await;
}

pub async fn load_user(cache: &Cache, token: &str) -> Option<User> {
    cache.get_json(token).await
}
