//! The sole binary dispatches to these operational packages.
pub use headless_lms_cli_tools::programs::{doc_file_generator, sorter};
pub use headless_lms_credit_registration_workers::programs::credit_registration_workers;
pub use headless_lms_email_delivery_workers::programs::email_deliver;
pub use headless_lms_integration_sync_commands::programs::{
    open_university_registration_link_fetcher, sync_tmc_users,
};
pub use headless_lms_integration_sync_workers::programs::{
    chatbot_syncer, mailchimp_syncer, service_info_fetcher,
};
pub use headless_lms_learning_commands::programs::peer_review_updater;
pub use headless_lms_learning_workers::programs::regrader;
pub use headless_lms_maintenance_commands::programs::{
    calculate_page_visit_stats, ended_exams_processor, exercise_answer_upload_reaper,
    exercise_spec_upload_reaper,
};
pub use headless_lms_seed::seed;
pub mod start_server;
