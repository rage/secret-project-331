use crate::setup_tracing;
use dotenv::dotenv;
use headless_lms_models::{
    peer_review_queue_entries,
};
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
    let pass_automatically_cutoff = manual_review_cutoff - chrono::Duration::days(90);
    info!("Peer review updater started");
    // Doing the update in small parts so that we don't end up constructing too heavy queries and so that we can get more frequeent log messages about the progress
    let all_course_instances =
        headless_lms_models::course_instances::get_all_course_instances(&mut conn).await?;
    info!(
        "Processing {:?} course instances",
        all_course_instances.len()
    );

    for course_instance in all_course_instances {
        info!(
            "Processing course instance {:?} from course {:?}",
            course_instance.id, course_instance.course_id
        );

        let should_be_added_to_manual_review = headless_lms_models::peer_review_queue_entries::get_entries_that_need_reviews_and_are_older_than(&mut conn, course_instance.id, manual_review_cutoff).await?;
        info!("Found {:?} answers that have been added to the peer review queue before {:?} and have not received enough peer reviews. Adding them to be manually reviewed by the teachers", should_be_added_to_manual_review.len(), manual_review_cutoff);
        for peer_review_queue_entry in should_be_added_to_manual_review {
            peer_review_queue_entries::remove_from_queue_and_add_to_manual_review(
                &mut conn,
                &peer_review_queue_entry,
            )
            .await?;
        }

        let should_pass = headless_lms_models::peer_review_queue_entries::get_entries_that_need_reviews_and_are_older_than(&mut conn, course_instance.id, pass_automatically_cutoff).await?;
        info!("Found {:?} answers that have been added to the peer review queue before {:?} and have not received enough peer reviews. Adding them to be manually reviewed by the teachers", should_pass.len(), pass_automatically_cutoff);
        for peer_review_queue_entry in should_pass {
            let _res = peer_review_queue_entries::remove_from_queue_and_give_full_points(
                &mut conn,
                &peer_review_queue_entry,
            )
            .await?;
        }
    }
    info!("All done!");
    Ok(())
}

// 3491 -3468
