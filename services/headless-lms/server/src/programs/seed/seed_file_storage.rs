use super::certificate_fonts_data::CERTIFICATE_FONTS;
use headless_lms_utils::file_store::{FileStore, local_file_store::LocalFileStore};
use std::path::Path;

const REPOSITORY_EXERCISE_1: &[u8] = include_bytes!("./data/repository-exercise-1.tar.zst");
const REPOSITORY_EXERCISE_2: &[u8] = include_bytes!("./data/repository-exercise-2.tar.zst");
/// A Python exercise template shaped like the intro programming course's, also checked in unpacked
/// as `services/tmc/tests/fixtures/hello-name`.
const TMC_BROWSER_EXERCISE: &[u8] = include_bytes!("./data/tmc-browser-exercise.tar.zst");
const TMC_BROWSER_EXERCISE_PATH: &str = "tmc/browser-exercise.tar.zst";
/// Where the tmc service downloads [`TMC_BROWSER_EXERCISE`] from; pods resolve the host through the
/// ingress.
pub const TMC_BROWSER_EXERCISE_URL: &str =
    "http://project-331.local/api/v0/files/uploads/tmc/browser-exercise.tar.zst";
const CERTIFICATE_BACKGROUND: &[u8] = include_bytes!("./data/certificate-background.svg");
const AUTHOR_IMAGE: &[u8] = include_bytes!("./data/lilo-and-stitch.jpg");
/// Stands in for a chart data file a teacher would upload, for the seeded chart blocks.
const CHART_EXAMPLE_DATA: &[u8] = include_bytes!("./data/chart-example-data.json");

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
            Path::new(TMC_BROWSER_EXERCISE_PATH),
            TMC_BROWSER_EXERCISE.to_vec(),
            "application/octet-stream",
        )
        .await?;
    for &(_, path, bytes) in CERTIFICATE_FONTS {
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
    file_storage
        .upload(
            Path::new("jsons/chart-example-data.json"),
            CHART_EXAMPLE_DATA.to_vec(),
            "application/json",
        )
        .await?;
    Ok(SeedFileStorageResult {})
}
