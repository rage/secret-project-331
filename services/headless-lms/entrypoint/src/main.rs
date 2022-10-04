use headless_lms_server::programs;

/// The entrypoint to all the binaries provided by the project.
/// Expects program name as the first argument.
#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    let program_name = std::env::args()
        .nth(1)
        .expect("No program name provided as the first argument.");
    match program_name.as_str() {
        "doc-file-generator" => programs::doc_file_generator::main().await?,
        "email-deliver" => programs::email_deliver::main().await?,
        "open-university-registration-link-fetcher" => {
            programs::open_university_registration_link_fetcher::main().await?
        }
        "regrader" => programs::regrader::main().await?,
        "seed" => programs::seed::main().await?,
        "service-info-fetcher" => programs::service_info_fetcher::main().await?,
        "peer-review-updater" => programs::peer_review_updater::main().await?,
        "start-server" => programs::start_server::main().await?,
        "sorter" => programs::sorter::sort()?,
        _ => panic!("Unknown program name: {}", program_name),
    };

    Ok(())
}
