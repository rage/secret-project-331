/*!
Handlers for HTTP requests to `/api/v0/main-frontend/credit-registration-admin`.

Every mutating handler writes its `credit_registration_admin_actions` row in the transaction that has
the effect. Admins see recipient addresses in full and the scrubbed study registry bodies; the
registry's own error text is returned to nobody.
*/

mod account_linking;
mod api_log;
mod audit;
mod courses;
mod dashboard;
mod errors;
mod history;
mod ledger;
mod materialize;
mod phases;
mod reconciliation;
mod student_numbers;

use headless_lms_models::credit_registration_account_linking_emails::{
    self, CreditRegistrationAccountLinkingEmail,
};
use headless_lms_models::email_deliveries::EmailSendStatusReport;
use headless_lms_models::student_number_verification_tokens;
use utoipa::{OpenApi, ToSchema};

use crate::domain::authorization::AuthorizationToken;
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(
    dashboard::get_credit_registration_overview,
    dashboard::get_suotar_health,
    dashboard::admin_pause_phase,
    dashboard::admin_resume_phase,
    dashboard::admin_run_phase_now,
    ledger::list_credit_registrations_for_admin,
    ledger::get_credit_registration_for_admin,
    ledger::admin_transition_credit_registration,
    ledger::admin_bulk_transition_credit_registrations,
    ledger::admin_requeue_retryable_credit_registrations,
    errors::get_credit_registration_thresholds,
    errors::get_credit_registration_attention_items,
    errors::get_credit_registration_errors_by_code,
    phases::list_credit_registration_phases,
    api_log::list_suotar_api_calls,
    api_log::get_suotar_api_call,
    courses::get_credit_registration_stats_by_course,
    courses::admin_pause_course_module_credit_registration,
    courses::admin_resume_course_module_credit_registration,
    reconciliation::get_credit_registration_reconciliation,
    audit::list_credit_registration_admin_actions,
    history::get_credit_registration_pipeline_history,
    account_linking::get_account_linking_stats,
    account_linking::admin_resend_account_linking_email,
    account_linking::admin_resolve_student_number_for_linking,
    account_linking::admin_manually_link_student_number,
    student_numbers::list_verified_student_numbers_for_admin,
    student_numbers::admin_unlink_student_number,
    materialize::admin_materialize_credit_registrations
))]
pub(crate) struct MainFrontendCreditRegistrationAdminApiDoc;

/// Every handler here gates on the same check; a submodule calls this instead of repeating it.
async fn authorize_credit_registration_admin(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> Result<AuthorizationToken, ControllerError> {
    authorize(
        conn,
        Act::Administrate,
        Some(user_id),
        Res::GlobalPermissions,
    )
    .await
    .map_err(Into::into)
}

/// Refuses an empty or whitespace reason. Every audited action names one.
fn required_reason(reason: &str) -> Result<&str, ControllerError> {
    let trimmed = reason.trim();
    if trimmed.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "A reason is required.".to_string()
        ));
    }
    Ok(trimmed)
}

/// `serde_urlencoded` reads a single occurrence of a key as a scalar, not a one-element sequence, so
/// a `Vec` field otherwise refuses a query string that repeats the parameter zero or one times.
fn one_or_many<'de, D, T>(deserializer: D) -> Result<Option<Vec<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OneOrMany<T> {
        One(T),
        Many(Vec<T>),
    }
    Ok(
        Option::<OneOrMany<T>>::deserialize(deserializer)?.map(|repr| match repr {
            OneOrMany::One(value) => vec![value],
            OneOrMany::Many(values) => values,
        }),
    )
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminLinkingEmail {
    pub id: Uuid,
    pub course_id: Uuid,
    pub student_number: String,
    pub sisu_person_id: String,
    /// In full.
    pub emailed_to: String,
    pub claimed_at: DateTime<Utc>,
    pub send_status: EmailSendStatusReport,
    pub token_claimed_by_user_id: Option<Uuid>,
    pub token_used_at: Option<DateTime<Utc>>,
    pub token_expires_at: Option<DateTime<Utc>>,
}

/// Shared by the ledger detail view and the account-linking admin views: both show a person's linking
/// mails alongside the token each one carries.
async fn build_linking_emails(
    conn: &mut PgConnection,
    mails: Vec<CreditRegistrationAccountLinkingEmail>,
) -> Result<Vec<AdminLinkingEmail>, ControllerError> {
    let ids: Vec<Uuid> = mails.iter().map(|mail| mail.id).collect();
    let reports =
        credit_registration_account_linking_emails::get_send_status_reports(conn, &ids).await?;
    let token_ids: Vec<Uuid> = mails
        .iter()
        .filter_map(|mail| mail.student_number_verification_token_id)
        .collect();
    let tokens = student_number_verification_tokens::get_by_ids(conn, &token_ids).await?;
    Ok(mails
        .into_iter()
        .map(|mail| {
            let token = mail
                .student_number_verification_token_id
                .and_then(|token_id| tokens.get(&token_id));
            AdminLinkingEmail {
                send_status: reports.get(&mail.id).cloned().unwrap_or_else(
                    credit_registration_account_linking_emails::not_handed_over_yet,
                ),
                id: mail.id,
                course_id: mail.course_id,
                student_number: mail.student_number,
                sisu_person_id: mail.sisu_person_id,
                emailed_to: mail.emailed_to,
                claimed_at: mail.sent_at,
                token_claimed_by_user_id: token.and_then(|row| row.claimed_by_user_id),
                token_used_at: token.and_then(|row| row.used_at),
                token_expires_at: token.map(|row| row.expires_at),
            }
        })
        .collect())
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    dashboard::_add_routes(cfg);
    ledger::_add_routes(cfg);
    errors::_add_routes(cfg);
    phases::_add_routes(cfg);
    api_log::_add_routes(cfg);
    courses::_add_routes(cfg);
    reconciliation::_add_routes(cfg);
    audit::_add_routes(cfg);
    history::_add_routes(cfg);
    account_linking::_add_routes(cfg);
    student_numbers::_add_routes(cfg);
    materialize::_add_routes(cfg);
}
