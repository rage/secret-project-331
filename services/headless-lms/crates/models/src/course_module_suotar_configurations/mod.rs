//! What the credit registration pipeline keeps per course module, one row each: whether the last
//! configuration check accepted the module, whether its registration is paused, and how its last
//! enrolment-discovery listing went. [`ensure_exists`] creates the row the writers update.

mod config_check;
mod configuration;
mod listing;

pub use config_check::*;
pub use configuration::*;
pub use listing::*;
