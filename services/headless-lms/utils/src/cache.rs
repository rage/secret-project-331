//! Redis cache wrapper.

use crate::prelude::*;
use redis::{aio::ConnectionManager, AsyncCommands, Client, ToRedisArgs};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;

/// Wrapper for accessing a redis cache.
/// Operations are non-blocking and fail gracefully when Redis is unavailable.
pub struct Cache {
    connection_manager: Arc<OnceCell<ConnectionManager>>,
    initial_connection_successful: Arc<std::sync::atomic::AtomicBool>,
}

impl Clone for Cache {
    fn clone(&self) -> Self {
        Self {
            connection_manager: self.connection_manager.clone(),
            initial_connection_successful: self.initial_connection_successful.clone(),
        }
    }
}

impl std::fmt::Debug for Cache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Cache")
            .field("client", &"<Client>")
            .field("connection", &"<ConnectionManager>")
            .field(
                "initial_connection_successful",
                &self
                    .initial_connection_successful
                    .load(std::sync::atomic::Ordering::SeqCst),
            )
            .finish()
    }
}

impl Cache {
    /// Creates a new Redis cache instance.
    ///
    /// This will succeed even if Redis is unavailable.
    /// Cache operations will be no-ops if Redis cannot be connected to.
    /// Will retry connecting in the background if initial connection fails.
    pub fn new(redis_url: &str) -> UtilResult<Self> {
        let client = Client::open(redis_url).map_err(|e| {
            UtilError::new(
                UtilErrorType::Other,
                format!("Failed to create Redis client: {e}"),
                Some(e.into()),
            )
        })?;

        let cache = Self {
            connection_manager: Arc::new(OnceCell::new()),
            initial_connection_successful: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        };

        let client_clone = client.clone();
        let cache_clone = cache.clone();

        tokio::spawn(async move {
            let mut backoff = Duration::from_secs(1);
            const MAX_BACKOFF: Duration = Duration::from_secs(6000);
            const MAX_ATTEMPTS: usize = 1000;
            let mut attempt = 0;

            while attempt < MAX_ATTEMPTS {
                attempt += 1;
                info!("Attempting to establish Redis connection... (attempt {attempt})");
                let config = redis::aio::ConnectionManagerConfig::new()
                    .set_connection_timeout(Duration::from_secs(5))
                    .set_response_timeout(Duration::from_secs(2))
                    .set_number_of_retries(3);

                match ConnectionManager::new_with_config(client_clone.clone(), config).await {
                    Ok(conn_manager) => {
                        info!("Successfully established Redis connection");
                        match cache_clone.connection_manager.set(conn_manager) {
                            Ok(_) => {
                                info!("Connection manager set successfully");
                                cache_clone
                                    .initial_connection_successful
                                    .store(true, std::sync::atomic::Ordering::SeqCst);
                                trace!("Connection flag set to true");
                                break;
                            }
                            Err(_) => {
                                warn!("Failed to set connection manager - will retry");
                                continue;
                            }
                        }
                    }
                    Err(e) => {
                        warn!(
                            "Failed to establish Redis connection: {e}. Will retry in {:?}.",
                            backoff
                        );
                        tokio::time::sleep(backoff).await;
                        backoff = std::cmp::min(backoff * 2, MAX_BACKOFF);
                    }
                }
            }

            if attempt >= MAX_ATTEMPTS {
                error!("Failed to establish Redis connection after {MAX_ATTEMPTS} attempts");
                cache_clone
                    .initial_connection_successful
                    .store(false, std::sync::atomic::Ordering::SeqCst);
            }
        });

        Ok(cache)
    }

    /// Retrieves a value from cache, or executes the provided function to generate and cache the value.
    ///
    /// First checks if the key exists in the cache. If it does, returns the cached value.
    /// If not, executes the provided async function, caches its result, and returns it.
    /// Operations are non-blocking - if Redis is unavailable, the function is executed immediately.
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
        if let Some(cached) = self.get_json::<V, K>(key.clone()).await {
            info!("Cache hit for key: {:?}", key);
            return Ok(cached);
        }

        info!("Cache miss for key: {:?}", key);

        // If not in cache or connection not available, execute the function
        let start = std::time::Instant::now();
        let value = f().await?;
        let duration = start.elapsed();
        info!("Generated value for key {:?} in {:?}", key, duration);

        self.cache_json(key.clone(), &value, expires_in).await;

