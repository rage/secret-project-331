//! Single source of truth for the certificate fonts seeded into local/test/dev environments.

/// Certificate fonts as `(display_name, file_path, bytes)`. `seed_certificate_fonts` registers
/// the DB rows and `seed_file_storage` uploads the bytes, both iterating this list.
///
/// Inter Variable is the default (see `certificates::TextToRender`) and covers Latin, Cyrillic and
/// Greek. The Noto Sans fonts extend coverage to scripts Inter lacks; the renderer resolves each
/// text to the single loaded font that covers it (see `certificates::resolve_font_family`) rather
/// than relying on usvg's per-glyph fallback.
pub const CERTIFICATE_FONTS: &[(&str, &str, &[u8])] = &[
    (
        "Inter Variable",
        "fonts/inter-variable.ttf",
        include_bytes!("./data/InterVariable.ttf"),
    ),
    (
        "Noto Sans CJK SC",
        "fonts/noto-sans-cjk-sc.otf",
        include_bytes!("./data/NotoSansCJKsc-Regular.otf"),
    ),
    (
        "Noto Sans Arabic",
        "fonts/noto-sans-arabic.ttf",
        include_bytes!("./data/NotoSansArabic.ttf"),
    ),
    (
        "Noto Sans Hebrew",
        "fonts/noto-sans-hebrew.ttf",
        include_bytes!("./data/NotoSansHebrew.ttf"),
    ),
    (
        "Noto Sans Thai",
        "fonts/noto-sans-thai.ttf",
        include_bytes!("./data/NotoSansThai.ttf"),
    ),
    (
        "Noto Sans Devanagari",
        "fonts/noto-sans-devanagari.ttf",
        include_bytes!("./data/NotoSansDevanagari.ttf"),
    ),
    (
        "Noto Sans Bengali",
        "fonts/noto-sans-bengali.ttf",
        include_bytes!("./data/NotoSansBengali.ttf"),
    ),
    (
        "Noto Sans Tamil",
        "fonts/noto-sans-tamil.ttf",
        include_bytes!("./data/NotoSansTamil.ttf"),
    ),
    (
        "Noto Sans Telugu",
        "fonts/noto-sans-telugu.ttf",
        include_bytes!("./data/NotoSansTelugu.ttf"),
    ),
    (
        "Noto Sans Kannada",
        "fonts/noto-sans-kannada.ttf",
        include_bytes!("./data/NotoSansKannada.ttf"),
    ),
    (
        "Noto Sans Malayalam",
        "fonts/noto-sans-malayalam.ttf",
        include_bytes!("./data/NotoSansMalayalam.ttf"),
    ),
    (
        "Noto Sans Gujarati",
        "fonts/noto-sans-gujarati.ttf",
        include_bytes!("./data/NotoSansGujarati.ttf"),
    ),
    (
        "Noto Sans Gurmukhi",
        "fonts/noto-sans-gurmukhi.ttf",
        include_bytes!("./data/NotoSansGurmukhi.ttf"),
    ),
    (
        "Noto Sans Oriya",
        "fonts/noto-sans-oriya.ttf",
        include_bytes!("./data/NotoSansOriya.ttf"),
    ),
    (
        "Noto Sans Sinhala",
        "fonts/noto-sans-sinhala.ttf",
        include_bytes!("./data/NotoSansSinhala.ttf"),
    ),
    (
        "Noto Sans Armenian",
        "fonts/noto-sans-armenian.ttf",
        include_bytes!("./data/NotoSansArmenian.ttf"),
    ),
    (
        "Noto Sans Georgian",
        "fonts/noto-sans-georgian.ttf",
        include_bytes!("./data/NotoSansGeorgian.ttf"),
    ),
    (
        "Noto Sans Ethiopic",
        "fonts/noto-sans-ethiopic.ttf",
        include_bytes!("./data/NotoSansEthiopic.ttf"),
    ),
    (
        "Noto Sans Khmer",
        "fonts/noto-sans-khmer.ttf",
        include_bytes!("./data/NotoSansKhmer.ttf"),
    ),
    (
        "Noto Sans Lao",
        "fonts/noto-sans-lao.ttf",
        include_bytes!("./data/NotoSansLao.ttf"),
    ),
    (
        "Noto Sans Myanmar",
        "fonts/noto-sans-myanmar.ttf",
        include_bytes!("./data/NotoSansMyanmar.ttf"),
    ),
];

// Build fails on unhydrated git-lfs pointers, which include_bytes! would embed silently.
const _: () = {
    let mut i = 0;
    while i < CERTIFICATE_FONTS.len() {
        assert!(
            matches!(
                CERTIFICATE_FONTS[i].2,
                [0x00, 0x01, 0x00, 0x00, ..] | [b'O', b'T', b'T', b'O', ..]
            ),
            "certificate font is not a valid font file (likely an unhydrated git-lfs pointer); run: git lfs pull --include=\"services/headless-lms/server/src/programs/seed/data\""
        );
        i += 1;
    }
};

#[cfg(test)]
mod tests {
    use super::CERTIFICATE_FONTS;

    /// Every font file in the seed data dir must be in CERTIFICATE_FONTS: the certificates
    /// crate's coverage tests load fonts by globbing that dir, so a stray unseeded font would
    /// pass those tests without ever reaching seeded environments.
    #[test]
    fn every_font_file_in_data_dir_is_seeded() {
        let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/src/programs/seed/data");
        let font_file_count = std::fs::read_dir(dir)
            .expect("seed data dir must exist")
            .filter(|entry| {
                let path = entry.as_ref().expect("readable seed dir entry").path();
                matches!(
                    path.extension().and_then(|e| e.to_str()),
                    Some("ttf" | "otf")
                )
            })
            .count();
        assert_eq!(
            font_file_count,
            CERTIFICATE_FONTS.len(),
            "font files in src/programs/seed/data and CERTIFICATE_FONTS entries must match 1:1"
        );
    }
}
