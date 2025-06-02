use chrono::NaiveDate;
use headless_lms_utils::prelude::BackendError;
use headless_lms_utils::{
    icu4x::Icu4xBlob,
    prelude::{UtilError, UtilErrorType, UtilResult},
};
use icu::locale::Locale;
use icu::time::DateTime;
use icu_provider::DataLocale;
use icu_provider_blob::BlobDataProvider;

pub(crate) fn get_date_as_localized_string(
    locale: &str,
    certificate_date: NaiveDate,
    icu4x_blob: Icu4xBlob,
) -> UtilResult<String> {
    let options = Bag::from_date_style(Date::Long).into();
    let provider = BlobDataProvider::try_new_from_static_blob(icu4x_blob.get()).unwrap();
    let locale = locale.parse::<Locale>().map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not parse locale".to_string(),
            Some(original_error.into()),
        )
    })?;
    let dtf = DateTimeFormatter::<Gregorian>::try_new_with_buffer_provider(
        &provider,
        &DataLocale::from(locale),
        options,
    )
    .map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Failed to create DateTimeFormatter instance.".to_string(),
            Some(original_error.into()),
        )
    })?;

    let date = DateTime::try_new_gregorian_datetime(
        certificate_date.year(),
        certificate_date.month() as u8,
        certificate_date.day() as u8,
        12,
        35,
        0,
    )
    .map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Failed to parse date.".to_string(),
            Some(original_error.into()),
        )
    })?;
    let formatted_date = dtf.format(&date);
    Ok(formatted_date.to_string())
}
