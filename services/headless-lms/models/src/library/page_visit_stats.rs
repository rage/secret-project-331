//! Functions for precomputing anonymous aggregate statistics about page visits.

use crate::prelude::*;

/// Calculates the latest statistics for dates that are not yet calculated yet.
pub async fn calculate_latest(conn: &mut PgConnection) -> ModelResult<()> {
    let latest_date = crate::page_visit_datum_summary_by_courses::get_latest_date(conn).await?;
    let date_today = Utc::now().naive_utc().date();
    let yesterday = date_today - chrono::Duration::days(1);
    let cutoff_date = {
        let cutoff_date = latest_date.map(|d| d - chrono::Duration::days(1));
        if let Some(cutoff_date) = cutoff_date {
            cutoff_date
        } else {
            let oldest_date = crate::page_visit_datum::get_oldest_date(conn).await?;
            oldest_date.unwrap_or(date_today) - chrono::Duration::days(1)
        }
    };

    info!(
        "Calculating page view daily stats from {} to {}",
        cutoff_date, yesterday
    );
    let mut current_date = cutoff_date;
    while current_date <= yesterday {
        info!("Calculating page view daily stats for {}", current_date);
        info!("Calculating page view daily stats by courses");
        let res_by_courses =
            crate::page_visit_datum_summary_by_courses::calculate_and_update_for_date(
                conn,
                current_date,
            )
            .await?;
        info!(
            "Calculated {} page view daily stats by courses",
            res_by_courses.len()
        );
        info!("Calculated page view daily stats by pages");
        let res_by_pages = crate::page_visit_datum_summary_by_pages::calculate_and_update_for_date(
            conn,
            current_date,
        )
        .await?;
        info!(
            "Calculated {} page view daily stats by pages",
            res_by_pages.len()
        );
        info!("Calculated page view daily stats by courses device types");
        let res_by_courses_device_types =
            crate::page_visit_datum_summary_by_courses_device_types::calculate_and_update_for_date(
                conn,
                current_date,
            )
            .await?;
        info!(
            "Calculated {} page view daily stats by courses device types",
            res_by_courses_device_types.len()
        );
        let res_by_courses_countries =
            crate::page_visit_datum_summary_by_courses_countries::calculate_and_update_for_date(
                conn,
                current_date,
            )
            .await?;
        info!(
            "Calculated {} page view daily stats by courses countries",
            res_by_courses_countries.len()
        );
        current_date += chrono::Duration::days(1);
    }
    Ok(())
}
