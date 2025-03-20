//! Redis cache wrapper.

use crate::prelude::*;
use redis::{aio::ConnectionManager, AsyncCommands, Client, ToRedisArgs};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, OnceCell};

/// Wrapper for accessing a redis cache.
#[derive(Clone)]
pub struct Cache {
    // The connection is initialized once and shared between threads
    connection: Arc<OnceCell<Result<Arc<Mutex<ConnectionManager>>, ()>>>,
    client: Client, // Keep client around for potential future use
}

impl std::fmt::Debug for Cache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Cache")
            .field("client", &"<Client>")
            .field("connection", &"<ConnectionManager>")
            .finish()
    }
}

impl Cache {
    /// Creates a new Redis cache instance.
    ///
    /// This will succeed even if Redis is unavailable.
    /// Cache operations will be no-ops if Redis cannot be connected to.
    /// Will retry connecting every 10 minutes in the background if initial connection fails.
    pub async fn new(redis_url: &str) -> UtilResult<Self> {
        let client = Client::open(redis_url).map_err(|e| {
            UtilError::new(
                UtilErrorType::Other,
                format!("Failed to create Redis client: {e}"),
                Some(e.into()),
            )
        })?;

        let cache = Self {
            connection: Arc::new(OnceCell::new()),
            client,
        };

        // Attempt initial connection in the background
        let client_clone = cache.client.clone();
        let connection_cell = cache.connection.clone();
        tokio::spawn(async move {
            let mut attempt = 0;

            loop {
                attempt += 1;
                info!("Attempting to establish initial Redis connection... (attempt {attempt})");
                let config = redis::aio::ConnectionManagerConfig::new()
                    .set_connection_timeout(Duration::from_secs(5))
                    .set_response_timeout(Duration::from_secs(2))
                    .set_number_of_retries(3)
                    .set_exponent_base(2)
                    .set_factor(100)
                    .set_max_delay(2000);

                match ConnectionManager::new_with_config(client_clone.clone(), config).await {
                    Ok(conn_manager) => {
                        info!("Successfully established Redis connection");
                        let _ = connection_cell.set(Ok(Arc::new(Mutex::new(conn_manager))));
                        break;
                    }
                    Err(e) => {
                        warn!(
                            "Failed to establish Redis connection: {e}. Will retry in 10 minutes."
                        );
                        tokio::time::sleep(Duration::from_secs(600)).await;
                    }
                }
                if attempt == i32::MAX {
                    error!(
                        "Failed to establish Redis connection after {} attempts",
                        attempt
                    );
                    break;
                }
            }
        });

        Ok(cache)
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
        if let Some(cached) = self.get_json::<V, K>(key.clone()).await? {
            info!("Cache hit for key: {:?}", key);
            return Ok(cached);
        }

        info!("Cache miss for key: {:?}", key);

        // If not in cache, execute the function and measure time
        let start = std::time::Instant::now();
        let value = f().await?;
        let duration = start.elapsed();
        info!("Generated value for key {:?} in {:?}", key, duration);

        // Store in cache - don't fail if caching fails
        self.cache_json(key.clone(), &value, expires_in).await;

        Ok(value)
    }

    /// Stores the given value in the redis cache as JSON.
    /// If Redis is unavailable, this function silently succeeds.
    pub async fn cache_json<V, K>(&self, key: K, value: &V, expires_in: Duration) -> bool
    where
        V: Serialize,
        K: ToRedisArgs + Send + Sync,
    {
        // Wait for connection to be initialized, if it isn't already
        let connection_result = match self
            .connection
            .get_or_init(|| async {
                let config = redis::aio::ConnectionManagerConfig::new()
                    .set_connection_timeout(Duration::from_secs(5))
                    .set_response_timeout(Duration::from_secs(2))
                    .set_number_of_retries(3);

                match ConnectionManager::new_with_config(self.client.clone(), config).await {
                    Ok(conn) => {
                        info!("Established Redis connection");
                        Ok(Arc::new(Mutex::new(conn)))
                    }
                    Err(e) => {
                        warn!("Failed to establish Redis connection: {e}");
                        Err(())
                    }
                }
            })
            .await
        {
            Ok(conn) => conn,
            Err(_) => return false, // Redis unavailable
        };

        let value = match serde_json::to_vec(value) {
            Ok(v) => v,
            Err(e) => {
                error!("Failed to serialize value to JSON: {e}");
                return false;
            }
        };

        // Lock the connection manager to perform the operation
        let mut connection_guard = connection_result.lock().await;

        match connection_guard
            .set_ex::<_, _, ()>(key, value, expires_in.as_secs())
            .await
        {
            Ok(_) => true,
            Err(e) => {
                error!("Failed to cache value: {e}");
                false
            }
        }
    }

    /// Retrieves and deserializes a value from cache.
    /// If Redis is unavailable, returns None.
    pub async fn get_json<V, K>(&self, key: K) -> UtilResult<Option<V>>
    where
        V: DeserializeOwned,
        K: ToRedisArgs + Send + Sync,
    {
        // Wait for connection to be initialized, if it isn't already
        let connection_result = match self
            .connection
            .get_or_init(|| async {
                let config = redis::aio::ConnectionManagerConfig::new()
                    .set_connection_timeout(Duration::from_secs(5))
                    .set_response_timeout(Duration::from_secs(2))
                    .set_number_of_retries(3);

                match ConnectionManager::new_with_config(self.client.clone(), config).await {
                    Ok(conn) => {
                        info!("Established Redis connection");
                        Ok(Arc::new(Mutex::new(conn)))
                    }
                    Err(e) => {
                        warn!("Failed to establish Redis connection: {e}");
                        Err(())
                    }
                }
            })
            .await
        {
            Ok(conn) => conn,
            Err(_) => return Ok(None), // Redis unavailable
        };

        // Lock the connection manager to perform the operation
        let mut connection_guard = connection_result.lock().await;

        // Use proper Redis get command with correct return type
        match connection_guard.get::<_, Option<Vec<u8>>>(key).await {
            Ok(Some(bytes)) => match serde_json::from_slice::<V>(&bytes) {
                Ok(value) => Ok(Some(value)),
                Err(e) => {
                    error!("Failed to deserialize value from cache: {e}");
                    Ok(None)
                }
            },
            Ok(None) => Ok(None), // Key doesn't exist
            Err(e) => {
                if e.to_string().contains("response was nil") {
                    return Ok(None);
                }
                error!("Failed to get value from cache: {e}");
                Ok(None) // Treat errors as cache misses
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

        #[derive(Deserialize, Serialize, Debug, PartialEq)]
        struct S {
            field: String,
        }

        let cache = Cache::new(&redis_url).await.unwrap();
        let value = S {
            field: "value".to_string(),
        };

        // Test cache_json and get_json
        cache
            .cache_json("key", &value, Duration::from_secs(10))
            .await;
        let retrieved = cache.get_json::<S, _>("key").await.unwrap();
        assert_eq!(
            retrieved,
            Some(S {
                field: "value".to_string()
            })
        );

        // Test get_or_set
        let result = cache
            .get_or_set("test_key", Duration::from_secs(10), || async {
                Ok(S {
                    field: "computed".to_string(),
                })
            })
            .await
            .expect("get_or_set failed");

        assert_eq!(
            result,
            S {
                field: "computed".to_string()
            }
        );
    }
}
