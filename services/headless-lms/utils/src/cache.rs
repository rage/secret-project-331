//! Redis cache wrapper.

use crate::prelude::*;
use redis::{AsyncCommands, Client, ToRedisArgs};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

/// Wrapper for accessing a redis cache.
#[derive(Debug)]
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

    /// Retrieves a value from cache, or executes the provided function to generate and cache the value.
    ///
    /// First checks if the key exists in the cache. If it does, returns the cached value.
    /// If not, executes the provided async function, caches its result, and returns it.
    pub async fn get_or_set<V, F, Fut, K>(
        &self,
        key: K,
        expires_in: Duration,
        f: F,
    ) -> UtilResult<V>
    where
        V: DeserializeOwned + Serialize,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = UtilResult<V>>,
        K: ToRedisArgs + Send + Sync + Clone + std::fmt::Debug,
    {
        // First try to get from cache
        if let Some(cached) = self.get_json::<V>(key.clone()).await {
            info!("Cache hit for key: {:?}", key);
            return Ok(cached);
        }

        info!("Cache miss for key: {:?}", key);

        // If not in cache, execute the function and measure time
        let start = std::time::Instant::now();
        let value = f().await?;
        let duration = start.elapsed();
        info!("Generated value for key {:?} in {:?}", key, duration);

        // Store in cache
        if !self.cache_json(key.clone(), &value, expires_in).await {
            warn!("Failed to cache value for key: {:?}", key);
        }
        Ok(value)
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
        match self.client.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                let Ok(value) = serde_json::to_vec(value) else {
                    return false;
                };
                match conn
                    .set_ex::<_, _, ()>(key, value, expires_in.as_secs())
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
        match self.client.get_multiplexed_async_connection().await {
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

#[cfg(test)]
mod test {
    use super::*;
    use serde::Deserialize;

    #[tokio::test]
    async fn caches() {
        tracing_subscriber::fmt().init();
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or("redis://redis.default.svc.cluster.local/1".to_string());
        info!("Redis URL: {redis_url}");

        #[derive(Deserialize, Serialize)]
        struct S {
            field: String,
        }

        let cache = Cache::new(&redis_url).await;
        let value = S {
            field: "value".to_string(),
        };
        assert!(
            cache
                .cache_json("key", &value, Duration::from_secs(10))
                .await
        );
        let value = cache.get_json::<S>("key").await.unwrap();
        assert_eq!(value.field, "value")
    }
}
