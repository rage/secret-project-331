use std::fs;
use std::path::PathBuf;

use headless_lms_server::openapi::{CmsApiDoc, CourseMaterialApiDoc, MainFrontendApiDoc};
use utoipa::OpenApi;

fn main() {
    let output_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("openapi");

    fs::create_dir_all(&output_dir).expect("Failed to create OpenAPI output directory");

    write_spec(
        &output_dir.join("main-frontend.openapi.json"),
        MainFrontendApiDoc::openapi(),
    );
    write_spec(&output_dir.join("cms.openapi.json"), CmsApiDoc::openapi());
    write_spec(
        &output_dir.join("course-material.openapi.json"),
        CourseMaterialApiDoc::openapi(),
    );
}

fn write_spec(path: &PathBuf, spec: utoipa::openapi::OpenApi) {
    let json = serde_json::to_string_pretty(&spec).expect("Failed to serialize OpenAPI spec");

    fs::write(path, json).expect("Failed to write OpenAPI spec");

    println!("Wrote {}", path.display());
}
