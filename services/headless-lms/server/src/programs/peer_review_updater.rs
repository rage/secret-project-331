use crate::setup_tracing;
use dotenv::dotenv;
use headless_lms_models::error::TryToOptional;
use headless_lms_models::peer_review_queue_entries;
use sqlx::{Connection, PgConnection};
use std::env;

async fn process_course_instance(
    conn: &mut PgConnection,
    course_instance: &headless_lms_models::course_instances::CourseInstance,
    now: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<(i32, i32)> {
    let mut moved_to_manual_review = 0;
    let mut given_full_points = 0;

    let mut earliest_manual_review_cutoff = now - chrono::Duration::days(7 * 3);

    // Process manual review cases
    let all_exercises_in_course_instance =
        headless_lms_models::exercises::get_exercises_by_course_id(conn, course_instance.course_id)
            .await?;

    for exercise in all_exercises_in_course_instance.iter() {
        if !exercise.needs_peer_review {
            continue;
        }
        let course_id = exercise.course_id;
        if let Some(course_id) = course_id {
            let exercise_config =
                headless_lms_models::peer_or_self_review_configs::get_by_exercise_or_course_id(
                    conn, exercise, course_id,
                )
                .await
                .optional()?;

            if let Some(exercise_config) = exercise_config {
                let manual_review_cutoff_in_days = exercise_config.manual_review_cutoff_in_days;
                let timestamp = now - chrono::Duration::days(manual_review_cutoff_in_days.into());

                if timestamp < earliest_manual_review_cutoff {
                    earliest_manual_review_cutoff = timestamp;
                }

                let should_be_added_to_manual_review = headless_lms_models::peer_review_queue_entries::get_entries_that_need_reviews_and_are_older_than_with_exercise_id(conn, exercise.id, timestamp).await?;
                if !should_be_added_to_manual_review.is_empty() {
                    info!(exercise.id = ?exercise.id, "Found {:?} answers that have been added to the peer review queue before {:?} and have not received enough peer reviews or have not been reviewed manually. Adding them to be manually reviewed by the teachers.", should_be_added_to_manual_review.len(), timestamp);

                    for peer_review_queue_entry in should_be_added_to_manual_review {
                        peer_review_queue_entries::remove_from_queue_and_add_to_manual_review(
                            conn,
                            &peer_review_queue_entry,
                        )
                        .await?;
                        moved_to_manual_review += 1;
                    }
                }
            } else {
                warn!(exercise.id = ?exercise.id, "No peer review config found for exercise {:?}", exercise.id);
            }
        }
    }

    // After this date, we will assume that the teacher has given up on reviewing answers, so we will consider queue entries older than this to have passed the peer review.
    let pass_automatically_cutoff = earliest_manual_review_cutoff - chrono::Duration::days(90);

    // Process automatic pass cases
    let should_pass = headless_lms_models::peer_review_queue_entries::get_entries_that_need_teacher_review_and_are_older_than_with_course_id(conn, course_instance.course_id, pass_automatically_cutoff).await?;
    if !should_pass.is_empty() {
        info!(course_instance_id = ?course_instance.id, "Found {:?} answers that have been added to the peer review queue before {:?}. The teacher has not reviewed the answers manually after 3 months. Giving them full points.", should_pass.len(), pass_automatically_cutoff);
        for peer_review_queue_entry in should_pass {
            let _res = peer_review_queue_entries::remove_from_queue_and_give_full_points(
                conn,
                &peer_review_queue_entry,
            )
            .await?;
            given_full_points += 1;
        }
    }

    Ok((moved_to_manual_review, given_full_points))
}

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let mut conn = PgConnection::connect(&db_url).await?;
    let now = chrono::offset::Utc::now();

    info!("Peer review updater started");
    // Doing the update in small parts so that we don't end up constructing too heavy queries and so that we can get more frequeent log messages about the progress
    let all_course_instances =
        headless_lms_models::course_instances::get_all_course_instances(&mut conn).await?;
    info!(
        "Processing {:?} course instances",
        all_course_instances.len()
    );

    info!(
        earliest_manual_review_cutoff = ?now - chrono::Duration::days(7 * 3),
        "Finding answers to move to manual review"
    );

    let mut total_moved_to_manual_review = 0;
    let mut total_given_full_points = 0;

    for course_instance in all_course_instances.iter() {
        let (moved_to_manual_review, given_full_points) =
            process_course_instance(&mut conn, course_instance, now).await?;

        total_moved_to_manual_review += moved_to_manual_review;
        total_given_full_points += given_full_points;
    }

    info!(
        "Total answers moved to manual review: {:?}",
        total_moved_to_manual_review
    );
    info!(
        "Total answers given full points: {:?}",
        total_given_full_points
    );
    info!("All done!");
    Ok(())
}
