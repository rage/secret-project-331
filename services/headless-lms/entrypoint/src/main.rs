use anyhow::Result;
use headless_lms_server::programs;
use std::future::Future;

struct Program {
    name: &'static str,
    execute: Box<dyn Fn() -> Result<()> + Sync>,
}

fn main() -> Result<()> {
    let programs_list = vec![
        Program {
            name: "doc-file-generator",
            execute: Box::new(|| tokio_run(programs::doc_file_generator::main())),
        },
        Program {
            name: "email-deliver",
            execute: Box::new(|| tokio_run(programs::email_deliver::main())),
        },
        Program {
            name: "ended-exams-processor",
            execute: Box::new(|| tokio_run(programs::ended_exams_processor::main())),
        },
        Program {
            name: "open-university-registration-link-fetcher",
            execute: Box::new(|| {
                tokio_run(programs::open_university_registration_link_fetcher::main())
            }),
        },
        Program {
            name: "regrader",
            execute: Box::new(|| tokio_run(programs::regrader::main())),
        },
        Program {
            name: "seed",
            execute: Box::new(|| tokio_run(programs::seed::main())),
        },
        Program {
            name: "service-info-fetcher",
            execute: Box::new(|| tokio_run(programs::service_info_fetcher::main())),
        },
        Program {
            name: "peer-review-updater",
            execute: Box::new(|| tokio_run(programs::peer_review_updater::main())),
        },
        Program {
            name: "start-server",
            // we'll run the server on the actix runtime without boxing it
            execute: Box::new(|| actix_run(programs::start_server::main())),
        },
        Program {
            name: "sorter",
            execute: Box::new(|| {
                // not async so no need to involve a runtime
                programs::sorter::sort()?;
                Ok(())
            }),
        },
        Program {
            name: "sync-tmc-users",
            execute: Box::new(|| tokio_run(programs::sync_tmc_users::main())),
        },
        Program {
            name: "calculate-page-visit-stats",
            execute: Box::new(|| tokio_run(programs::calculate_page_visit_stats::main())),
        },
    ];

    let program_name = std::env::args().nth(1).unwrap_or_else(|| {
        eprintln!("Error: No program name provided as the first argument.");
        print_valid_programs(&programs_list);
        std::process::exit(1);
    });

    if let Some(program) = programs_list
        .iter()
        .find(|p| p.name == program_name.as_str())
    {
        (program.execute)()?;
    } else {
        eprintln!("Error: Unknown program name: '{}'.", program_name);
        print_valid_programs(&programs_list);
        std::process::exit(1);
    }

    Ok(())
}

/// Prints all valid program names to stderr.
fn print_valid_programs(programs: &[Program]) {
    eprintln!("Valid program names are:");
    for program in programs {
        eprintln!("  - {}", program.name);
    }
}

// tokio's default runtime can use multiple threads, so it's less prone to stack overflows when spawning lots of tasks
// making it better suited for non-actix-web tasks
fn tokio_run<F>(f: F) -> Result<()>
where
    F: Future<Output = Result<()>> + 'static,
{
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?;
    rt.block_on(f)
}

fn actix_run<F>(f: F) -> Result<()>
where
    F: Future<Output = Result<()>> + 'static,
{
    let rt = actix_web::rt::Runtime::new()?;
    rt.block_on(f)
}
