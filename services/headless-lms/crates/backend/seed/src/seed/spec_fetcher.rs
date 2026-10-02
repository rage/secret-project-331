//! Seed-only spec cache around the exercise-service request adapter.

use headless_lms_external_service_clients::service_clients::exercise_service_requests::make_spec_fetcher;
use futures::FutureExt;
use headless_lms_base::jwt::JwtKey;
use headless_lms_models::{ModelError, ModelErrorType, SpecFetcher};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use uuid::Uuid;

type SpecCache = HashMap<(String, String, Option<String>), serde_json::Value>;

/// A caching spec fetcher ONLY FOR THE SEED that returns a cached spec if the same
/// (url, exercise_service_slug, private_spec) is requested. Since this is only used during seeding,
/// there is no cache eviction.
pub fn make_seed_spec_fetcher_with_cache(
    base_url: String,
    request_id: Uuid,
    jwt_key: Arc<JwtKey>,
) -> impl SpecFetcher {
    // Cache key: (url, exercise_service_slug, private_spec serialized)
    let cache: Arc<Mutex<SpecCache>> = Arc::new(Mutex::new(HashMap::new()));

    // Create the base non-caching spec fetcher and wrap it in Arc to make it clonable
    let base_fetcher = Arc::new(make_spec_fetcher(base_url, request_id, jwt_key));

    move |url, exercise_service_slug, private_spec| {
        let url_str = url.to_string();
        let service_slug = exercise_service_slug.to_string();
        // Convert private_spec to string for cache key if present
        let private_spec_str =
            private_spec.map(|spec| serde_json::to_string(&spec).unwrap_or_default());
        let key = (url_str.clone(), service_slug.clone(), private_spec_str);
        let cache = Arc::clone(&cache);
        let base_fetcher = Arc::clone(&base_fetcher);

        async move {
            // Try to get from cache first
            let cached_spec = {
                let cache_guard = cache.lock().map_err(|err| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        format!("Seed spec fetcher cache lock poisoned: {err}"),
                        None::<anyhow::Error>,
                    )
                })?;
                cache_guard.get(&key).cloned()
            };
            if let Some(cached_spec) = cached_spec {
                return Ok(cached_spec.clone());
            }

            // Not in cache - fetch using base fetcher
            let fetched_spec = base_fetcher(url, exercise_service_slug, private_spec).await?;

            // Store in cache
            {
                let mut cache_guard = cache.lock().map_err(|err| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        format!("Seed spec fetcher cache lock poisoned: {err}"),
                        None::<anyhow::Error>,
                    )
                })?;
                cache_guard.insert(key, fetched_spec.clone());
            }

            Ok(fetched_spec)
        }
        .boxed()
    }
}
