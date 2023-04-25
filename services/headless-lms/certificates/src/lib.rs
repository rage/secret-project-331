//! For rendering certificates.
//!
//! This is a subcrate because the certificate rendering has its own unique set of dependencies and splitting it makes sense for compilation performance.
//!
pub mod font_loader;

use core::fmt;
use headless_lms_models::prelude::{BackendError, PgConnection};
use headless_lms_utils::file_store::FileStore;
use headless_lms_utils::prelude::{UtilError, UtilErrorType, UtilResult};
use resvg::FitTo;
use std::time::Instant;
use usvg::{fontdb, TreeParsing, TreeTextToPath};

use quick_xml::{events::BytesText, Writer};
use std::io::Cursor;

use icu::datetime::{options::length, DateTimeFormatter};
use icu::{calendar::DateTime, locid::Locale};
use icu_provider::DataLocale;

pub async fn generate_certificate_wrapper(
    conn: &mut PgConnection,
    file_store: &impl FileStore,
    background_svg: &[u8],
) -> UtilResult<Vec<u8>> {
    let fontdb = font_loader::get_font_database_with_fonts(&mut *conn, file_store).await?;
    let texts_to_render = vec![
        TextToRender {
            text: "Loller 74".to_string(),
            y_pos: "70%".to_string(),
            ..Default::default()
        },
        TextToRender {
            text: "https://courses.mooc.fi/certificates/validate/xxxxxxxx-xxxxxxxxxxxxxxx"
                .to_string(),
            font_size: "30px".to_string(),
            x_pos: "80%".to_string(),
            y_pos: "88.5%".to_string(),
            text_anchor: TextAnchorValue::End,
            ..Default::default()
        },
        TextToRender {
            text: get_current_date_as_localized_string("fi")?,
            font_size: "30px".to_string(),
            x_pos: "15%".to_string(),
            y_pos: "88.5%".to_string(),
            text_anchor: TextAnchorValue::Start,
            text_color: "#c86dc0".to_string(),
            ..Default::default()
        },
    ];
    let paper_size = PaperSize::HorizontalA4;
    let text_generation_options = TextGenerationOptions {
        debug_show_anchoring_points: true,
    };
    let res = generate_certificate(
        background_svg,
        None,
        &texts_to_render,
        &paper_size,
        &text_generation_options,
        &fontdb,
    )?;
    Ok(res)
}

fn generate_certificate(
    background_svg: &[u8],
    overlay_svg: Option<&[u8]>,
    texts: &[TextToRender],
    paper_size: &PaperSize,
    text_generation_options: &TextGenerationOptions,
    fontdb: &fontdb::Database,
) -> UtilResult<Vec<u8>> {
    let start_setup = Instant::now();
    let opt = usvg::Options {
        font_family: "Josefin Sans".to_string(),
        dpi: 600.0,
        image_rendering: usvg::ImageRendering::OptimizeQuality,
        shape_rendering: usvg::ShapeRendering::GeometricPrecision,
        text_rendering: usvg::TextRendering::OptimizeLegibility,
        ..Default::default()
    };

    let mut pixmap = tiny_skia::Pixmap::new(paper_size.width_px(), paper_size.height_px())
        .ok_or_else(|| {
            UtilError::new(
                UtilErrorType::Other,
                "Could not create a pixmap".to_string(),
                None,
            )
        })?;
    println!("Setup time {:?}", start_setup.elapsed());
    let parse_background_svg_start = Instant::now();
    let mut rtree = usvg::Tree::from_data(background_svg, &opt).map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not parse background svg".to_string(),
            Some(original_error.into()),
        )
    })?;
    rtree.convert_text(fontdb);
    println!(
        "Parse background svg time {:?}",
        parse_background_svg_start.elapsed()
    );

    let start_render_background = Instant::now();
    resvg::render(
        &rtree,
        FitTo::Size(paper_size.width_px(), paper_size.height_px()),
        tiny_skia::Transform::default(),
        pixmap.as_mut(),
    )
    .ok_or_else(|| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not render background svg".to_string(),
            None,
        )
    })?;

    println!(
        "Render background time {:?}",
        start_render_background.elapsed()
    );

    let text_svg_data = generate_text_svg(texts, text_generation_options, paper_size)?;
    println!("{}", String::from_utf8_lossy(&text_svg_data));
    let parse_text_svg_start = Instant::now();
    let mut text_rtree = usvg::Tree::from_data(&text_svg_data, &opt).map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not parse text svg".to_string(),
            Some(original_error.into()),
        )
    })?;
    text_rtree.convert_text(fontdb);
    println!("Parse text svg time {:?}", parse_text_svg_start.elapsed());

    let render_text_start = Instant::now();
    resvg::render(
        &text_rtree,
        FitTo::Original,
        tiny_skia::Transform::default(),
        pixmap.as_mut(),
    )
    .ok_or_else(|| {
        UtilError::new(
            UtilErrorType::Other,
            "Could not render text svg".to_string(),
            None,
        )
    })?;
    println!("Render text time {:?}", render_text_start.elapsed());

    if let Some(overlay_svg) = overlay_svg {
        let start_render_overlay = Instant::now();
        let overlay_rtree = usvg::Tree::from_data(overlay_svg, &opt).map_err(|original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "Could not parse overlay svg".to_string(),
                Some(original_error.into()),
            )
        })?;
        resvg::render(
            &overlay_rtree,
            FitTo::Size(paper_size.width_px(), paper_size.height_px()),
            tiny_skia::Transform::default(),
            pixmap.as_mut(),
        )
        .ok_or_else(|| {
            UtilError::new(
                UtilErrorType::Other,
                "Could not render overlay svg".to_string(),
                None,
            )
        })?;

        println!("Overlay time {:?}", start_render_overlay.elapsed());
    }

    let save_png_start = Instant::now();
    let png = pixmap.encode_png().map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Could convert pixmap to png".to_string(),
            Some(original_error.into()),
        )
    })?;
    println!("Save png time {:?}", save_png_start.elapsed());
    Ok(png)
}

