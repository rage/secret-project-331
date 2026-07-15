use crate::prelude::*;
use models::certificate_fonts::NewCertificateFont;

pub async fn seed_certificate_fonts(db_pool: PgPool) -> anyhow::Result<()> {
    let mut conn = db_pool.acquire().await?;

    // The default certificate font (see certificates::TextToRender). It has full glyph coverage
    // for the scripts we render, which the certificate rendering relies on.
    let inter_file_upload_id = models::file_uploads::insert(
        &mut conn,
        "Inter Variable",
        "fonts/inter-variable.ttf",
        "application/octet-stream",
        None,
    )
    .await?;
    let inter = NewCertificateFont {
        file_path: "fonts/inter-variable.ttf".to_string(),
        file_upload_id: inter_file_upload_id,
        display_name: "Inter Variable".to_string(),
    };
    models::certificate_fonts::insert(&mut conn, &inter).await?;

    Ok(())
}
