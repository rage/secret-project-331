use std::fs;
use std::path::PathBuf;

use headless_lms_server::openapi::MainFrontendApiDoc;
use utoipa::OpenApi;

fn main() {
    let spec = MainFrontendApiDoc::openapi();
    let json = serde_json::to_string_pretty(&spec).expect("Failed to serialize OpenAPI spec");

    let output_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("openapi");
    let output_path = output_dir.join("main-frontend.openapi.json");

    fs::create_dir_all(&output_dir).expect("Failed to create OpenAPI output directory");
    fs::write(&output_path, json).expect("Failed to write OpenAPI spec");

    println!("Wrote {}", output_path.display());
}
