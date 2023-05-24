use std::fmt;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "kebab-case")]
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
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "kebab-case")]
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
    pub overlay_svg_path: Option<String>,
    pub overlay_svg_file_upload_id: Option<Uuid>,
}

pub async fn get_course_id_of(
    conn: &mut PgConnection,
    certificate_configuration_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
SELECT c.id
FROM course_module_certificate_configurations AS cmcc
JOIN course_modules AS cm ON cmcc.course_module_id = cm.id
JOIN courses AS c ON cm.course_id = c.id
WHERE cmcc.id = $1
AND cmcc.deleted_at IS NULL
    "#,
        certificate_configuration_id,
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_course_module_and_course_instance(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_instance_id: Option<Uuid>,
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
        .find(|c| c.course_instance_id == course_instance_id)
    {
        return Ok(config.clone());
    }
    // Try to return any configuration that applies for the whole course module regardless of the course instance
    if let Some(config) = res.iter().find(|c| c.course_instance_id.is_none()) {
        return Ok(config.clone());
    }
    Err(ModelError::new(
        ModelErrorType::RecordNotFound,
        "No certificate configuration found for the course module or the course instance"
            .to_string(),
        None,
    ))
}

pub async fn get_course_module_certificate_configurations_by_course_instance(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<CourseModuleCertificateConfiguration>> {
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
WHERE course_instance_id = $1
  AND deleted_at IS NULL
        "#,
        course_instance_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct DatabaseCourseModuleCertificateConfiguration {
    pub course_module_id: Uuid,
    pub course_instance_id: Option<Uuid>,
    pub certificate_owner_name_y_pos: Option<String>,
    pub certificate_owner_name_x_pos: Option<String>,
    pub certificate_owner_name_font_size: Option<String>,
    pub certificate_owner_name_text_color: Option<String>,
    pub certificate_owner_name_text_anchor: Option<CertificateTextAnchor>,
    pub certificate_validate_url_y_pos: Option<String>,
    pub certificate_validate_url_x_pos: Option<String>,
    pub certificate_validate_url_font_size: Option<String>,
    pub certificate_validate_url_text_color: Option<String>,
    pub certificate_validate_url_text_anchor: Option<CertificateTextAnchor>,
    pub certificate_date_y_pos: Option<String>,
    pub certificate_date_x_pos: Option<String>,
    pub certificate_date_font_size: Option<String>,
    pub certificate_date_text_color: Option<String>,
    pub certificate_date_text_anchor: Option<CertificateTextAnchor>,
    pub certificate_locale: Option<String>,
    pub paper_size: Option<PaperSize>,
    pub background_svg_path: String,
    pub background_svg_file_upload_id: Uuid,
    pub overlay_svg_path: Option<String>,
    pub overlay_svg_file_upload_id: Option<Uuid>,
}

impl DatabaseCourseModuleCertificateConfiguration {
    /// Uses the same default values as the `CREATE TABLE` statement for `course_module_certificate_configurations`.
    /// A little inconvenient, if there's a better way to turn a None into the default value for the row this can be refactored out.
    fn build(&self) -> DatabaseCourseModuleCertificateConfigurationInner<'_> {
        DatabaseCourseModuleCertificateConfigurationInner {
            course_module_id: self.course_module_id,
            course_instance_id: self.course_instance_id,
            certificate_owner_name_y_pos: self
                .certificate_owner_name_y_pos
                .as_deref()
                .unwrap_or("70%"),
            certificate_owner_name_x_pos: self
                .certificate_owner_name_x_pos
                .as_deref()
                .unwrap_or("50%"),
            certificate_owner_name_font_size: self
                .certificate_owner_name_font_size
                .as_deref()
                .unwrap_or("150px"),
            certificate_owner_name_text_color: self
                .certificate_owner_name_text_color
                .as_deref()
                .unwrap_or("black"),
            certificate_owner_name_text_anchor: self
                .certificate_owner_name_text_anchor
                .unwrap_or(CertificateTextAnchor::Middle),
            certificate_validate_url_y_pos: self
                .certificate_validate_url_y_pos
                .as_deref()
                .unwrap_or("80%"),
            certificate_validate_url_x_pos: self
                .certificate_validate_url_x_pos
                .as_deref()
                .unwrap_or("88.5%"),
            certificate_validate_url_font_size: self
                .certificate_validate_url_font_size
                .as_deref()
                .unwrap_or("30px"),
            certificate_validate_url_text_color: self
                .certificate_validate_url_text_color
                .as_deref()
                .unwrap_or("black"),
            certificate_validate_url_text_anchor: self
                .certificate_validate_url_text_anchor
                .unwrap_or(CertificateTextAnchor::End),
            certificate_date_y_pos: self.certificate_date_y_pos.as_deref().unwrap_or("88.5%"),
            certificate_date_x_pos: self.certificate_date_x_pos.as_deref().unwrap_or("15%"),
            certificate_date_font_size: self
                .certificate_date_font_size
                .as_deref()
                .unwrap_or("30px"),
            certificate_date_text_color: self
                .certificate_date_text_color
                .as_deref()
                .unwrap_or("black"),
            certificate_date_text_anchor: self
                .certificate_date_text_anchor
                .unwrap_or(CertificateTextAnchor::Start),
            certificate_locale: self.certificate_locale.as_deref().unwrap_or("en"),
            paper_size: self.paper_size.unwrap_or(PaperSize::HorizontalA4),
            background_svg_path: &self.background_svg_path,
            background_svg_file_upload_id: self.background_svg_file_upload_id,
            overlay_svg_path: self.overlay_svg_path.as_deref(),
            overlay_svg_file_upload_id: self.overlay_svg_file_upload_id,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
struct DatabaseCourseModuleCertificateConfigurationInner<'a> {
    pub course_module_id: Uuid,
    pub course_instance_id: Option<Uuid>,
    pub certificate_owner_name_y_pos: &'a str,
    pub certificate_owner_name_x_pos: &'a str,
    pub certificate_owner_name_font_size: &'a str,
    pub certificate_owner_name_text_color: &'a str,
    pub certificate_owner_name_text_anchor: CertificateTextAnchor,
    pub certificate_validate_url_y_pos: &'a str,
    pub certificate_validate_url_x_pos: &'a str,
    pub certificate_validate_url_font_size: &'a str,
    pub certificate_validate_url_text_color: &'a str,
    pub certificate_validate_url_text_anchor: CertificateTextAnchor,
    pub certificate_date_y_pos: &'a str,
    pub certificate_date_x_pos: &'a str,
    pub certificate_date_font_size: &'a str,
    pub certificate_date_text_color: &'a str,
    pub certificate_date_text_anchor: CertificateTextAnchor,
    pub certificate_locale: &'a str,
    pub paper_size: PaperSize,
    pub background_svg_path: &'a str,
    pub background_svg_file_upload_id: Uuid,
    pub overlay_svg_path: Option<&'a str>,
    pub overlay_svg_file_upload_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    conf: &DatabaseCourseModuleCertificateConfiguration,
) -> ModelResult<CourseModuleCertificateConfiguration> {
    let conf = conf.build();
    let configuration = sqlx::query_as!(
        CourseModuleCertificateConfiguration,
        r#"
INSERT INTO public.course_module_certificate_configurations (
    course_module_id,
    course_instance_id,
    certificate_owner_name_y_pos,
    certificate_owner_name_x_pos,
    certificate_owner_name_font_size,
    certificate_owner_name_text_color,
    certificate_owner_name_text_anchor,
    certificate_validate_url_y_pos,
    certificate_validate_url_x_pos,
    certificate_validate_url_font_size,
    certificate_validate_url_text_color,
    certificate_validate_url_text_anchor,
    certificate_date_y_pos,
    certificate_date_x_pos,
    certificate_date_font_size,
    certificate_date_text_color,
    certificate_date_text_anchor,
    certificate_locale,
    paper_size,
    background_svg_path,
    background_svg_file_upload_id,
    overlay_svg_path,
    overlay_svg_file_upload_id
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17,
    $18,
    $19,
    $20,
    $21,
    $22,
    $23
  )
RETURNING id,
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
"#,
        conf.course_module_id,
        conf.course_instance_id,
        conf.certificate_owner_name_y_pos,
        conf.certificate_owner_name_x_pos,
        conf.certificate_owner_name_font_size,
        conf.certificate_owner_name_text_color,
        conf.certificate_owner_name_text_anchor as CertificateTextAnchor,
        conf.certificate_validate_url_y_pos,
        conf.certificate_validate_url_x_pos,
        conf.certificate_validate_url_font_size,
        conf.certificate_validate_url_text_color,
        conf.certificate_validate_url_text_anchor as CertificateTextAnchor,
        conf.certificate_date_y_pos,
        conf.certificate_date_x_pos,
        conf.certificate_date_font_size,
        conf.certificate_date_text_color,
        conf.certificate_date_text_anchor as CertificateTextAnchor,
        conf.certificate_locale,
        conf.paper_size as PaperSize,
        conf.background_svg_path,
        conf.background_svg_file_upload_id,
        conf.overlay_svg_path,
        conf.overlay_svg_file_upload_id
    )
    .fetch_one(conn)
    .await?;
    Ok(configuration)
}

pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    conf: &DatabaseCourseModuleCertificateConfiguration,
) -> ModelResult<()> {
    let conf = conf.build();
    sqlx::query!(
        r#"
UPDATE public.course_module_certificate_configurations
SET course_module_id = $1,
  course_instance_id = $2,
  certificate_owner_name_y_pos = $3,
  certificate_owner_name_x_pos = $4,
  certificate_owner_name_font_size = $5,
  certificate_owner_name_text_color = $6,
  certificate_owner_name_text_anchor = $7,
  certificate_validate_url_y_pos = $8,
  certificate_validate_url_x_pos = $9,
  certificate_validate_url_font_size = $10,
  certificate_validate_url_text_color = $11,
  certificate_validate_url_text_anchor = $12,
  certificate_date_y_pos = $13,
  certificate_date_x_pos = $14,
  certificate_date_font_size = $15,
  certificate_date_text_color = $16,
  certificate_date_text_anchor = $17,
  certificate_locale = $18,
  paper_size = $19,
  background_svg_path = $20,
  background_svg_file_upload_id = $21,
  overlay_svg_path = $22,
  overlay_svg_file_upload_id = $23
WHERE id = $24
"#,
        conf.course_module_id,
        conf.course_instance_id,
        conf.certificate_owner_name_y_pos,
        conf.certificate_owner_name_x_pos,
        conf.certificate_owner_name_font_size,
        conf.certificate_owner_name_text_color,
        conf.certificate_owner_name_text_anchor as CertificateTextAnchor,
        conf.certificate_validate_url_y_pos,
        conf.certificate_validate_url_x_pos,
        conf.certificate_validate_url_font_size,
        conf.certificate_validate_url_text_color,
        conf.certificate_validate_url_text_anchor as CertificateTextAnchor,
        conf.certificate_date_y_pos,
        conf.certificate_date_x_pos,
        conf.certificate_date_font_size,
        conf.certificate_date_text_color,
        conf.certificate_date_text_anchor as CertificateTextAnchor,
        conf.certificate_locale,
        conf.paper_size as PaperSize,
        conf.background_svg_path,
        conf.background_svg_file_upload_id,
        conf.overlay_svg_path,
        conf.overlay_svg_file_upload_id,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_module_certificate_configurations
SET deleted_at = now()
WHERE id = $1
",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
