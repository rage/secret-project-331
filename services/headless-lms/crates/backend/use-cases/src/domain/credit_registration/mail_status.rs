//! How the student and teacher views show the mails a registration row sent.

use headless_lms_data_operations::library::credit_registration::student_notifications::{
    CreditRegistrationNotificationKind, RegistrationNotificationEmail,
};
use headless_lms_models::credit_registration_account_linking_emails::CreditRegistrationAccountLinkingEmail;
use headless_lms_models::credit_registrations::CreditRegistrationState;
use headless_lms_models::email_deliveries::{EmailSendStatus, EmailSendStatusReport};
use secrecy::ExposeSecret;
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

/// What we can honestly say about a linking mail: our send status and the address's domain.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct TeacherLinkingEmailStatus {
    pub email_send_status: EmailSendStatus,
    pub sent_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub emailed_to_masked: String,
}

pub fn linking_email_status_of(
    report: &EmailSendStatusReport,
    mail: &CreditRegistrationAccountLinkingEmail,
) -> TeacherLinkingEmailStatus {
    TeacherLinkingEmailStatus {
        email_send_status: report.email_send_status,
        sent_at: report.sent_at,
        last_attempt_at: report.last_attempt_at,
        retry_count: report.retry_count,
        next_retry_at: report.next_retry_at,
        emailed_to_masked: mask_email(mail.emailed_to.expose_secret()),
    }
}
