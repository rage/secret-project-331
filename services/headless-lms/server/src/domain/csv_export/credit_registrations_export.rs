use anyhow::Result;
use async_trait::async_trait;
use bytes::Bytes;
use headless_lms_models::credit_registrations::TeacherCreditRegistrationFilters;
use serde::Serialize;
use sqlx::PgConnection;
use std::io::Write;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

use crate::controllers::main_frontend::course_credit_registrations::build_teacher_registrations;
use crate::domain::csv_export::CsvWriter;
use crate::prelude::*;

use super::{
    super::authorization::{AuthorizationToken, AuthorizedResponse},
    CSVExportAdapter, CsvExportDataLoader,
};

/// Read in pages so a course with thousands of registrations is never held in memory whole.
const PAGE_SIZE: i64 = 500;

pub struct CreditRegistrationsExportOperation {
    pub course_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for CreditRegistrationsExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_credit_registrations(
            &mut *conn,
            self.course_id,
            CSVExportAdapter {
                sender,
                authorization_token: token,
            },
        )
        .await
    }
}

/// Writes a course's credit registrations as csv into the writer.
///
/// Student numbers go out in full, because the use is comparing one against a student card. The
/// study registry's own address for the student is reduced to its domain, which is what makes
/// "check your university mail, not your gmail" sayable without handing over the address itself.
pub async fn export_credit_registrations<W>(
    conn: &mut PgConnection,
    course_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "user_id".to_string(),
        "first_name".to_string(),
        "last_name".to_string(),
        "email".to_string(),
        "course_module".to_string(),
        "completion_date".to_string(),
        "state".to_string(),
        "student_facing_status".to_string(),
        "error_code".to_string(),
        "needs_admin_attention".to_string(),
        "attempt_number".to_string(),
        "superseded".to_string(),
        "student_number".to_string(),
        "student_number_verified_at".to_string(),
        "student_number_verified_via".to_string(),
        "enrolment_realisation".to_string(),
        "grade_id".to_string(),
        "credits".to_string(),
        "registered_at".to_string(),
        "sisu_attainment_id".to_string(),
        "linking_email_status".to_string(),
        "linking_email_sent_at".to_string(),
        "linking_email_recipient".to_string(),
    ]);
    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;

    let mut offset = 0;
    loop {
        let rows = headless_lms_models::credit_registrations::get_teacher_facing_by_course_id(
            conn,
            course_id,
            &TeacherCreditRegistrationFilters::default(),
            PAGE_SIZE,
            offset,
        )
        .await?;
        let page_len = rows.len() as i64;
        // The same read model the teacher's table renders, so the file and the screen cannot disagree
        // about a student's status or about how much of an address is shown.
        for row in build_teacher_registrations(conn, course_id, rows).await? {
            writer.write_record(vec![
                row.user_id.to_string(),
                row.first_name.unwrap_or_default(),
                row.last_name.unwrap_or_default(),
                row.email.unwrap_or_default(),
                row.course_module_name.unwrap_or_default(),
                row.completion_date.to_rfc3339(),
                wire_value(&row.state),
                wire_value(&row.student_facing_status),
                wire_value(&row.error_code),
                row.needs_admin_attention.to_string(),
                row.attempt_number.to_string(),
                row.superseded.to_string(),
                row.student_number.unwrap_or_default(),
                optional_time(row.student_number_verified_at),
                wire_value(&row.student_number_verified_via),
                row.enrolment_realisation_name.unwrap_or_default(),
                row.grade_id.unwrap_or_default(),
                row.credits.map(|c| c.to_string()).unwrap_or_default(),
                optional_time(row.registered_at),
                row.sisu_attainment_id.unwrap_or_default(),
                row.linking_email
                    .as_ref()
                    .map(|mail| wire_value(&mail.email_send_status))
                    .unwrap_or_default(),
                row.linking_email
                    .as_ref()
                    .and_then(|mail| mail.sent_at)
                    .map(|sent_at| sent_at.to_rfc3339())
                    .unwrap_or_default(),
                row.linking_email
                    .map(|mail| mail.emailed_to_masked)
                    .unwrap_or_default(),
            ]);
        }
        if page_len < PAGE_SIZE {
            break;
        }
        offset += PAGE_SIZE;
    }

    let writer = writer.finish().await?;
    Ok(writer)
}

/// A snake_case enum as the wire spells it, so the file and the API name a state the same way.
/// `None` becomes an empty cell.
fn wire_value(value: &impl Serialize) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .unwrap_or_default()
}

fn optional_time(value: Option<DateTime<Utc>>) -> String {
    value.map(|time| time.to_rfc3339()).unwrap_or_default()
}
