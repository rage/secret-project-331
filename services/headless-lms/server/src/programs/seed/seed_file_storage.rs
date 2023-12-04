use headless_lms_utils::file_store::{local_file_store::LocalFileStore, FileStore};
use std::path::Path;

const REPOSITORY_EXERCISE_1: &[u8] = include_bytes!("./data/repository-exercise-1.tar.zst");
const REPOSITORY_EXERCISE_2: &[u8] = include_bytes!("./data/repository-exercise-2.tar.zst");
const FONT_LATO_REGULAR: &[u8] = include_bytes!("./data/Lato-Regular.ttf");
const CERTIFICATE_BACKGROUND: &[u8] = include_bytes!("./data/certificate-background.svg");
const AUTHOR_IMAGE: &[u8] = include_bytes!("./data/lilo-and-stitch.jpg");

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
    file_storage
        .upload(
            Path::new("fonts/lato-regular.ttf"),
            FONT_LATO_REGULAR.to_vec(),
            "application/octet-stream",
        )
        .await?;
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
