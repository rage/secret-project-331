use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CertificateFont {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub file_path: String,
    pub file_upload_id: Uuid,
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewCertificateFont {
    pub file_path: String,
    pub file_upload_id: Uuid,
    pub display_name: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    certificate_font: &NewCertificateFont,
) -> ModelResult<CertificateFont> {
    let res = sqlx::query_as!(
        CertificateFont,
        "
INSERT INTO certificate_fonts (
    file_path,
    file_upload_id,
    display_name
  )
VALUES ($1, $2, $3)
RETURNING *
",
        certificate_font.file_path,
        certificate_font.file_upload_id,
        certificate_font.display_name
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<CertificateFont>> {
    let res = sqlx::query_as!(
        CertificateFont,
        "
SELECT *
FROM certificate_fonts
WHERE deleted_at IS NULL
"
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
