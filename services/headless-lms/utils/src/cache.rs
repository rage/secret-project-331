//! Redis cache wrapper.

use redis::{AsyncCommands, Client, ToRedisArgs};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

/// Wrapper for accessing a redis cache.
pub struct Cache {
    client: Client,
}

impl Cache {
    /// # Panics
    /// If the URL is malformed.
    pub async fn new(redis_url: &str) -> Self {
        let client =
            Client::open(redis_url).unwrap_or_else(|_| panic!("Malformed url: {redis_url}"));
        Self { client }
    }

    /// Stores the given value in the redis cache as JSON (`Vec<u8>`).
    pub async fn cache_json<V>(
        &self,
        key: impl ToRedisArgs + Send + Sync,
        value: &V,
        expires_in: Duration,
    ) -> bool
    where
        V: Serialize,
    {
        match self.client.get_async_connection().await {
            Ok(mut conn) => {
                let Ok(value) = serde_json::to_vec(value) else {
                  return false;
              };
                match conn
                    .set_ex::<_, _, ()>(key, value, expires_in.as_secs() as usize)
                    .await
                {
                    Ok(_) => true,
                    Err(err) => {
                        error!("Error caching json: {err:#}");
                        false
                    }
                }
            }
            Err(err) => {
                error!("Error connecting to redis: {err:#}");
                false
            }
        }
    }

    /// Retrieves and deserializes the corresponding value for the key stored with `cache_json`.
    pub async fn get_json<V>(&self, key: impl ToRedisArgs + Send + Sync) -> Option<V>
    where
        V: DeserializeOwned,
    {
        match self.client.get_async_connection().await {
            Ok(mut conn) => match conn.get::<_, Vec<u8>>(key).await {
                Ok(bytes) => {
                    let value = serde_json::from_slice(bytes.as_slice()).ok()?;
                    Some(value)
                }
                Err(err) => {
                    error!("Error fetching json from cache: {err:#}");
                    None
                }
            },
            Err(err) => {
                error!("Error connecting to redis: {err:#}");
                None
            }
        }
    }
}
