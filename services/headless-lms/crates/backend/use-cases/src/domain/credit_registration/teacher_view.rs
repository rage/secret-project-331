//! Shared enrichment for a teacher's credit-registration table and CSV export.

use super::mail_status::{
    NotificationEmailStatus, TeacherLinkingEmailStatus, linking_email_status_of,
};
use headless_lms_models::credit_registration_account_linking_emails::{
    self, CreditRegistrationAccountLinkingEmail,
};
use headless_lms_models::credit_registrations::{
    ResubmissionRefusal, ResubmissionStrictness, TeacherCreditRegistration,
};
use headless_lms_data_operations::library::credit_registration::StudentFacingCreditRegistrationStatus;
use headless_lms_data_operations::library::credit_registration::student_notifications;
use headless_lms_models::verified_student_numbers;
use secrecy::ExposeSecret;
use sqlx::PgConnection;
use std::collections::HashMap;
use uuid::Uuid;

pub struct TeacherRegistrationView {
    pub row: TeacherCreditRegistration,
    pub linking_email: Option<TeacherLinkingEmailStatus>,
    pub notification_email: Option<NotificationEmailStatus>,
    pub resubmission_refusal: Option<ResubmissionRefusal>,
}

/// The newest linking mail's send status for each row waiting for a number, by row id. A fixed number
/// of queries whatever the page holds, because only the listed people are looked up.
async fn linking_email_statuses(
    conn: &mut PgConnection,
    course_id: Uuid,
    waiting: &[&TeacherCreditRegistration],
) -> Result<HashMap<Uuid, TeacherLinkingEmailStatus>, headless_lms_models::ModelError> {
    if waiting.is_empty() {
        return Ok(HashMap::new());
    }
    let need_lookup: Vec<Uuid> = waiting
        .iter()
        .filter(|row| row.sisu_person_id.is_none())
        .map(|row| row.user_id)
        .collect();
    let latest_links: HashMap<Uuid, String> = if need_lookup.is_empty() {
        HashMap::new()
    } else {
        verified_student_numbers::get_latest_including_deleted_by_user_ids(conn, &need_lookup)
            .await?
            .into_iter()
            .filter_map(|link| {
                let person_id = link.sisu_person_id?.expose_secret().to_owned();
                Some((link.user_id, person_id))
            })
            .collect()
    };
    let per_row: Vec<(Uuid, String)> = waiting
        .iter()
        .filter_map(|row| {
            let person_id = row
                .sisu_person_id
                .as_ref()
                .map(|id| id.expose_secret().to_owned())
                .or_else(|| latest_links.get(&row.user_id).cloned())?;
            Some((row.id, person_id))
        })
        .collect();
    if per_row.is_empty() {
        return Ok(HashMap::new());
    }
    let person_ids: Vec<String> = per_row
        .iter()
        .map(|(_, person_id)| person_id.clone())
        .collect();
    let mails = credit_registration_account_linking_emails::get_latest_by_course_and_persons(
        conn,
        course_id,
        &person_ids,
    )
    .await?;
    let matched: Vec<(Uuid, &CreditRegistrationAccountLinkingEmail)> = per_row
        .iter()
        .filter_map(|(row_id, person_id)| Some((*row_id, mails.get(person_id)?)))
        .collect();
    if matched.is_empty() {
        return Ok(HashMap::new());
    }
    let mail_ids: Vec<Uuid> = matched.iter().map(|(_, mail)| mail.id).collect();
    let reports =
        credit_registration_account_linking_emails::get_send_status_reports(conn, &mail_ids)
            .await?;
    Ok(matched
        .into_iter()
        .filter_map(|(row_id, mail)| {
            let report = reports.get(&mail.id)?;
            Some((row_id, linking_email_status_of(report, mail)))
        })
        .collect())
}

pub async fn build_teacher_registration_views(
    conn: &mut PgConnection,
    course_id: Uuid,
    rows: Vec<TeacherCreditRegistration>,
) -> Result<Vec<TeacherRegistrationView>, headless_lms_models::ModelError> {
    let waiting: Vec<&TeacherCreditRegistration> = rows
        .iter()
        .filter(|row| {
            StudentFacingCreditRegistrationStatus::of(
                row.state,
                row.preconditions(),
                row.enrolment_resolved,
            ) == StudentFacingCreditRegistrationStatus::NeedsStudentNumber
        })
        .collect();
    let mut statuses = linking_email_statuses(conn, course_id, &waiting).await?;
    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let notification_mails = student_notifications::get_for_registrations(conn, &ids).await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let linking_email = statuses.remove(&row.id);
            let resubmission_refusal = row
                .resubmission_facts()
                .resubmission_refusal(ResubmissionStrictness::OnlyFailedPermanent);
            let notification_email =
                NotificationEmailStatus::for_state(row.state, row.id, &notification_mails);
            TeacherRegistrationView {
                row,
                linking_email,
                notification_email,
                resubmission_refusal,
            }
        })
        .collect())
}
