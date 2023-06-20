/*!
The server that handles the requests.

## See also

* [headless_lms_utils]
* [headless_lms_models]
*/

pub mod controllers;
pub mod domain;
pub mod prelude;

pub mod programs;
#[cfg(test)]
pub mod test_helper;
#[cfg(all(test, feature = "ts_rs"))]
pub mod ts_binding_generator;

#[macro_use]
extern crate tracing;

#[macro_use]
extern crate doc_macro;

use std::{fmt::Display, pin::Pin, sync::Arc};

use actix_http::{body::MessageBody, StatusCode};
use actix_web::{
    error::InternalError,
    web::{self, Data, ServiceConfig},
    HttpResponse,
};
use anyhow::Result;
use cached::{AsyncRedisCache, IOCachedAsync};
use controllers::auth::LoginToken;
use domain::{models_requests::JwtKey, request_span_middleware::RequestSpan};
use futures_util::{Future, FutureExt};
use headless_lms_models::users::User;
use headless_lms_utils::{file_store::FileStore, ApplicationConfiguration};
use oauth2::{basic::BasicClient, TokenResponse};
use serde::{de::DeserializeOwned, Serialize};
use tokio::sync::RwLock;
use tracing_error::ErrorLayer;
use tracing_log::LogTracer;
use tracing_subscriber::{layer::SubscriberExt, EnvFilter};

pub type OAuthClient = Arc<BasicClient>;

pub fn configure(
    config: &mut ServiceConfig,
    file_store: Arc<dyn FileStore>,
    app_conf: ApplicationConfiguration,
    jwt_key: JwtKey,
) {
    let json_config =
        web::JsonConfig::default()
            .limit(1048576)
            .error_handler(|err, _req| -> actix_web::Error {
                info!("Bad request: {}", &err);
                let body = format!("{{\"title\": \"Bad Request\", \"message\": \"{}\"}}", &err);
                // create custom error response
                let response = HttpResponse::with_body(StatusCode::BAD_REQUEST, body.boxed());
                InternalError::from_response(err, response).into()
            });
    config
        .app_data(json_config)
        .service(
            web::scope("/api/v0")
                .wrap(RequestSpan)
                .configure(controllers::configure_controllers),
        )
        // Not using Data::new for file_store to avoid double wrapping it in a arc
        .app_data(Data::from(file_store))
        .app_data(Data::new(app_conf))
        .app_data(Data::new(jwt_key));
}

/**
Sets up tokio tracing. Also makes sure that log statements from libraries respect the log level
settings that have been set with RUST_LOG, for example:

```no_run
use std::env;
env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
```
*/
pub fn setup_tracing() -> Result<()> {
    let subscriber = tracing_subscriber::Registry::default()
        .with(
            tracing_subscriber::fmt::layer()
                .event_format(tracing_subscriber::fmt::format().compact()),
        )
        .with(ErrorLayer::default())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    tracing::subscriber::set_global_default(subscriber)?;
    LogTracer::init()?;
    Ok(())
}

/// Wrapper for accessing a redis cache.
pub struct Cache {
    /// Cache for users that have authenticated using an access token through TMC.
    /// The hashed access token is used as the key.
    token_authenticated_users_cache: SpecializedCache<String, User>,
}

impl Cache {
    /// Initialises the cache and tries connecting to redis.
    /// If connecting fails, attempts to reconnect on each access.
    pub async fn new(redis_url: String) -> Self {
        let token_authenticated_users_cache =
            SpecializedCache::new("token_authenticated_users", &redis_url).await;
        Self {
            token_authenticated_users_cache,
        }
    }

    pub async fn cache_token_authenticated_user(&self, token: &LoginToken, user: User) -> bool {
        let hash = blake3::hash(token.access_token().secret().as_bytes()).to_string();
        self.token_authenticated_users_cache.set(hash, user).await
    }

    pub async fn get_token_authenticated_user(&self, token: &LoginToken) -> Option<User> {
        let hash = blake3::hash(token.access_token().secret().as_bytes()).to_string();
        let user = self.token_authenticated_users_cache.get(&hash).await?;
        Some(user)
    }
}

