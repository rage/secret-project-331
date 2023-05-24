use headless_lms_utils::file_store::{local_file_store::LocalFileStore, FileStore};
use std::path::Path;

const REPOSITORY_EXERCISE_1: &[u8] = include_bytes!("./data/repository-exercise-1.tar.zst");
const REPOSITORY_EXERCISE_2: &[u8] = include_bytes!("./data/repository-exercise-2.tar.zst");
const FONT_LATO_BLACK: &[u8] = include_bytes!("./data/Lato-Black.ttf");
const CERTIFICATE_BACKGROUND: &[u8] = include_bytes!("./data/certificate-background.svg");

pub async fn seed_file_storage() -> anyhow::Result<()> {
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
            Path::new("fonts/lato-black.ttf"),
            FONT_LATO_BLACK.to_vec(),
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
    Ok(())
}
