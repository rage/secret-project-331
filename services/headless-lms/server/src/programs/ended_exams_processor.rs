use std::{collections::HashSet, env};

use crate::setup_tracing;
use chrono::{Duration, Utc};
use dotenv::dotenv;
use headless_lms_models::{self as models, ModelError, ModelErrorType};
use headless_lms_utils::prelude::BackendError;
use sqlx::{Connection, PgConnection, PgPool};
use uuid::Uuid;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    process_ended_exams(&mut conn).await?;
    process_ended_exam_enrollments(&mut conn).await
}

/// Fetches ended exams that haven't yet been processed and updates completions for them.
async fn process_ended_exams(conn: &mut sqlx::PgConnection) -> anyhow::Result<()> {
    let now = Utc::now();
    let exam_ids =
        models::ended_processed_exams::get_unprocessed_ended_exams_by_timestamp(conn, now).await?;
    tracing::info!("Processing completions for {} ended exams.", exam_ids.len());
    let mut processed_courses_cache = HashSet::new();
    let mut success = 0;
    for exam_id in exam_ids.iter() {
        match process_ended_exam(conn, *exam_id, &mut processed_courses_cache).await {
            Ok(_) => success += 1,
            Err(err) => {
                tracing::error!("Failed to process exam {}: {:#?}", exam_id, err);
            }
        }
    }
    tracing::info!(
        "Exams processed. Succeeded: {}, failed: {}.",
        success,
        exam_ids.len() - success
    );
    Ok(())
}

/// Processes completions for courses associated with the given exam.
///
/// Because the same course can belong to multiple exams at the same time, a cache for already
/// processed courses can be provided to avoid unnecessarily reprocessing those courses again.
async fn process_ended_exam(
    conn: &mut PgConnection,
    exam_id: Uuid,
    already_processed_courses: &mut HashSet<Uuid>,
) -> anyhow::Result<()> {
    let course_ids = models::course_exams::get_course_ids_by_exam_id(conn, exam_id).await?;
    let mut tx = conn.begin().await?;
    for course_id in course_ids {
        if already_processed_courses.contains(&course_id) {
            continue;
        } else {
            models::library::progressing::process_all_course_completions(&mut tx, course_id)
                .await?;
            already_processed_courses.insert(course_id);
        }
    }
    models::ended_processed_exams::upsert(&mut tx, exam_id).await?;
    tx.commit().await?;
    Ok(())
}

/// Processes ended exam enrollments
async fn process_ended_exam_enrollments(conn: &mut PgConnection) -> anyhow::Result<()> {
    let mut tx = conn.begin().await?;
    let mut success = 0;
    let mut failed = 0;

    let ongoing_exam_enrollments: Vec<headless_lms_models::exams::ExamEnrollment> =
        models::exams::get_ongoing_exam_enrollments(&mut tx).await?;
    let exams = models::exams::get_exams(&mut tx).await?;

    for enrollment in ongoing_exam_enrollments {
        let exam = exams.get(&enrollment.exam_id).ok_or_else(|| {
            ModelError::new(ModelErrorType::Generic, "Exam not found".into(), None)
        })?;

        //Check if users exams should have ended and add the ending time to exam_enrollmets
        if Utc::now() > enrollment.started_at + Duration::minutes(exam.time_minutes.into()) {
            match models::exams::update_exam_ended(&mut tx, exam.id, enrollment.user_id, Utc::now())
                .await
            {
                Ok(_) => success += 1,
                Err(err) => {
                    failed += 1;
                    tracing::error!(
                        "Failed to end users {} exam {}: {:#?}",
                        enrollment.user_id,
                        exam.id,
                        err
                    );
                }
            }
        }
    }

    tracing::info!(
        "Exam enrollments processed. Succeeded: {}, failed: {}.",
        success,
        failed
    );
    tx.commit().await?;

    Ok(())
}
