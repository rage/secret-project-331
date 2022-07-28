use std::{future::Ready, time::Duration};

use actix_extensible_rate_limit::{
    backend::{memory::InMemoryBackend, SimpleInput, SimpleInputFunctionBuilder, SimpleOutput},
    RateLimiter,
};
use actix_web::dev::ServiceRequest;

/// Helper function to create rate limitng middlewares.
pub fn build_rate_limiting_middleware(
    interval: Duration,
    max_requests: u64,
) -> RateLimiter<
    InMemoryBackend,
    SimpleOutput,
    impl Fn(&ServiceRequest) -> Ready<Result<SimpleInput, actix_web::Error>>,
> {
    let rate_limiting_backend = InMemoryBackend::builder().build();

    let input = SimpleInputFunctionBuilder::new(interval, max_requests)
        // Client ip address, not the reverse proxy ip address
        .real_ip_key()
        .build();

    RateLimiter::builder(rate_limiting_backend, input).build()
}