fn get_current_date_as_localized_string(locale: &str) -> UtilResult<String> {
    let options = length::Bag::from_date_style(length::Date::Long).into();

    let dtf = DateTimeFormatter::try_new_unstable(
        &icu_testdata::unstable(),
        &DataLocale::from(locale.parse::<Locale>().map_err(|original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "Could not parse locale".to_string(),
                Some(original_error.into()),
            )
        })?),
        options,
    )
    .map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Failed to create DateTimeFormatter instance.".to_string(),
            Some(original_error.into()),
        )
    })?;

    let date =
        DateTime::try_new_iso_datetime(2020, 9, 12, 12, 35, 0).map_err(|original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "Failed to parse date.".to_string(),
                Some(original_error.into()),
            )
        })?;
    let date = date.to_any();

    let formatted_date = dtf.format(&date).map_err(|original_error| {
        UtilError::new(
            UtilErrorType::Other,
            "Formatting date failed.".to_string(),
            Some(original_error.into()),
        )
    })?;
    Ok(formatted_date.to_string())
}

#[derive(Default)]
pub struct TextGenerationOptions {
    pub debug_show_anchoring_points: bool,
}

pub struct TextToRender {
    pub text: String,
    pub font_family: String,
    pub font_size: String,
    pub text_color: String,
    pub x_pos: String,
    pub y_pos: String,
    /// How to align the text related to x_pos and y_pos. See: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor.
    pub text_anchor: TextAnchorValue,
}

pub enum TextAnchorValue {
    Start,
    Middle,
    End,
}

impl fmt::Display for TextAnchorValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TextAnchorValue::Start => f.write_str("start"),
            TextAnchorValue::Middle => f.write_str("middle"),
            TextAnchorValue::End => f.write_str("end"),
        }
    }
}

pub enum PaperSize {
    HorizontalA4,
    VerticalA4,
}

impl PaperSize {
    fn width_px(&self) -> u32 {
        match self {
            PaperSize::HorizontalA4 => 3508,
            PaperSize::VerticalA4 => 248,
        }
    }
    fn height_px(&self) -> u32 {
        match self {
            PaperSize::HorizontalA4 => 2480,
            PaperSize::VerticalA4 => 3508,
        }
    }
}

impl Default for TextToRender {
    fn default() -> Self {
        Self {
            font_family: "Josefin Sans".to_string(),
            font_size: "150px".to_string(),
            text_color: "black".to_string(),
            x_pos: "50%".to_string(),
            y_pos: "50%".to_string(),
            text: "Example text".to_string(),
            text_anchor: TextAnchorValue::Middle,
        }
    }
}

fn generate_text_svg(
    texts: &[TextToRender],
    options: &TextGenerationOptions,
    paper_size: &PaperSize,
) -> UtilResult<Vec<u8>> {
    let mut writer = Writer::new(Cursor::new(Vec::new()));
    writer
        .create_element("svg")
        .with_attribute(("width", format!("{}px", paper_size.width_px()).as_str()))
        .with_attribute(("height", format!("{}px", paper_size.height_px()).as_str()))
        // .with_attribute(("viewBox", "0 0 297 210"))
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

                if options.debug_show_anchoring_points {
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
