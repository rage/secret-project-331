//! How the student and teacher views show the mails a registration row sent.

use headless_lms_models::credit_registrations::CreditRegistrationState;
use headless_lms_models::email_deliveries::EmailSendStatus;
use headless_lms_models::library::credit_registration::student_notifications::{
    CreditRegistrationNotificationKind, RegistrationNotificationEmail,
};
use utoipa::ToSchema;

use crate::prelude::*;

/// Where one of the two terminal-state mails stands, as a row shows it. No address: these go to
/// the account's own, which the reader either owns or already sees.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct NotificationEmailStatus {
    pub kind: CreditRegistrationNotificationKind,
    pub email_send_status: EmailSendStatus,
    pub sent_at: Option<DateTime<Utc>>,
}

impl NotificationEmailStatus {
    /// The mail that belongs with the row's current state, or `None` for a state that has none: a
    /// row shows at most one line, and an old action-needed mail on a since-registered row would
    /// contradict the badge above it.
    pub fn for_state(
        state: CreditRegistrationState,
        credit_registration_id: Uuid,
        mails: &[RegistrationNotificationEmail],
    ) -> Option<Self> {
        let wanted = CreditRegistrationNotificationKind::for_state(state)?;
        let mail = mails.iter().find(|mail| {
            mail.credit_registration_id == credit_registration_id && mail.kind == wanted
        })?;
        Some(Self {
            kind: mail.kind,
            email_send_status: mail.send_status.email_send_status,
            sent_at: mail.send_status.sent_at,
        })
    }
}

/// Keeps the domain and drops the local part: enough to recognise which mailbox to open, not a new
/// disclosure of an address. Teachers get the same masking; only admins see an address in full.
pub fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((_, domain)) => format!("...@{domain}"),
        None => "...".to_string(),
    }
}
