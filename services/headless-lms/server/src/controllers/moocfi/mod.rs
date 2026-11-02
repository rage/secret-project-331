/*!
Handlers for HTTP requests to `/api/v0/moocfi`, which mooc.fi's backend calls server to server.
*/

pub mod credit_registration_handoffs;
pub mod outbound_handoffs;

use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig};
use crate::prelude::*;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    // Every call comes from mooc.fi's few egress addresses, so per-IP these are only coarse caps. The
    // mint limits per student inside the handler; a redeem has a random single-use token to guess.
    cfg.service(
        web::scope("/credit-registration-handoffs")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(600),
                ..Default::default()
            }))
            .configure(credit_registration_handoffs::_add_routes),
    )
    .service(
        web::scope("/outbound-handoffs")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(600),
                ..Default::default()
            }))
            .configure(outbound_handoffs::_add_routes),
    );
}
