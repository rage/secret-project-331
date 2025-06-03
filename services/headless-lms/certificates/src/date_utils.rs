use chrono::{NaiveDate, NaiveTime};
use headless_lms_utils::prelude::BackendError;
use headless_lms_utils::{
    icu4x::Icu4xBlob,
    prelude::{UtilError, UtilErrorType, UtilResult},
};
use icu::calendar::Gregorian;
use icu::datetime::fieldsets::YMD;
use icu::datetime::{DateTimeFormatter, DateTimeFormatterPreferences};
use icu::locale::Locale;
use icu::time::DateTime;
use icu_provider_blob::BlobDataProvider;

/// Converts a date to a localized string representation using ICU4X.
///
/// # Arguments
/// * `locale` - The locale string (e.g., "en-US", "fi-FI")
/// * `certificate_date` - The date to format
/// * `icu4x_blob` - The ICU4X data blob for localization
///
/// # Returns
/// A localized string representation of the date
pub(crate) fn get_date_as_localized_string(
    locale: &str,
    certificate_date: NaiveDate,
    icu4x_blob: Icu4xBlob,
) -> UtilResult<String> {
    let parsed_locale = parse_locale(locale)?;
    let formatter_preferences = create_formatter_preferences(&parsed_locale);
    let data_provider = create_blob_data_provider(icu4x_blob)?;
    let date_formatter = create_date_formatter(&data_provider, formatter_preferences)?;
    let icu_datetime = naive_date_to_icu_datetime(certificate_date)?;

    let formatted_date = date_formatter.format(&icu_datetime);
    Ok(formatted_date.to_string())
}

/// Parse a locale string into an ICU Locale.
fn parse_locale(locale_str: &str) -> UtilResult<Locale> {
    locale_str.parse::<Locale>().map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not parse locale".to_string(),
            Some(original_error.into()),
        )
    })
}

/// Create DateTimeFormatterPreferences with the given locale.
fn create_formatter_preferences(locale: &Locale) -> DateTimeFormatterPreferences {
    let mut preferences = DateTimeFormatterPreferences::default();
    preferences.locale_preferences = locale.into();
    preferences
}

/// Create a BlobDataProvider from the ICU4X blob.
fn create_blob_data_provider(icu4x_blob: Icu4xBlob) -> UtilResult<BlobDataProvider> {
    BlobDataProvider::try_new_from_static_blob(icu4x_blob.get()).map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Failed to create BlobDataProvider instance.".to_string(),
            Some(original_error.into()),
        )
    })
}

/// Create a DateTimeFormatter with the given provider and preferences.
fn create_date_formatter(
    provider: &BlobDataProvider,
    preferences: DateTimeFormatterPreferences,
) -> UtilResult<DateTimeFormatter<YMD>> {
    DateTimeFormatter::try_new_with_buffer_provider(provider, preferences, YMD::long()).map_err(
        |original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "Failed to create DateTimeFormatter instance.".to_string(),
                Some(original_error.into()),
            )
        },
    )
}

/// Convert a `NaiveDate` to an `icu::time::DateTime`.
///
/// Sets the time to the middle of the day (12:35:03.12) to avoid accidental
/// timezone changes affecting the date portion.
fn naive_date_to_icu_datetime(date: NaiveDate) -> UtilResult<DateTime<Gregorian>> {
    let midday_time = NaiveTime::from_hms_milli_opt(12, 35, 3, 12).ok_or_else(|| {
        UtilError::new(
            UtilErrorType::Other,
            "Failed to convert time.".to_string(),
            None,
        )
    })?;

    let datetime_with_timezone = date.and_time(midday_time).and_utc();
    let rfc3339_string = datetime_with_timezone.to_rfc3339();

    DateTime::try_from_str(&rfc3339_string, Gregorian).map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Failed to convert date to DateTime.".to_string(),
            Some(original_error.into()),
        )
    })
}
