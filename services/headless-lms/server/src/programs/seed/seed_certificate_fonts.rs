use crate::prelude::*;
use models::certificate_fonts::NewCertificateFont;

/// Fonts loaded for certificate rendering, as `(display_name, file_path)`.
///
/// Inter Variable is the default (see `certificates::TextToRender`) and covers Latin, Cyrillic and
/// Greek. The Noto Sans fonts extend coverage to scripts Inter lacks and are reached via glyph
/// fallback. `file_path` must match the paths uploaded in `seed_file_storage`.
const CERTIFICATE_FONTS: &[(&str, &str)] = &[
    ("Inter Variable", "fonts/inter-variable.ttf"),
    ("Noto Sans CJK SC", "fonts/noto-sans-cjk-sc.otf"),
    ("Noto Sans Arabic", "fonts/noto-sans-arabic.ttf"),
    ("Noto Sans Hebrew", "fonts/noto-sans-hebrew.ttf"),
    ("Noto Sans Thai", "fonts/noto-sans-thai.ttf"),
    ("Noto Sans Devanagari", "fonts/noto-sans-devanagari.ttf"),
    ("Noto Sans Bengali", "fonts/noto-sans-bengali.ttf"),
    ("Noto Sans Tamil", "fonts/noto-sans-tamil.ttf"),
    ("Noto Sans Telugu", "fonts/noto-sans-telugu.ttf"),
    ("Noto Sans Kannada", "fonts/noto-sans-kannada.ttf"),
    ("Noto Sans Malayalam", "fonts/noto-sans-malayalam.ttf"),
    ("Noto Sans Gujarati", "fonts/noto-sans-gujarati.ttf"),
    ("Noto Sans Gurmukhi", "fonts/noto-sans-gurmukhi.ttf"),
    ("Noto Sans Oriya", "fonts/noto-sans-oriya.ttf"),
    ("Noto Sans Sinhala", "fonts/noto-sans-sinhala.ttf"),
    ("Noto Sans Armenian", "fonts/noto-sans-armenian.ttf"),
    ("Noto Sans Georgian", "fonts/noto-sans-georgian.ttf"),
    ("Noto Sans Ethiopic", "fonts/noto-sans-ethiopic.ttf"),
    ("Noto Sans Khmer", "fonts/noto-sans-khmer.ttf"),
    ("Noto Sans Lao", "fonts/noto-sans-lao.ttf"),
    ("Noto Sans Myanmar", "fonts/noto-sans-myanmar.ttf"),
];

pub async fn seed_certificate_fonts(db_pool: PgPool) -> anyhow::Result<()> {
    let mut conn = db_pool.acquire().await?;

    for &(display_name, file_path) in CERTIFICATE_FONTS {
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