// helper types to make the code less busy
type BuilderFuture<K, V> = Pin<Box<dyn Future<Output = Option<AsyncRedisCache<K, V>>>>>;
type BuilderFn<K, V> = Box<dyn Fn() -> BuilderFuture<K, V> + Sync + Send>;
type RedisCache<K, V> = RwLock<Option<AsyncRedisCache<K, V>>>;

struct SpecializedCache<K, V> {
    prefix: String,
    url: String,
    builder: BuilderFn<K, V>,
    cache: RedisCache<K, V>,
}

impl<K, V> SpecializedCache<K, V>
where
    K: Display + Send + Sync,
    V: Serialize + DeserializeOwned + Send + Sync,
{
    async fn new(redis_prefix: &str, redis_url: &str) -> Self {
        let redis_prefix_clone = redis_prefix.to_string();
        let redis_url_clone = redis_url.to_string();
        let builder = move || {
            let redis_prefix = redis_prefix_clone.clone();
            let redis_url = redis_url_clone.clone();
            let users_future: BuilderFuture<K, V> = async move {
                let time_to_live_seconds = 60 * 60;
                match AsyncRedisCache::new(&redis_prefix, time_to_live_seconds)
                    .set_connection_string(&redis_url)
                    .build()
                    .await
                {
                    Ok(users) => {
                        info!("Successfully connected to redis cache '{redis_prefix}' at {redis_url}");
                        Some(users)
                    },
                    Err(err) => {
                        // anyhow gives us nicer formatting
                        let err = anyhow::format_err!(err);
                        error!(
                            "Failed to connect to redis cache '{redis_prefix}' at {redis_url}: {err:#}"
                        );
                        None
                    }
                }
            }
            .boxed();
            users_future
        };
        let builder = Box::new(builder);
        let cache = RwLock::new(builder().await);
        Self {
            prefix: redis_prefix.to_string(),
            url: redis_url.to_string(),
            builder,
            cache,
        }
    }

    async fn init_if_needed(&self) {
        let cache_read_guard = self.cache.read().await;
        if cache_read_guard.is_none() {
            drop(cache_read_guard);
            let mut cache_write_guard = self.cache.write().await;
            // another thread might have initialised it between here and the first check, so check again
            if cache_write_guard.is_none() {
                *cache_write_guard = (self.builder)().await;
            }
        }
    }

    /// Returns the value if it was found in the cache.
    /// It is not considered an error if the value was not found due to being unable to connect to redis etc.
    async fn get(&self, key: &K) -> Option<V> {
        self.init_if_needed().await;
        if let Some(cache) = self.cache.read().await.as_ref() {
            match cache.cache_get(key).await {
                Ok(val) => val,
                Err(err) => {
                    error!(
                        "Error while trying to get with key {key} from redis '{}' at {}: {err}",
                        self.prefix, self.url
                    );
                    None
                }
            }
        } else {
            None
        }
    }

    /// Returns true if the value was cached.
    /// It is not considered an error if the value was not cached due to being unable to connect to redis etc.
    async fn set(&self, key: K, val: V) -> bool {
        self.init_if_needed().await;
        if let Some(cache) = self.cache.read().await.as_ref() {
            match cache.cache_set(key, val).await {
                Ok(_) => true,
                Err(err) => {
                    let err = anyhow::format_err!(err);
                    error!(
                        "Error while trying to set in redis '{}' at {}: {err:#}",
                        self.prefix, self.url
                    );
                    false
                }
            }
        } else {
            // could not initialise cache
            false
        }
    }
}

/// Includes the type's JSON example and/or TypeScript definition
/// generated by doc-file-generator as a string.
/// Used with the helper macro from the doc-macro crate: #[generated_doc]
#[macro_export]
macro_rules! generated_docs {
    ($t: ty, ts) => {
        concat!(
            "## Response TypeScript definition\n",
            "```ts\n",
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/generated-docs/",
                stringify!($t),
                ".ts"
            )),
            "\n```\n",
        )
    };
    ($t: ty, json) => {
        concat!(
            "## Example response\n",
            "```json\n",
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/generated-docs/",
                stringify!($t),
                ".json"
            )),
            "\n```\n",
        )
    };
    ($t: ty) => {
        concat!(generated_docs!($t, ts), generated_docs!($t, json),)
    };
}
