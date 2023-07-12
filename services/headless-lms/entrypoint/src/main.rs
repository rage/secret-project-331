use std::future::Future;

use futures_util::FutureExt;
use headless_lms_server::programs;

/// The entrypoint to all the binaries provided by the project.
/// Expects program name as the first argument.
fn main() -> anyhow::Result<()> {
    let program_name = std::env::args()
        .nth(1)
        .expect("No program name provided as the first argument.");
    let future = match program_name.as_str() {
        "doc-file-generator" => programs::doc_file_generator::main().boxed_local(),
        "email-deliver" => programs::email_deliver::main().boxed_local(),
        "ended-exams-processor" => programs::ended_exams_processor::main().boxed_local(),
        "open-university-registration-link-fetcher" => {
            programs::open_university_registration_link_fetcher::main().boxed_local()
        }
        "regrader" => programs::regrader::main().boxed_local(),
        "seed" => programs::seed::main().boxed_local(),
        "service-info-fetcher" => programs::service_info_fetcher::main().boxed_local(),
        "peer-review-updater" => programs::peer_review_updater::main().boxed_local(),
        "start-server" => {
            // we'll run the server on the actix runtime without boxing it
            actix_run(programs::start_server::main())?;
            return Ok(());
        }
        "sorter" => {
            // not async so no need to involve a runtime
            programs::sorter::sort()?;
            return Ok(());
        }
        "sync-tmc-users" => programs::sync_tmc_users::main().boxed_local(),
        "calculate-page-visit-stats" => programs::calculate_page_visit_stats::main().boxed_local(),
        _ => panic!("Unknown program name: {}", program_name),
    };
    tokio_run(future)?;

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
