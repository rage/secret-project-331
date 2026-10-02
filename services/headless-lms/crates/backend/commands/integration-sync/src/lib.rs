pub mod programs;
pub mod prelude {
    pub use headless_lms_use_cases::prelude::*;
}
pub use headless_lms_external_service_clients::service_clients;
pub use headless_lms_use_cases::domain;
#[macro_use]
extern crate tracing;
pub mod config {
    pub mod open_university_config;
}
