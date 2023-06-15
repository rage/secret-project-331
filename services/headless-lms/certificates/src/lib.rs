//! For rendering certificates.
//!
//! This is a subcrate because the certificate rendering has its own unique set of dependencies and splitting it makes sense for compilation performance.
//!
pub mod font_loader;

use chrono::{Datelike, NaiveDate};
use futures::future::OptionFuture;
use headless_lms_models::course_module_certificate_configurations::{
    get_by_course_module_and_course_instance, CertificateTextAnchor, PaperSize,
};
use headless_lms_models::course_module_completion_certificates::CourseModuleCompletionCertificate;
use headless_lms_models::prelude::{BackendError, PgConnection};
use headless_lms_utils::file_store::FileStore;
use headless_lms_utils::icu4x::Icu4xBlob;
use headless_lms_utils::prelude::{UtilError, UtilErrorType, UtilResult};
use icu::calendar::Gregorian;
use icu::datetime::TypedDateTimeFormatter;
use resvg::tiny_skia;
use std::path::Path;
use std::time::Instant;
use usvg::{fontdb, TreeParsing, TreeTextToPath};

use quick_xml::{events::BytesText, Writer};
use std::io::Cursor;

use icu::datetime::options::length;
use icu::{calendar::DateTime, locid::Locale};
use icu_provider::DataLocale;
use icu_provider_blob::BlobDataProvider;
use tracing::log::info;

/**
Generates a certificate as a png.

## Arguments

- debug: If true, the certificate will have a red dot at the anchoring points, and the URL will be replaced with a placeholder.
  Should be false when rendering certificates for the students. However, when positioning the texts, this can be used to see why the texts were positioned where they were.
*/
#[allow(clippy::too_many_arguments)]
pub async fn generate_certificate(
    conn: &mut PgConnection,
    file_store: &dyn FileStore,
    certificate: &CourseModuleCompletionCertificate,
    debug: bool,
    icu4x_blob: Icu4xBlob,
) -> UtilResult<Vec<u8>> {
    let config = get_by_course_module_and_course_instance(
        &mut *conn,
        certificate.course_module_id,
        Some(certificate.course_instance_id),
    )
    .await
    .map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Certificate configuration not found".to_string(),
            Some(original_error.into()),
        )
    })?;
    let background_svg = file_store
        .fetch_file_content_or_use_filesystem_cache(Path::new(&config.background_svg_path))
        .await?;
    let overlay_svg = OptionFuture::from(
        config
            .overlay_svg_path
            .as_ref()
            .map(|path| file_store.fetch_file_content_or_use_filesystem_cache(Path::new(path))),
    )
    .await
    .transpose()?;

    let fontdb = font_loader::get_font_database_with_fonts(&mut *conn, file_store).await?;
    let url = if debug {
        "https://courses.mooc.fi/certificates/validate/debug".to_string()
    } else {
        format!(
            // TODO: use base url here
            "https://courses.mooc.fi/certificates/validate/{}",
            certificate.verification_id
        )
    };
    let date = if debug {
        // TODO: this fixes the date for system tests, not a great solution...
        NaiveDate::from_ymd_opt(2023, 1, 1).unwrap()
    } else {
        certificate.created_at.date_naive()
    };
    let texts_to_render = vec![
        TextToRender {
            text: certificate.name_on_certificate.to_string(),
            y_pos: config.certificate_owner_name_y_pos,
            x_pos: config.certificate_owner_name_x_pos,
            font_size: config.certificate_owner_name_font_size,
            text_anchor: config.certificate_owner_name_text_anchor,
            text_color: config.certificate_owner_name_text_color,
            ..Default::default()
        },
        TextToRender {
            text: url,
            y_pos: config.certificate_validate_url_y_pos,
            x_pos: config.certificate_validate_url_x_pos,
            font_size: config.certificate_validate_url_font_size,
            text_anchor: config.certificate_validate_url_text_anchor,
            text_color: config.certificate_validate_url_text_color,
            ..Default::default()
        },
        TextToRender {
            text: get_date_as_localized_string(&config.certificate_locale, date, icu4x_blob)?,
            y_pos: config.certificate_date_y_pos,
            x_pos: config.certificate_date_x_pos,
            font_size: config.certificate_date_font_size,
            text_anchor: config.certificate_date_text_anchor,
            text_color: config.certificate_date_text_color,
            ..Default::default()
        },
    ];
    let paper_size = config.paper_size;

    let res = generate_certificate_impl(
        &background_svg,
        overlay_svg.as_deref(),
        &texts_to_render,
        &paper_size,
        debug,
        &fontdb,
    )?;
    Ok(res)
}

