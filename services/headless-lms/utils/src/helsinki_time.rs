//! The calendar date in Helsinki, which is the date the university's registry reckons in.

use chrono::{DateTime, Datelike, NaiveDate, Utc, Weekday};

/// The date an instant falls on in Helsinki, which is the date an official transcript gets: a
/// completion at 23:30 UTC on the 31st is the 1st. The EU summer-time rule is written out rather
/// than read from a timezone database, which this crate does not carry.
pub fn helsinki_date(instant: DateTime<Utc>) -> NaiveDate {
    let offset = chrono::Duration::hours(if in_eu_summer_time(instant) { 3 } else { 2 });
    (instant + offset).date_naive()
}

fn in_eu_summer_time(instant: DateTime<Utc>) -> bool {
    let year = instant.year();
    let Some(starts) = last_sunday(year, 3).and_then(|day| day.and_hms_opt(1, 0, 0)) else {
        return false;
    };
    let Some(ends) = last_sunday(year, 10).and_then(|day| day.and_hms_opt(1, 0, 0)) else {
        return false;
    };
    let naive = instant.naive_utc();
    naive >= starts && naive < ends
}

fn last_sunday(year: i32, month: u32) -> Option<NaiveDate> {
    let first_of_next = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }?;
    let last = first_of_next.pred_opt()?;
    Some(last - chrono::Duration::days(i64::from(last.weekday().days_since(Weekday::Sun))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_attainment_date_is_the_helsinki_date() {
        let winter_evening: DateTime<Utc> = "2026-01-31T23:30:00Z".parse().expect("valid instant");
        assert_eq!(
            helsinki_date(winter_evening),
            NaiveDate::from_ymd_opt(2026, 2, 1).expect("valid date")
        );
        let summer_evening: DateTime<Utc> = "2026-07-31T21:30:00Z".parse().expect("valid instant");
        assert_eq!(
            helsinki_date(summer_evening),
            NaiveDate::from_ymd_opt(2026, 8, 1).expect("valid date")
        );
        let summer_afternoon: DateTime<Utc> =
            "2026-07-31T12:00:00Z".parse().expect("valid instant");
        assert_eq!(
            helsinki_date(summer_afternoon),
            NaiveDate::from_ymd_opt(2026, 7, 31).expect("valid date")
        );
    }

    #[test]
    fn summer_time_starts_and_ends_on_the_documented_sundays() {
        let before_spring: DateTime<Utc> = "2026-03-29T00:59:00Z".parse().expect("valid instant");
        let after_spring: DateTime<Utc> = "2026-03-29T01:00:00Z".parse().expect("valid instant");
        assert!(!in_eu_summer_time(before_spring));
        assert!(in_eu_summer_time(after_spring));

        let before_autumn: DateTime<Utc> = "2026-10-25T00:59:00Z".parse().expect("valid instant");
        let after_autumn: DateTime<Utc> = "2026-10-25T01:00:00Z".parse().expect("valid instant");
        assert!(in_eu_summer_time(before_autumn));
        assert!(!in_eu_summer_time(after_autumn));
    }
}
