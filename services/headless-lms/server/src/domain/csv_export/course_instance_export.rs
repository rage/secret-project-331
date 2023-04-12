use anyhow::Result;
use bytes::Bytes;
/*
use futures::TryStreamExt;
use headless_lms_models::exercise_task_submissions; */
use headless_lms_models::course_instances;

use async_trait::async_trait;
use models::library::progressing;

use crate::domain::csv_export::CsvWriter;

use sqlx::PgConnection;
use std::io::Write;
use tokio::sync::mpsc::UnboundedSender;

use uuid::Uuid;

use crate::prelude::*;

use super::{
    super::authorization::{AuthorizationToken, AuthorizedResponse},
    course_module_completion_info_to_grade_string, CSVExportAdapter, CsvExportDataLoader,
};

pub struct CompletionsExportOperation {
    pub course_instance_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for CompletionsExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_completions(
            &mut *conn,
            self.course_instance_id,
            CSVExportAdapter {
                sender,
                authorization_token: token,
            },
        )
        .await
    }
}

// Writes the submissions as csv into the writer
pub async fn export_completions<W>(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    // fetch summary
    let course_instance = course_instances::get_course_instance(conn, course_instance_id).await?;
    let summary =
        progressing::get_course_instance_completion_summary(conn, &course_instance).await?;

    // sort modules
    let mut modules = summary.course_modules;
    modules.sort_by_key(|m| m.order_number);

    // prepare headers
    let mut headers = vec![
        "user_id".to_string(),
        "first_name".to_string(),
        "last_name".to_string(),
        "email".to_string(),
    ];
    for module in &modules {
        let module_name = module.name.as_deref().unwrap_or("default_module");
        headers.push(format!("{module_name}_grade"));
        headers.push(format!("{module_name}_registered"));
    }

    // write rows
    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    for user in summary.users_with_course_module_completions {
        let mut has_completed_some_module = false;

        let mut csv_row = vec![
            user.user_id.to_string(),
            user.first_name.unwrap_or_default(),
            user.last_name.unwrap_or_default(),
            user.email,
        ];
        for module in &modules {
            let user_completion = user
                .completed_modules
                .iter()
                .find(|cm| cm.course_module_id == module.id);
            if user_completion.is_some() {
                has_completed_some_module = true;
            }
            let grade = course_module_completion_info_to_grade_string(user_completion);
            csv_row.push(grade);
            let registered = user_completion
                .map(|cm| cm.registered.to_string())
                .unwrap_or_default();
            csv_row.push(registered);
        }
        // To avoid confusion with some people potentially not understanding that '-' means not completed,
        // we'll skip the users that don't have any completions from any modules. The confusion is less likely in cases where there are more than one module, and only in those cases the teachers would see the '-' entries in this file.
        if has_completed_some_module {
            writer.write_record(csv_row);
        }
    }
    let writer = writer.finish().await?;
    Ok(writer)
}

pub struct CourseInstancesExportOperation {
    pub course_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for CourseInstancesExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_course_instances(
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

pub async fn export_course_instances<W>(
    conn: &mut PgConnection,
    course_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let course_instances =
        course_instances::get_course_instances_for_course(conn, course_id).await?;

    let headers = IntoIterator::into_iter([
        "id".to_string(),
        "created_at".to_string(),
        "updated_at".to_string(),
        "name".to_string(),
    ]);
    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;

    for next in course_instances.into_iter() {
        let csv_row = vec![
            next.id.to_string(),
            next.created_at.to_string(),
            next.updated_at.to_string(),
            next.name.unwrap_or_default(),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
