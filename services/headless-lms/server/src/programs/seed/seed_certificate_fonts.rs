use crate::prelude::*;
use models::certificate_fonts::NewCertificateFont;

pub async fn seed_certificate_fonts(db_pool: &PgPool) -> anyhow::Result<()> {
    let mut conn = db_pool.acquire().await?;

    let file_upload_id = models::file_uploads::insert(
        &mut conn,
        "Lato Black",
        "fonts/lato-black.ttf",
        "application/octet-stream",
        None,
    )
    .await?;
    let font = NewCertificateFont {
        file_path: "fonts/lato-black.ttf".to_string(),
        file_upload_id,
        display_name: "Lato Black".to_string(),
    };
    models::certificate_fonts::insert(&mut conn, &font).await?;

    Ok(())
}
