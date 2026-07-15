use headless_lms_utils::file_store::{FileStore, local_file_store::LocalFileStore};
use std::path::Path;

const REPOSITORY_EXERCISE_1: &[u8] = include_bytes!("./data/repository-exercise-1.tar.zst");
const REPOSITORY_EXERCISE_2: &[u8] = include_bytes!("./data/repository-exercise-2.tar.zst");
const CERTIFICATE_BACKGROUND: &[u8] = include_bytes!("./data/certificate-background.svg");
const AUTHOR_IMAGE: &[u8] = include_bytes!("./data/lilo-and-stitch.jpg");

/// Certificate fonts, as `(file_path, bytes)`. Paths must match `seed_certificate_fonts`.
const CERTIFICATE_FONTS: &[(&str, &[u8])] = &[
    (
        "fonts/inter-variable.ttf",
        include_bytes!("./data/InterVariable.ttf"),
    ),
    (
        "fonts/noto-sans-cjk-sc.otf",
        include_bytes!("./data/NotoSansCJKsc-Regular.otf"),
    ),
    (
        "fonts/noto-sans-arabic.ttf",
        include_bytes!("./data/NotoSansArabic.ttf"),
    ),
    (
        "fonts/noto-sans-hebrew.ttf",
        include_bytes!("./data/NotoSansHebrew.ttf"),
    ),
    (
        "fonts/noto-sans-thai.ttf",
        include_bytes!("./data/NotoSansThai.ttf"),
    ),
    (
        "fonts/noto-sans-devanagari.ttf",
        include_bytes!("./data/NotoSansDevanagari.ttf"),
    ),
    (
        "fonts/noto-sans-bengali.ttf",
        include_bytes!("./data/NotoSansBengali.ttf"),
    ),
    (
        "fonts/noto-sans-tamil.ttf",
        include_bytes!("./data/NotoSansTamil.ttf"),
    ),
    (
        "fonts/noto-sans-telugu.ttf",
        include_bytes!("./data/NotoSansTelugu.ttf"),
    ),
    (
        "fonts/noto-sans-kannada.ttf",
        include_bytes!("./data/NotoSansKannada.ttf"),
    ),
    (
        "fonts/noto-sans-malayalam.ttf",
        include_bytes!("./data/NotoSansMalayalam.ttf"),
    ),
    (
        "fonts/noto-sans-gujarati.ttf",
        include_bytes!("./data/NotoSansGujarati.ttf"),
    ),
    (
        "fonts/noto-sans-gurmukhi.ttf",
        include_bytes!("./data/NotoSansGurmukhi.ttf"),
    ),
    (
        "fonts/noto-sans-oriya.ttf",
        include_bytes!("./data/NotoSansOriya.ttf"),
    ),
    (
        "fonts/noto-sans-sinhala.ttf",
        include_bytes!("./data/NotoSansSinhala.ttf"),
    ),
    (
        "fonts/noto-sans-armenian.ttf",
        include_bytes!("./data/NotoSansArmenian.ttf"),
    ),
    (
        "fonts/noto-sans-georgian.ttf",
        include_bytes!("./data/NotoSansGeorgian.ttf"),
    ),
    (
        "fonts/noto-sans-ethiopic.ttf",
        include_bytes!("./data/NotoSansEthiopic.ttf"),
    ),
    (
        "fonts/noto-sans-khmer.ttf",
        include_bytes!("./data/NotoSansKhmer.ttf"),
    ),
    (
        "fonts/noto-sans-lao.ttf",
        include_bytes!("./data/NotoSansLao.ttf"),
    ),
    (
        "fonts/noto-sans-myanmar.ttf",
        include_bytes!("./data/NotoSansMyanmar.ttf"),
    ),
];

#[derive(Clone)]
pub struct SeedFileStorageResult {}

pub async fn seed_file_storage() -> anyhow::Result<SeedFileStorageResult> {
    info!("seeding file storage");

    let file_storage = LocalFileStore::new(
        "uploads".into(),
        "http://project-331.local/api/v0/files/uploads/".into(),
    )
    .expect("Failed to initialize file store");

    file_storage
        .upload(
            Path::new("playground-views/repository-exercise-1.tar.zst"),
            REPOSITORY_EXERCISE_1.to_vec(),
            "application/octet-stream",
        )
        .await?;
    file_storage
        .upload(
            Path::new("playground-views/repository-exercise-2.tar.zst"),
            REPOSITORY_EXERCISE_2.to_vec(),
            "application/octet-stream",
        )
        .await?;
    for &(path, bytes) in CERTIFICATE_FONTS {
        file_storage
            .upload(Path::new(path), bytes.to_vec(), "application/octet-stream")
            .await?;
    }
    file_storage
        .upload(
            Path::new("svgs/certificate-background.svg"),
            CERTIFICATE_BACKGROUND.to_vec(),
            "application/octet-stream",
        )
        .await?;
    file_storage
        .upload(
            Path::new("jpgs/lilo-and-stitch.jpg"),
            AUTHOR_IMAGE.to_vec(),
            "application/octet-stream",
        )
        .await?;
    Ok(SeedFileStorageResult {})
}
