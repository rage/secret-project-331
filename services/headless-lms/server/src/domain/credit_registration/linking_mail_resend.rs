//! What the teacher- and admin-facing linking mail resend endpoints share: the gate before either
//! may try, and the wire shape both answer with.

use headless_lms_credit_registration::account_linking;
use headless_lms_models::credit_registration_account_linking_emails::LinkingMailSource;
use utoipa::ToSchema;

use crate::prelude::*;

/// The source a course-or-target id from an admin screen names: a live mooc.fi target if there is
/// one by that id, otherwise a course. An unknown id comes back as a course, which
/// [`ensure_resend_possible`] then refuses.
pub async fn resolve_linking_mail_source(
    conn: &mut PgConnection,
    course_or_target_id: Uuid,
) -> Result<LinkingMailSource, ControllerError> {
    match models::external_credit_targets::get_by_id(conn, course_or_target_id).await {
        Ok(_) => Ok(LinkingMailSource::ExternalCreditTarget(course_or_target_id)),
        Err(error)
            if matches!(
                error.error_type(),
                models::ModelErrorType::RecordNotFound | models::ModelErrorType::NotFound
            ) =>
        {
            Ok(LinkingMailSource::Course(course_or_target_id))
        }
        Err(error) => Err(error.into()),
    }
}

/// Refuses a resend while account linking is switched off, for a course with no credit
/// registration module configured, or for a mooc.fi target that is not enabled.
pub async fn ensure_resend_possible(
    conn: &mut PgConnection,
    app_conf: &ApplicationConfiguration,
    source: LinkingMailSource,
) -> Result<(), ControllerError> {
    if !app_conf.suotar_configuration.is_account_linking_enabled() {
        return Err(controller_err!(
            BadRequest,
            "Account linking is switched off.".to_string()
        ));
    }
    match source {
        LinkingMailSource::Course(course_id) => {
            let enabled_module_ids =
                models::course_modules::get_credit_registration_enabled_ids_for_course(
                    conn, course_id,
                )
                .await?;
            if enabled_module_ids.is_empty() {
                return Err(controller_err!(
                    BadRequest,
                    "This course has no credit registration module configured.".to_string()
                ));
            }
        }
        LinkingMailSource::ExternalCreditTarget(id) => {
            let target = models::external_credit_targets::get_by_id(conn, id).await?;
            if target.enabled_at.is_none() {
                return Err(controller_err!(
                    BadRequest,
                    "This mooc.fi course is not enabled.".to_string()
                ));
            }
        }
    }
    Ok(())
}

/// What a resend endpoint tells its caller. Shared wire shape for the teacher- and admin-facing
/// resend endpoints; `NoStudentNumberKnown` is only ever emitted by the teacher endpoint, whose
/// target may be an account that has never held a number.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ResendOutcome {
    /// A mail is owed and will be handed to the sender on the next run.
    Queued,
    AlreadyMailedToEveryKnownAddress,
    /// A cap refused it.
    RefusedByRateCap,
    NoAddressInStudyRegistry,
    NotOnTheCourseRoster,
    /// The number is already linked to an account, so no linking mail is owed.
    AlreadyLinked,
    StudyRegistryUnavailable,
    /// This account has never had a student number, so there is nothing to look up.
    NoStudentNumberKnown,
}

impl From<account_linking::ResendOutcome> for ResendOutcome {
    fn from(outcome: account_linking::ResendOutcome) -> Self {
        use account_linking::ResendOutcome as Attempted;
        match outcome {
            Attempted::Queued => Self::Queued,
            Attempted::AlreadyMailedToEveryKnownAddress => Self::AlreadyMailedToEveryKnownAddress,
            Attempted::RefusedByRateCap => Self::RefusedByRateCap,
            Attempted::NoAddressInStudyRegistry => Self::NoAddressInStudyRegistry,
            Attempted::NotOnTheCourseRoster => Self::NotOnTheCourseRoster,
            Attempted::AlreadyLinked => Self::AlreadyLinked,
            Attempted::StudyRegistryUnavailable => Self::StudyRegistryUnavailable,
        }
    }
}
