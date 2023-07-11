use std::future::Future;

use headless_lms_server::programs;

/// The entrypoint to all the binaries provided by the project.
/// Expects program name as the first argument.
fn main() -> anyhow::Result<()> {
    let program_name = std::env::args()
        .nth(1)
        .expect("No program name provided as the first argument.");
    match program_name.as_str() {
        "doc-file-generator" => tokio_run(programs::doc_file_generator::main())?,
        "email-deliver" => tokio_run(programs::email_deliver::main())?,
        "ended-exams-processor" => tokio_run(programs::ended_exams_processor::main())?,
        "open-university-registration-link-fetcher" => {
            tokio_run(programs::open_university_registration_link_fetcher::main())?
        }
        "regrader" => tokio_run(programs::regrader::main())?,
        "seed" => tokio_run(programs::seed::main())?,
        "service-info-fetcher" => tokio_run(programs::service_info_fetcher::main())?,
        "peer-review-updater" => tokio_run(programs::peer_review_updater::main())?,
        "start-server" => actix_run(programs::start_server::main())?,
        "sorter" => programs::sorter::sort()?,
        "sync-tmc-users" => tokio_run(programs::sync_tmc_users::main())?,
        "calculate-page-visit-stats" => tokio_run(programs::calculate_page_visit_stats::main())?,
        _ => panic!("Unknown program name: {}", program_name),
    };

    Ok(())
}

fn actix_run<F>(f: F) -> anyhow::Result<()>
where
    F: Future<Output = anyhow::Result<()>>,
{
    let rt = actix_web::rt::Runtime::new()?;
    rt.block_on(f)?;
    Ok(())
}

// tokio's default runtime can use multiple threads, so it's less prone to stack overflows when spawning lots of tasks
// making it better suited for non-actix-web tasks
fn tokio_run<F>(f: F) -> anyhow::Result<()>
where
    F: Future<Output = anyhow::Result<()>>,
{
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(f)?;
    Ok(())
}
