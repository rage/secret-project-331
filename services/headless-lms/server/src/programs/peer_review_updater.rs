use crate::setup_tracing;
use dotenv::dotenv;
use headless_lms_models::peer_review_queue_entries;
use sqlx::{Connection, PgConnection};
use std::env;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let mut conn = PgConnection::connect(&db_url).await?;
    let now = chrono::offset::Utc::now();
    let manual_review_cutoff = now - chrono::Duration::days(7 * 3);
    // After this date, we will assume that the teacher has given up on reviewing answers, so we will consider queue entries older than this to have passed the peer review.
    let pass_automatically_cutoff = manual_review_cutoff - chrono::Duration::days(90);
    info!("Peer review updater started");
    // Doing the update in small parts so that we don't end up constructing too heavy queries and so that we can get more frequeent log messages about the progress
    let all_course_instances =
        headless_lms_models::course_instances::get_all_course_instances(&mut conn).await?;
    info!(
        "Processing {:?} course instances",
        all_course_instances.len()
    );

    info!(
        ?manual_review_cutoff,
        "Finding answers to move to manual review"
    );

    let mut moved_to_manual_review = 0;

    for course_instance in all_course_instances.iter() {
        let should_be_added_to_manual_review = headless_lms_models::peer_review_queue_entries::get_entries_that_need_reviews_and_are_older_than(&mut conn, course_instance.id, manual_review_cutoff).await?;
        if should_be_added_to_manual_review.is_empty() {
            continue;
        }
        info!(course_instance_id = ?course_instance.id, "Found {:?} answers that have been added to the peer review queue before {:?} and have not received enough peer reviews or have not been reviewed manually. Adding them to be manually reviewed by the teachers.", should_be_added_to_manual_review.len(), manual_review_cutoff);
        for peer_review_queue_entry in should_be_added_to_manual_review {
            peer_review_queue_entries::remove_from_queue_and_add_to_manual_review(
                &mut conn,
                &peer_review_queue_entry,
            )
            .await?;
            moved_to_manual_review += 1
        }
    }

    info!(
        "Total answers moved to manual review: {:?}",
        moved_to_manual_review
    );

    info!(
        ?pass_automatically_cutoff,
        "Finding answers to give full points"
    );

    let mut given_full_points = 0;

    for course_instance in all_course_instances.iter() {
        let should_pass = headless_lms_models::peer_review_queue_entries::get_entries_that_need_reviews_and_are_older_than(&mut conn, course_instance.id, pass_automatically_cutoff).await?;
        if should_pass.is_empty() {
            continue;
        }
        info!(course_instance_id = ?course_instance.id, "Found {:?} answers that have been added to the peer review queue before {:?} and have not received enough peer reviews or have not been reviewed manually. Giving them full points.", should_pass.len(), pass_automatically_cutoff);
        for peer_review_queue_entry in should_pass {
            let _res = peer_review_queue_entries::remove_from_queue_and_give_full_points(
                &mut conn,
                &peer_review_queue_entry,
            )
            .await?;
            given_full_points += 1;
        }
    }

    info!("Total answers given full points: {:?}", given_full_points);
    info!("All done!");
    Ok(())
}
