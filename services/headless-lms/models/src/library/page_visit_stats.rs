//! Functions for precomputing anonymous aggregate statistics about page visits.

use crate::prelude::*;

/// Calculates the latest statistics for dates that are not yet calculated yet.
pub async fn calculate_latest(conn: &mut PgConnection) -> ModelResult<()> {
    let latest_date = crate::page_view_daily_referrer_stats::get_latest_date(conn).await?;
    let date_today = Utc::now().naive_utc().date();
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
        cutoff_date, date_today
    );
    let mut current_date = cutoff_date;
    while current_date <= date_today {
        info!("Calculating page view daily stats for {}", current_date);
        current_date += chrono::Duration::days(1);
    }
    Ok(())
}
