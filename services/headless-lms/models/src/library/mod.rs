use crate::prelude::*;

pub mod content_management;
pub mod copying;
pub mod course_instances;
pub mod course_stats;
pub mod custom_view_exercises;
pub mod global_stats;
pub mod grading;
pub mod page_visit_stats;
pub mod peer_or_self_reviewing;
pub mod progressing;
pub mod regrading;
pub mod user_exercise_state_updater;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum TimeGranularity {
    Year,
    Month,
    Day,
}

impl TimeGranularity {
    /// Returns (interval_unit, time_unit) for use in SQL queries
    /// e.g., ("years", "year") for TimeGranularity::Year
    pub fn get_sql_units(&self) -> (&'static str, &'static str) {
        match self {
            TimeGranularity::Year => ("years", "year"),
            TimeGranularity::Month => ("months", "month"),
            TimeGranularity::Day => ("days", "day"),
        }
    }
}

impl std::fmt::Display for TimeGranularity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TimeGranularity::Year => write!(f, "Year"),
            TimeGranularity::Month => write!(f, "Month"),
            TimeGranularity::Day => write!(f, "Day"),
        }
    }
}

#[derive(Debug)]
pub struct ParseTimeGranularityError;

impl std::fmt::Display for ParseTimeGranularityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "invalid time granularity")
    }
}

impl std::error::Error for ParseTimeGranularityError {}

impl std::str::FromStr for TimeGranularity {
    type Err = ParseTimeGranularityError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "year" => Ok(TimeGranularity::Year),
            "month" => Ok(TimeGranularity::Month),
            "day" => Ok(TimeGranularity::Day),
            _ => Err(ParseTimeGranularityError),
        }
    }
}

impl TryFrom<String> for TimeGranularity {
    type Error = ParseTimeGranularityError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        value.parse()
    }
}