        Ok(value)
    }

    /// Stores the given value in the redis cache as JSON.
    /// If Redis is unavailable, this function silently does nothing.
    /// This is a non-blocking operation.
    pub async fn cache_json<V, K>(&self, key: K, value: &V, expires_in: Duration) -> bool
    where
        V: Serialize,
        K: ToRedisArgs + Send + Sync,
    {
        if !self.initial_connection_successful() {
            warn!("Skipping cache_json because initial connection not successful");
            return false;
        }

        let mut connection = match self.connection_manager.get() {
            Some(conn) => conn.clone(),
            None => {
                warn!("Skipping cache_json because no connection manager");
                return false;
            }
        };

        let value = match serde_json::to_vec(value) {
            Ok(v) => v,
            Err(e) => {
                error!("Failed to serialize value to JSON: {e}");
                return false;
            }
        };

        match connection
            .set_ex::<_, _, ()>(key, value, expires_in.as_secs())
            .await
        {
            Ok(_) => {
                debug!("Successfully cached value");
                true
            }
            Err(e) => {
                error!("Failed to cache value: {e}");
                false
            }
        }
    }

    /// Retrieves and deserializes a value from cache.
    /// If Redis is unavailable, returns None.
    /// This is a non-blocking operation.
    pub async fn get_json<V, K>(&self, key: K) -> Option<V>
    where
        V: DeserializeOwned,
        K: ToRedisArgs + Send + Sync,
    {
        if !self.initial_connection_successful() {
            warn!("Skipping get_json because initial connection not successful");
            return None;
        }

        let mut connection = match self.connection_manager.get() {
            Some(conn) => conn.clone(),
            None => {
                warn!("Skipping get_json because no connection manager");
                return None;
            }
        };

        match connection.get::<_, Option<Vec<u8>>>(key).await {
            Ok(Some(bytes)) => match serde_json::from_slice(&bytes) {
                Ok(value) => {
                    debug!("Successfully retrieved and deserialized value from cache");
                    Some(value)
                }
                Err(e) => {
                    error!("Failed to deserialize value from cache: {e}");
                    None
                }
            },
            Ok(None) => {
                debug!("Key not found in cache");
                None
            }
            Err(e) => {
                if e.to_string().contains("response was nil") {
                    debug!("Got nil response from Redis");
                    return None;
                }
                error!("Failed to get value from cache: {e}");
                None
            }
        }
    }

    /// Delete a key from the cache.
    /// Returns true if the key was deleted, false otherwise.
    /// This is a non-blocking operation.
    pub async fn invalidate<K>(&self, key: K) -> bool
    where
        K: ToRedisArgs + Send + Sync,
    {
        if !self.initial_connection_successful() {
            return false;
        }

        let mut connection = match self.connection_manager.get() {
            Some(conn) => conn.clone(),
            None => return false,
        };

        match connection.del::<_, i64>(key).await {
            Ok(1) => true,
            Ok(0) => false,
            Ok(_) => true,
            Err(e) => {
                error!("Failed to invalidate cache key: {e}");
                false
            }
        }
    }

    /// Returns whether the initial connection was successful
    pub fn initial_connection_successful(&self) -> bool {
        self.initial_connection_successful
            .load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Waits for the initial connection to be established, with a timeout.
    /// Returns true if connected, false if timed out.
    /// This is primarily intended for testing.
    #[cfg(test)]
    pub async fn wait_for_initial_connection(&self, timeout: Duration) -> bool {
        let start = std::time::Instant::now();
        while !self.initial_connection_successful() || self.connection_manager.get().is_none() {
            if start.elapsed() >= timeout {
                error!(
                    "Timed out waiting for Redis connection after {:?}. Flag is: {}, Connection manager: {}",
                    timeout,
                    self.initial_connection_successful(),
                    self.connection_manager.get().is_some()
                );
                return false;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        true
    }
}

#[cfg(test)]
mod test {
    use std::env;

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

        let cache = Cache::new(&redis_url).unwrap();
        let value = S {
            field: "value".to_string(),
        };

        // Wait for connection to be established
        assert!(
            cache
                .wait_for_initial_connection(Duration::from_secs(10))
                .await,
            "Failed to connect to Redis within timeout"
        );

        // Test cache_json and get_json
        let cache_result = cache
            .cache_json("key", &value, Duration::from_secs(10))
            .await;

        let retrieved = cache.get_json::<S, _>("key").await;
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

        // Test invalidate
        assert!(cache.invalidate("key").await);
        let retrieved = cache.get_json::<S, _>("key").await;
        assert_eq!(retrieved, None);
    }
}
