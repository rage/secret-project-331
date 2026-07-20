use super::certificate_fonts_data::CERTIFICATE_FONTS;
use crate::prelude::*;
use models::certificate_fonts::NewCertificateFont;

pub async fn seed_certificate_fonts(db_pool: PgPool) -> anyhow::Result<()> {
    let mut conn = db_pool.acquire().await?;

    for &(display_name, file_path, _) in CERTIFICATE_FONTS {
        let file_upload_id = models::file_uploads::insert(
            &mut conn,
            display_name,
            file_path,
            "application/octet-stream",
            None,
        )
        .await?;
        let font = NewCertificateFont {
            file_path: file_path.to_string(),
            file_upload_id,
            display_name: display_name.to_string(),
        };
        models::certificate_fonts::insert(&mut conn, &font).await?;
    }

    Ok(())
}