fn generate_certificate_impl(
    background_svg: &[u8],
    overlay_svg: Option<&[u8]>,
    texts: &[TextToRender],
    paper_size: &PaperSize,
    debug_show_anchoring_points: bool,
    fontdb: &fontdb::Database,
) -> UtilResult<Vec<u8>> {
    let start_setup = Instant::now();
    let opt = usvg::Options {
        font_family: "Lato".to_string(),
        dpi: 600.0,
        image_rendering: usvg::ImageRendering::OptimizeQuality,
        shape_rendering: usvg::ShapeRendering::GeometricPrecision,
        text_rendering: usvg::TextRendering::OptimizeLegibility,
        ..Default::default()
    };

    let mut pixmap = resvg::tiny_skia::Pixmap::new(paper_size.width_px(), paper_size.height_px())
        .ok_or_else(|| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not create a pixmap".to_string(),
            None,
        )
    })?;
    info!("Setup time {:?}", start_setup.elapsed());
    let parse_background_svg_start = Instant::now();
    let rtree = {
        let mut rtree = usvg::Tree::from_data(background_svg, &opt).map_err(|original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "Could not parse background svg".to_string(),
                Some(original_error.into()),
            )
        })?;
        rtree.convert_text(fontdb);
        resvg::Tree::from_usvg(&rtree)
    };

    info!(
        "Parse background svg time {:?}",
        parse_background_svg_start.elapsed()
    );

    let start_render_background = Instant::now();
    // TODO transform too backgrounds to be exactly the right size
    rtree.render(resvg::tiny_skia::Transform::default(), &mut pixmap.as_mut());

    info!(
        "Render background time {:?}",
        start_render_background.elapsed()
    );

    let text_svg_data = generate_text_svg(texts, debug_show_anchoring_points, paper_size)?;
    info!("{}", String::from_utf8_lossy(&text_svg_data));
    let parse_text_svg_start = Instant::now();
    let text_rtree = {
        let mut text_rtree =
            usvg::Tree::from_data(&text_svg_data, &opt).map_err(|original_error| {
                UtilError::new(
                    UtilErrorType::Other,
                    "Could not parse text svg".to_string(),
                    Some(original_error.into()),
                )
            })?;
        text_rtree.convert_text(fontdb);
        resvg::Tree::from_usvg(&text_rtree)
    };

    info!("Parse text svg time {:?}", parse_text_svg_start.elapsed());

    let render_text_start = Instant::now();
    text_rtree.render(tiny_skia::Transform::default(), &mut pixmap.as_mut());
    info!("Render text time {:?}", render_text_start.elapsed());

    if let Some(overlay_svg) = overlay_svg {
        let start_render_overlay = Instant::now();
        let overlay_rtree = {
            let mut overlay_rtree =
                usvg::Tree::from_data(overlay_svg, &opt).map_err(|original_error| {
                    UtilError::new(
                        UtilErrorType::Other,
                        "Could not parse overlay svg".to_string(),
                        Some(original_error.into()),
                    )
                })?;
            overlay_rtree.convert_text(fontdb);
            resvg::Tree::from_usvg(&overlay_rtree)
        };

        overlay_rtree.render(tiny_skia::Transform::default(), &mut pixmap.as_mut());

        info!("Overlay time {:?}", start_render_overlay.elapsed());
    }

    let save_png_start = Instant::now();
    let png = pixmap.encode_png().map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Could convert pixmap to png".to_string(),
            Some(original_error.into()),
        )
    })?;
    info!("Save png time {:?}", save_png_start.elapsed());
    Ok(png)
}

