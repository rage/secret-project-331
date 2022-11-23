use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use uuid::Uuid;

pub trait Example {
    fn example() -> Self;
}

impl Example for () {
    fn example() -> Self {}
}

impl<T: Example> Example for Option<T> {
    fn example() -> Self {
        Some(T::example())
    }
}

impl<T: Example> Example for Vec<T> {
    fn example() -> Self {
        vec![T::example()]
    }
}

impl Example for Uuid {
    fn example() -> Self {
        Uuid::parse_str("307fa56f-9853-4f5c-afb9-a6736c232f32").unwrap()
    }
}

impl Example for DateTime<Utc> {
    fn example() -> Self {
        Utc.timestamp(1640988000, 0)
    }
}

impl Example for NaiveDate {
    fn example() -> Self {
        NaiveDate::from_ymd(2022, 1, 1)
    }
}

impl Example for i32 {
    fn example() -> Self {
        1234
    }
}

impl Example for u32 {
    fn example() -> Self {
        1234
    }
}

impl Example for u64 {
    fn example() -> Self {
        1234
    }
}

impl Example for i64 {
    fn example() -> Self {
        1234
    }
}

impl Example for f32 {
    fn example() -> Self {
        12.34
    }
}

impl Example for f64 {
    fn example() -> Self {
        12.34
    }
}

impl Example for String {
    fn example() -> Self {
        "Sample string".to_string()
    }
}

impl Example for bool {
    fn example() -> Self {
        false
    }
}
