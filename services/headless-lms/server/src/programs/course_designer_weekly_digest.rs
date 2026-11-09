//! Queues the weekly progress email for every in-progress course design plan.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use dotenvy::dotenv;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    self as models, ModelErrorType,
    course_designer_plans::CourseDesignerStage,
    email_templates::{self, EmailTemplateType},
    library::course_designer::WeeklyDigest,
};
use serde_json::json;
use sqlx::{Connection, PgConnection, PgPool};
use uuid::Uuid;

use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;
    let base_url = ProgramConfig::required("BASE_URL")?;
    let db_pool = PgPool::connect(&ProgramConfig::database_url_with_default()).await?;
    let mut conn = db_pool.acquire().await?;
    send_weekly_digests(&mut conn, base_url.trim_end_matches('/'), Utc::now()).await
}

async fn send_weekly_digests(
    conn: &mut PgConnection,
    base_url: &str,
    now: DateTime<Utc>,
) -> anyhow::Result<()> {
    let plan_ids =
        models::library::course_designer::get_plan_ids_due_for_weekly_digest(conn, now).await?;
    info!("Sending weekly digests for {} plans.", plan_ids.len());
    let mut template_ids_by_language = HashMap::new();
    let mut failed = 0;
    for plan_id in &plan_ids {
        if let Err(err) =
            send_plan_digest(conn, base_url, *plan_id, now, &mut template_ids_by_language).await
        {
            failed += 1;
            error!("Failed to send the weekly digest of plan {plan_id}: {err:#?}");
        }
    }
    info!(
        "Weekly digests done. Succeeded: {}, failed: {}.",
        plan_ids.len() - failed,
        failed
    );
    Ok(())
}

async fn send_plan_digest(
    conn: &mut PgConnection,
    base_url: &str,
    plan_id: Uuid,
    now: DateTime<Utc>,
    template_ids_by_language: &mut HashMap<String, Uuid>,
) -> anyhow::Result<()> {
    let mut tx = conn.begin().await?;
    let digest = models::library::course_designer::get_weekly_digest(&mut tx, plan_id, now).await?;
    if !digest.recipient_user_ids.is_empty() {
        let template_id = match template_ids_by_language.get(&digest.language_code) {
            Some(template_id) => *template_id,
            None => {
                let template_id = get_template_id(&mut tx, &digest.language_code).await?;
                template_ids_by_language.insert(digest.language_code.clone(), template_id);
                template_id
            }
        };
        let placeholders = placeholders(&digest, base_url, now);
        for user_id in &digest.recipient_user_ids {
            models::email_deliveries::insert_email_delivery_with_placeholders(
                &mut tx,
                *user_id,
                template_id,
                &placeholders,
            )
            .await?;
        }
    }
    models::library::course_designer::mark_weekly_digest_sent(&mut tx, plan_id, now).await?;
    tx.commit().await?;
    Ok(())
}

async fn get_template_id(conn: &mut PgConnection, language_code: &str) -> anyhow::Result<Uuid> {
    match email_templates::get_generic_email_template_by_type_and_language(
        conn,
        EmailTemplateType::CourseDesignerWeeklyDigest,
        language_code,
    )
    .await
    {
        Ok(template) => Ok(template.id),
        Err(err) if matches!(err.error_type(), ModelErrorType::RecordNotFound) => {
            anyhow::bail!("no course_designer_weekly_digest email template exists")
        }
        Err(err) => Err(err.into()),
    }
}

/// Language-dependent fragments the template cannot hold itself because they depend on the plan.
struct DigestCopy {
    untitled_plan: &'static str,
    nothing: &'static str,
    no_active_stage: &'static str,
    on_schedule: &'static str,
    overdue: fn(i64) -> String,
    date_format: &'static str,
    stage_name: fn(CourseDesignerStage) -> &'static str,
}

const ENGLISH_COPY: DigestCopy = DigestCopy {
    untitled_plan: "Untitled plan",
    nothing: "None",
    no_active_stage: "No active phase",
    on_schedule: "The phase is on schedule.",
    overdue: |days| format!("The phase is {days} days past its planned end."),
    date_format: "%B %-d, %Y",
    stage_name: |stage| match stage {
        CourseDesignerStage::Analysis => "Analysis",
        CourseDesignerStage::Design => "Design",
        CourseDesignerStage::Development => "Development",
        CourseDesignerStage::Implementation => "Implementation",
        CourseDesignerStage::Evaluation => "Evaluation",
    },
};

const FINNISH_COPY: DigestCopy = DigestCopy {
    untitled_plan: "Nimetön suunnitelma",
    nothing: "Ei yhtään",
    no_active_stage: "Ei aktiivista vaihetta",
    on_schedule: "Vaihe etenee aikataulussa.",
    overdue: |days| format!("Vaihe on {days} päivää yli suunnitellun päättymispäivän."),
    date_format: "%-d.%-m.%Y",
    stage_name: |stage| match stage {
        CourseDesignerStage::Analysis => "Analyysi",
        CourseDesignerStage::Design => "Suunnittelu",
        CourseDesignerStage::Development => "Kehittäminen",
        CourseDesignerStage::Implementation => "Toteutus",
        CourseDesignerStage::Evaluation => "Arviointi",
    },
};

/// Values for the `course_designer_weekly_digest` template. Keys must match the seeded templates
/// and [`EmailTemplateType::sample_placeholders`].
fn placeholders(digest: &WeeklyDigest, base_url: &str, now: DateTime<Utc>) -> serde_json::Value {
    let copy = if digest.language_code.starts_with("fi") {
        &FINNISH_COPY
    } else {
        &ENGLISH_COPY
    };
    let today = now.date_naive();
    let schedule_status = match digest.active_stage_planned_ends_on {
        Some(ends_on) if today > ends_on => (copy.overdue)((today - ends_on).num_days()),
        _ => copy.on_schedule.to_string(),
    };
    let join_or_nothing = |items: Vec<String>| {
        if items.is_empty() {
            copy.nothing.to_string()
        } else {
            items.join("; ")
        }
    };
    let unfinished_sections = join_or_nothing(
        digest
            .unfinished_section_counts
            .iter()
            .map(|(stage, count)| format!("{} ({count})", (copy.stage_name)(*stage)))
            .collect(),
    );
    let stage_query = digest
        .unfinished_section_counts
        .first()
        .map(|(stage, _)| *stage)
        .or(digest.active_stage)
        .map(|stage| format!("?stage={}", stage.as_str()))
        .unwrap_or_default();
    json!({
        "PLAN_NAME": digest.plan_name.as_deref().unwrap_or(copy.untitled_plan),
        "ACTIVE_STAGE": digest
            .active_stage
            .map(copy.stage_name)
            .unwrap_or(copy.no_active_stage),
        "ACTIVE_STAGE_ENDS_ON": digest
            .active_stage_planned_ends_on
            .map(|d| d.format(copy.date_format).to_string())
            .unwrap_or_default(),
        "SCHEDULE_STATUS": schedule_status,
        "COMPLETED_TASKS_LAST_WEEK": join_or_nothing(digest.tasks_completed_since.clone()),
        "COMPLETED_TASK_COUNT": digest.completed_task_count,
        "TASK_COUNT": digest.task_count,
        "UNFINISHED_SECTIONS": unfinished_sections,
        "PLAN_LINK": format!(
            "{base_url}/manage/course-plans/{}/workspace{stage_query}",
            digest.plan_id
        ),
    })
}