fn get_date_as_localized_string(
    locale: &str,
    certificate_date: NaiveDate,
    icu4x_blob: Icu4xBlob,
) -> UtilResult<String> {
    let options = length::Bag::from_date_style(length::Date::Long).into();
    let provider = BlobDataProvider::try_new_from_static_blob(icu4x_blob.get()).unwrap();
    let locale = locale.parse::<Locale>().map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not parse locale".to_string(),
            Some(original_error.into()),
        )
    })?;
    let dtf = TypedDateTimeFormatter::<Gregorian>::try_new_with_buffer_provider(
        &provider,
        &DataLocale::from(locale),
        options,
    )
    .map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Failed to create TypedDateTimeFormatter instance.".to_string(),
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

pub struct TextToRender {
    pub text: String,
    pub font_family: String,
    pub font_size: String,
    pub text_color: String,
    pub x_pos: String,
    pub y_pos: String,
    /// How to align the text related to x_pos and y_pos. See: <https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor>.
    pub text_anchor: CertificateTextAnchor,
}

impl Default for TextToRender {
    fn default() -> Self {
        Self {
            font_family: "Lato".to_string(),
            font_size: "150px".to_string(),
            text_color: "black".to_string(),
            x_pos: "50%".to_string(),
            y_pos: "50%".to_string(),
            text: "Example text".to_string(),
            text_anchor: CertificateTextAnchor::Middle,
        }
    }
}

fn generate_text_svg(
    texts: &[TextToRender],
    debug_show_anchoring_points: bool,
    paper_size: &PaperSize,
) -> UtilResult<Vec<u8>> {
    let mut writer = Writer::new(Cursor::new(Vec::new()));
    writer
        .create_element("svg")
        .with_attribute(("width", format!("{}px", paper_size.width_px()).as_str()))
        .with_attribute(("height", format!("{}px", paper_size.height_px()).as_str()))
        .with_attribute(("xmlns", "http://www.w3.org/2000/svg"))
        .write_inner_content(|writer| {
            for text in texts {
                writer
                    .create_element("text")
                    .with_attribute(("x", text.x_pos.as_str()))
                    .with_attribute(("y", text.y_pos.as_str()))
                    .with_attribute((
                        "style",
                        format!(
                            "font-size: {}; font-family: {}; fill: {}; font-weight: 400;",
                            text.font_size, text.font_family, text.text_color
                        )
                        .as_str(),
                    ))
                    .with_attribute(("text-anchor", text.text_anchor.to_string().as_str()))
                    .write_text_content(BytesText::from_escaped(&text.text))
                    .map_err(|_original_error| {
                        // Might not be optimal but that's the Error type of the closure that comes from the library and we don't want to unwrap here and potentially crash the process.
                        quick_xml::Error::UnexpectedToken("Could not write text to svg".to_string())
                    })?;

                if debug_show_anchoring_points {
                    writer
                        .create_element("circle")
                        .with_attribute(("cx", text.x_pos.as_str()))
                        .with_attribute(("cy", text.y_pos.as_str()))
                        .with_attribute(("r", "5"))
                        .with_attribute(("fill", "#da2e2e"))
                        .write_empty()
                        .map_err(|_original_error| {
                            // Might not be optimal but that's the Error type of the closure that comes from the library and we don't want to unwrap here and potentially crash the process.
                            quick_xml::Error::UnexpectedToken(
                                "Could not write debug point to svg".to_string(),
                            )
                        })?;
                    writer
                        .create_element("circle")
                        .with_attribute(("cx", text.x_pos.as_str()))
                        .with_attribute(("cy", text.y_pos.as_str()))
                        .with_attribute(("r", "3"))
                        .with_attribute(("fill", "#ff9b9b"))
                        .write_empty()
                        .map_err(|_original_error| {
                            // Might not be optimal but that's the Error type of the closure that comes from the library and we don't want to unwrap here and potentially crash the process.
                            quick_xml::Error::UnexpectedToken(
                                "Could not write debug point to svg".to_string(),
                            )
                        })?;
                }
            }
            Ok(())
        })
        .map_err(|original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "Could not write text svg".to_string(),
                Some(original_error.into()),
            )
        })?;

    Ok(writer.into_inner().into_inner())
}
