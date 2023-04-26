use std::fmt;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "certificate_paper_size", rename_all = "kebab-case")]
pub enum PaperSize {
    HorizontalA4,
    VerticalA4,
}

impl PaperSize {
    pub fn width_px(&self) -> u32 {
        match self {
            PaperSize::HorizontalA4 => 3508,
            PaperSize::VerticalA4 => 2480,
        }
    }
    pub fn height_px(&self) -> u32 {
        match self {
            PaperSize::HorizontalA4 => 2480,
            PaperSize::VerticalA4 => 3508,
        }
    }
}

/// How text should be positioned relative to the given coordinates. See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-anchor.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "certificate_text_anchor", rename_all = "kebab-case")]
pub enum CertificateTextAnchor {
    Start,
    Middle,
    End,
}

impl fmt::Display for CertificateTextAnchor {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Start => f.write_str("start"),
            Self::Middle => f.write_str("middle"),
            Self::End => f.write_str("end"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModuleCertificateConfiguration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_module_id: Uuid,
    pub course_instance_id: Option<Uuid>,
    pub certificate_owner_name_y_pos: String,
    pub certificate_owner_name_x_pos: String,
    pub certificate_owner_name_font_size: String,
    pub certificate_owner_name_text_color: String,
    pub certificate_owner_name_text_anchor: CertificateTextAnchor,
    pub certificate_validate_url_y_pos: String,
    pub certificate_validate_url_x_pos: String,
    pub certificate_validate_url_font_size: String,
    pub certificate_validate_url_text_color: String,
    pub certificate_validate_url_text_anchor: CertificateTextAnchor,
    pub certificate_date_y_pos: String,
    pub certificate_date_x_pos: String,
    pub certificate_date_font_size: String,
    pub certificate_date_text_color: String,
    pub certificate_date_text_anchor: CertificateTextAnchor,
    pub certificate_locale: String,
    pub paper_size: PaperSize,
    pub background_svg_path: String,
    pub background_svg_file_upload_id: Uuid,
    pub overlay_svg_path: String,
    pub overlay_svg_file_upload_id: Uuid,
}

pub async fn get_course_module_certificate_configuration_by_course_module_and_course_instance(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<CourseModuleCertificateConfiguration> {
    let res = sqlx::query_as!(
        CourseModuleCertificateConfiguration,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_module_id,
  course_instance_id,
  certificate_owner_name_y_pos,
  certificate_owner_name_x_pos,
  certificate_owner_name_font_size,
  certificate_owner_name_text_color,
  certificate_owner_name_text_anchor as "certificate_owner_name_text_anchor: _",
  certificate_validate_url_y_pos,
  certificate_validate_url_x_pos,
  certificate_validate_url_font_size,
  certificate_validate_url_text_color,
  certificate_validate_url_text_anchor as "certificate_validate_url_text_anchor: _",
  certificate_date_y_pos,
  certificate_date_x_pos,
  certificate_date_font_size,
  certificate_date_text_color,
  certificate_date_text_anchor as "certificate_date_text_anchor: _",
  certificate_locale,
  paper_size as "paper_size: _",
  background_svg_path,
  background_svg_file_upload_id,
  overlay_svg_path,
  overlay_svg_file_upload_id
FROM course_module_certificate_configurations
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    // Try to return a course instance specific configuration
    if let Some(config) = res
        .iter()
        .find(|c| c.course_instance_id == Some(course_instance_id))
    {
        return Ok(config.clone());
    }
    // Try to return any configuration that applies for the whole course module regardless of the course instance
    if let Some(config) = res.iter().find(|c| c.course_instance_id.is_none()) {
        return Ok(config.clone());
    }
    Err(ModelError::new(
        ModelErrorType::NotFound,
        "No certificate configuration found for the course module or the course instance"
            .to_string(),
        None,
    ))
}
