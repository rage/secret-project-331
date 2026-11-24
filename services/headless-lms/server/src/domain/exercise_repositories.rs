use anyhow::Context;
use base64::{Engine as _, engine::general_purpose::STANDARD_NO_PAD};
use futures::future::BoxFuture;
use git2::{
    CertificateCheckStatus, Cred, FetchOptions, RemoteCallbacks, RemoteRedirect,
    build::RepoBuilder, cert::Cert,
};
use headless_lms_base::{config::ApplicationConfiguration, jwt::JwtKey};
use headless_lms_models::{
    ModelResult, SpecFetcher,
    exercise_repositories::{
        self, ExerciseRepositorySyncJob, ExerciseRepositorySyncReport, FailedExerciseTaskRefresh,
        RenamedRepositoryExercise,
    },
    exercise_repository_ssh_host_keys,
    exercise_repository_ssh_host_keys::ExerciseRepositorySshHostKey,
    exercise_service_info::{self, ExerciseServiceInfo, ExerciseServiceInfoApi},
    exercise_services::{self, ExerciseService},
    exercise_task_spec_files::{self, SpecKind},
    pages::{DerivedSpec, parse_derived_spec},
    repository_exercises::{
        self, OutdatedExerciseTask, RepositoryExercise, RepositoryExerciseVersion,
    },
};
use headless_lms_utils::{
    file_store::{self, FileStore},
    periodic_worker::{PeriodicWorkerConfig, run_periodic_worker},
    prelude::{BackendError, UtilErrorType},
};
use itertools::Itertools;
use secrecy::{ExposeSecret, SecretString};
use sqlx::{Acquire, PgConnection, PgPool};
use std::{cell::Cell, collections::HashMap, io::Cursor, path::Path, sync::Arc, time::Duration};
use url::Url;
use uuid::Uuid;

use crate::domain::models_requests;
use discovery::FoundExercise;

mod discovery;
mod pinned_stream;

/// Accepts a clone URL only over https or ssh (`ssh://` or `git@host:path`) to a host that
/// currently resolves to public addresses, so a teacher gets a clear error when saving the URL.
/// This is an early check, not the enforcement: the clone's own connections go through
/// [`pinned_stream`], which refuses private addresses whatever DNS answers by then.
pub async fn ensure_clone_url_is_allowed(url: &str) -> anyhow::Result<()> {
    let (host, port) = clone_url_host_and_port(url)
        .ok_or_else(|| anyhow::anyhow!("Use an https:// or ssh:// URL, or git@host:path."))?;
    let addresses: Vec<_> = tokio::net::lookup_host((host.as_str(), port))
        .await
        .with_context(|| format!("Could not resolve {host}"))?
        .collect();
    pinned_stream::public_addresses(&host, addresses)?;
    Ok(())
}

/// SHA-256 host key fingerprints of git hosts whose keys are known in advance, as printed by
/// `ssh-keygen -lf` without the `SHA256:` prefix. These hosts never fall back to trust on first use.
const PINNED_SSH_HOST_KEYS: &[(&str, &str)] = &[
    ("github.com", "uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s"),
    ("github.com", "p2QAMXNIC1TJYWeIOttrVc98/R1BUFWu3/LiyKgUfQM"),
    ("github.com", "+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"),
    ("gitlab.com", "ROQFvPThGrW4RuWLoL9tq9I9zJ42fK4XywyRtbOz/EQ"),
    ("gitlab.com", "HbW3g8zUjNSksFbqTiUWPWg2Bq1x8xdGUrliXFzSnUw"),
    ("gitlab.com", "eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8"),
    (
        "bitbucket.org",
        "46OSHA1Rmj8E8ERTC6xkNcmGOw9oFxYr0WF6zWW8l1E",
    ),
    (
        "bitbucket.org",
        "FC73VB6C4OQLSCrjEayhMp9UMxS97caD/Yyi2bhW/J0",
    ),
    (
        "bitbucket.org",
        "ybgmFkzwOSotHTHLJgHO0QN8L0xErw6vd0VhFA9m3SM",
    ),
];

/// Why an ssh host key was accepted.
#[derive(Debug, Clone, PartialEq, Eq)]
enum AcceptedHostKey {
    /// Pinned, or the key remembered from the first clone.
    Known,
    /// The first key seen from this server; it must be remembered once the clone succeeds.
    FirstSeen(String),
}

/// Decides whether `seen`, the SHA-256 fingerprint of the host key a server presented, may be
/// trusted: a pinned host must present a pinned key, any other host the key remembered from its
/// first clone, or, if none is remembered yet, any key.
fn check_ssh_host_key(
    host: &str,
    port: u16,
    remembered: Option<&ExerciseRepositorySshHostKey>,
    seen: Option<&str>,
) -> Result<AcceptedHostKey, String> {
    let Some(seen) = seen else {
        return Err(format!("{host} sent no SHA-256 host key fingerprint"));
    };
    let mut pinned = PINNED_SSH_HOST_KEYS
        .iter()
        .filter(|(pinned_host, _)| pinned_host.eq_ignore_ascii_case(host))
        .peekable();
    if pinned.peek().is_some() {
        return if pinned.any(|&(_, key)| key == seen) {
            Ok(AcceptedHostKey::Known)
        } else {
            Err(format!(
                "The ssh host key of {host} (SHA256:{seen}) is not one of its published keys, so the connection may have been intercepted."
            ))
        };
    }
    match remembered {
        Some(remembered) if remembered.sha256_fingerprint == seen => Ok(AcceptedHostKey::Known),
        Some(remembered) => Err(format!(
            "The ssh host key of {host}:{port} has changed: it is now SHA256:{seen}, but SHA256:{} was seen on the first clone on {}. If the server's key was changed on purpose, ask an administrator to remove the remembered key for {host}:{port}; otherwise the connection may have been intercepted.",
            remembered.sha256_fingerprint,
            remembered.created_at.format("%Y-%m-%d")
        )),
        None => Ok(AcceptedHostKey::FirstSeen(seen.to_string())),
    }
}

/// Clones `branch`, or the default branch, of `url` into `target`, verifying the server the way
/// [`check_ssh_host_key`] describes and remembering a first-seen ssh host key once the clone
/// succeeds. TLS certificates are left to libgit2's own validation.
async fn clone_repository(
    conn: &mut PgConnection,
    url: &str,
    branch: Option<&str>,
    deploy_key: Option<(Option<&str>, &SecretString)>,
    target: &Path,
) -> anyhow::Result<()> {
    ensure_clone_url_is_allowed(url).await?;
    pinned_stream::register()?;
    let (host, port) = clone_url_host_and_port(url)
        .ok_or_else(|| anyhow::anyhow!("Use an https:// or ssh:// URL, or git@host:path."))?;
    let remembered = exercise_repository_ssh_host_keys::get(conn, &host, port).await?;
    let first_seen = Cell::new(None);
    // libgit2 replaces a rejecting callback's error with a generic one.
    let rejection = Cell::new(None);

    let mut remote_cbs = RemoteCallbacks::new();
    // libgit2 uses this one callback for both TLS certificates and ssh host keys.
    remote_cbs.certificate_check(|cert: &Cert<'_>, _| {
        let Some(host_key) = cert.as_hostkey() else {
            return Ok(CertificateCheckStatus::CertificatePassthrough);
        };
        let seen = host_key
            .hash_sha256()
            .map(|hash| STANDARD_NO_PAD.encode(hash));
        match check_ssh_host_key(&host, port, remembered.as_ref(), seen.as_deref()) {
            Ok(AcceptedHostKey::Known) => Ok(CertificateCheckStatus::CertificateOk),
            Ok(AcceptedHostKey::FirstSeen(key)) => {
                first_seen.set(Some(key));
                Ok(CertificateCheckStatus::CertificateOk)
            }
            Err(message) => {
                let error = git2::Error::from_str(&message);
                rejection.set(Some(message));
                Err(error)
            }
        }
    });
    if let Some((public_key, deploy_key)) = deploy_key {
        remote_cbs.credentials(move |_, username, credential_type| {
            if credential_type.is_ssh_memory() {
                Cred::ssh_key_from_memory(
                    username.unwrap_or("git"),
                    public_key,
                    // Exposed only here, where the key is handed to libgit2 in memory.
                    deploy_key.expose_secret(),
                    None,
                )
            } else {
                Err(git2::Error::from_str(
                    "The git server does not support the SSH_MEMORY credential type",
                ))
            }
        });
    }
    let mut fetch_opts = FetchOptions::new();
    // The clone must come from the URL the teacher saved, not from wherever that server redirects.
    fetch_opts.follow_redirects(RemoteRedirect::None);
    // A sync reads only the working tree.
    fetch_opts.depth(1);
    fetch_opts.remote_callbacks(remote_cbs);
    let mut builder = RepoBuilder::new();
    builder.fetch_options(fetch_opts);
    if let Some(branch) = branch {
        builder.branch(branch);
    }
    if let Err(error) = builder.clone(url, target) {
        return Err(rejection
            .take()
            .map_or_else(|| error.into(), |message| anyhow::anyhow!(message)));
    }

    if let Some(seen) = first_seen.take() {
        let remembered =
            exercise_repository_ssh_host_keys::remember(conn, &host, port, &seen).await?;
        if remembered.sha256_fingerprint != seen {
            anyhow::bail!(
                "Another clone from {host}:{port} saw a different ssh host key at the same time (SHA256:{} instead of SHA256:{seen}), so neither can be trusted. Ask an administrator to check the server's key.",
                remembered.sha256_fingerprint
            );
        }
    }
    Ok(())
}

fn clone_url_host_and_port(url: &str) -> Option<(String, u16)> {
    // libgit2 parses URLs with its own rules, so anything the two parsers may split differently
    // could make it connect to a host other than the one checked here.
    if url
        .chars()
        .any(|c| c == '\\' || c.is_ascii_control() || c.is_whitespace())
    {
        return None;
    }
    if let Some((_, rest)) = url.split_once("://") {
        let authority = rest.split('/').next().unwrap_or_default();
        if authority.contains(['?', '#']) || authority.matches('@').count() > 1 {
            return None;
        }
    }
    if url.starts_with("https://") || url.starts_with("ssh://") {
        let parsed = url::Url::parse(url).ok()?;
        let host = parsed.host_str()?.trim_matches(['[', ']']);
        let port = parsed
            .port()
            .unwrap_or(if parsed.scheme() == "https" { 443 } else { 22 });
        return Some((canonical_host(host)?, port));
    }
    // scp-like syntax: user@host:path, which git treats as ssh.
    let (user_and_host, path) = url.split_once(':')?;
    let (_, host) = user_and_host.split_once('@')?;
    if host.is_empty() || path.is_empty() || host.contains('/') || path.starts_with("//") {
        return None;
    }
    Some((canonical_host(host)?, 22))
}

/// One spelling per host, so that pins and remembered keys cannot be sidestepped by writing the
/// same host as `GitHub.com` or with the root's trailing dot.
fn canonical_host(host: &str) -> Option<String> {
    let host = host.strip_suffix('.').unwrap_or(host);
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
}

/// Accepts a branch name git would accept for `refs/heads/<branch>`.
pub fn ensure_branch_name_is_valid(branch: &str) -> anyhow::Result<()> {
    if branch.starts_with('-') || !git2::Reference::is_valid_name(&format!("refs/heads/{branch}")) {
        anyhow::bail!("{branch} is not a valid git branch name.");
    }
    Ok(())
}

/// Syncs started for a repository before it is marked failed.
pub const MAX_SYNC_ATTEMPTS: i32 = 3;
/// A sync running longer than this is assumed dead, for example with the server that ran it.
const SYNC_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const SYNC_WORKER_TICK: Duration = Duration::from_secs(10);

/// Runs queued repository syncs until the process exits. Every server process runs one; they share
/// the queue in the database.
pub async fn run_sync_worker(
    pool: PgPool,
    file_store: Arc<dyn FileStore + Send + Sync>,
    app_conf: ApplicationConfiguration,
    jwt_key: Arc<JwtKey>,
) -> anyhow::Result<()> {
    run_periodic_worker(
        PeriodicWorkerConfig {
            tick_interval: SYNC_WORKER_TICK,
            still_running: None,
            delay_missed_ticks: true,
        },
        async || {
            // An error is logged and retried on the next tick: the worker must outlive it.
            let result = async {
                let mut conn = pool.acquire().await?;
                sync_queued(
                    &mut conn,
                    file_store.as_ref(),
                    &app_conf,
                    &models_requests::make_spec_fetcher(
                        app_conf.base_url.clone(),
                        Uuid::new_v4(),
                        Arc::clone(&jwt_key),
                    ),
                    models_requests::fetch_service_info,
                )
                .await
            }
            .await;
            if let Err(err) = result {
                error!("Exercise repository sync worker failed: {err:#}");
            }
            Ok(())
        },
    )
    .await
}

/// Runs every queued sync once.
pub async fn sync_queued(
    conn: &mut PgConnection,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> anyhow::Result<()> {
    let timeout = chrono::Duration::from_std(SYNC_TIMEOUT)?;
    let mut started = vec![];
    while let Some(job) =
        exercise_repositories::start_next_sync(conn, timeout, MAX_SYNC_ATTEMPTS, &started).await?
    {
        started.push(job.id);
        info!("Syncing exercise repository {}", job.id);
        match sync(
            conn,
            &job,
            file_store,
            app_conf,
            &spec_fetcher,
            &fetch_service_info,
        )
        .await
        {
            Ok(report) => exercise_repositories::finish_sync(conn, &job, &report).await?,
            Err(err) => {
                warn!("Syncing exercise repository {} failed: {err:#}", job.id);
                exercise_repositories::fail_sync(
                    conn,
                    &job,
                    &format!("{err:#}"),
                    MAX_SYNC_ATTEMPTS,
                )
                .await?;
            }
        }
    }
    Ok(())
}

/// Clones the repository, updates its exercises from the clone, refreshes the exercise tasks that
/// use them and removes the archives nothing needs any more.
async fn sync(
    conn: &mut PgConnection,
    job: &ExerciseRepositorySyncJob,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> anyhow::Result<ExerciseRepositorySyncReport> {
    let checkout = tempfile::tempdir()?;
    clone_repository(
        conn,
        &job.url,
        job.branch.as_deref(),
        job.deploy_key
            .as_ref()
            .map(|deploy_key| (job.public_key.as_deref(), deploy_key)),
        checkout.path(),
    )
    .await?;
    let mut report = sync_checkout(conn, job.id, checkout.path(), file_store, app_conf).await?;
    refresh_exercise_tasks(conn, job.id, spec_fetcher, fetch_service_info, &mut report).await?;
    remove_unused_archives(conn, job.id, file_store).await;
    Ok(report)
}

/// Updates the repository's exercises to match `checkout`, keeping each exercise's id: one found
/// at the same part and name is the same exercise, and failing that one with the same checksum.
/// Each new version gets an archive at a new path; the replaced archives are retired, not
/// deleted, since copies of the course may still use them. On error, nothing is
/// changed and the new archives are removed.
async fn sync_checkout(
    conn: &mut PgConnection,
    repository_id: Uuid,
    checkout: &Path,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<ExerciseRepositorySyncReport> {
    let found = discovery::find_exercises(checkout).await?;
    let mut unmatched =
        repository_exercises::get_stored_for_repository(conn, repository_id).await?;
    let mut matched = vec![];
    let mut at_new_paths = vec![];
    // Paths first: an unchanged copy of an exercise must not take the original's id.
    for exercise in found {
        match unmatched
            .iter()
            .position(|s| s.part == exercise.part && s.name == exercise.name)
        {
            Some(index) => matched.push((unmatched.swap_remove(index), exercise)),
            None => at_new_paths.push(exercise),
        }
    }
    let mut added = vec![];
    for exercise in at_new_paths {
        match unmatched
            .iter()
            .position(|s| s.checksum == exercise.checksum.as_bytes())
        {
            Some(index) => matched.push((unmatched.swap_remove(index), exercise)),
            None => added.push(exercise),
        }
    }

    let mut uploaded = vec![];
    let result = async {
        let mut report = ExerciseRepositorySyncReport::default();
        let mut tx = conn.begin().await?;
        for exercise in &added {
            let id = Uuid::new_v4();
            let (archive_path, download_url) =
                upload_archive(repository_id, id, exercise, file_store, app_conf).await?;
            uploaded.push(archive_path.clone());
            repository_exercises::insert(
                &mut tx,
                id,
                repository_id,
                &version(exercise, &archive_path, &download_url),
            )
            .await?;
            report
                .added
                .push(display_name(&exercise.part, &exercise.name));
        }
        for (stored, exercise) in &matched {
            let renamed = stored.part != exercise.part || stored.name != exercise.name;
            if renamed {
                report.renamed.push(RenamedRepositoryExercise {
                    from: display_name(&stored.part, &stored.name),
                    to: display_name(&exercise.part, &exercise.name),
                });
            }
            if stored.checksum == exercise.checksum.as_bytes() {
                if renamed {
                    repository_exercises::update(
                        &mut tx,
                        stored.id,
                        &version(exercise, &stored.archive_path, &stored.download_url),
                    )
                    .await?;
                }
                continue;
            }
            let (archive_path, download_url) =
                upload_archive(repository_id, stored.id, exercise, file_store, app_conf).await?;
            uploaded.push(archive_path.clone());
            repository_exercises::update(
                &mut tx,
                stored.id,
                &version(exercise, &archive_path, &download_url),
            )
            .await?;
            exercise_repositories::retire_archive(&mut tx, repository_id, &stored.archive())
                .await?;
            report
                .updated
                .push(display_name(&exercise.part, &exercise.name));
        }
        let removed_ids: Vec<Uuid> = unmatched.iter().map(|s| s.id).collect();
        let in_use = repository_exercises::get_ids_in_use(&mut tx, &removed_ids).await?;
        for stored in &unmatched {
            let name = display_name(&stored.part, &stored.name);
            if in_use.contains(&stored.id) {
                report.missing_but_in_use.push(name);
            } else {
                repository_exercises::delete(&mut tx, stored.id).await?;
                exercise_repositories::retire_archive(&mut tx, repository_id, &stored.archive())
                    .await?;
                report.removed.push(name);
            }
        }
        tx.commit().await?;
        anyhow::Ok(report)
    }
    .await;
    if result.is_err() {
        for path in uploaded {
            if let Err(err) = file_store.delete(Path::new(&path)).await {
                error!("Failed to remove the new archive {path}: {err}");
            }
        }
    }
    result
}

fn display_name(part: &str, name: &str) -> String {
    if part.is_empty() {
        name.to_string()
    } else {
        format!("{part}/{name}")
    }
}

fn version<'a>(
    exercise: &'a FoundExercise,
    archive_path: &'a str,
    download_url: &'a str,
) -> RepositoryExerciseVersion<'a> {
    RepositoryExerciseVersion {
        part: &exercise.part,
        name: &exercise.name,
        checksum: exercise.checksum.as_bytes(),
        archive_path,
        download_url,
    }
}

/// Archives the exercise directory to a new path, returning the path and its download URL.
async fn upload_archive(
    repository_id: Uuid,
    repository_exercise_id: Uuid,
    exercise: &FoundExercise,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<(String, String)> {
    let mut tar = tar::Builder::new(Cursor::new(vec![]));
    // The repository is teacher-controlled; following its symlinks would archive server files.
    tar.follow_symlinks(false);
    tar.append_dir_all(".", &exercise.path)?;
    let mut tar = tar.into_inner()?;
    tar.set_position(0);
    let tar_zstd = zstd::encode_all(tar, 0)?;

    let path = file_store::repository_exercise_archive_path(
        repository_id,
        repository_exercise_id,
        Uuid::new_v4(),
    );
    file_store
        .upload(&path, tar_zstd, "application/zstd")
        .await?;
    let download_url = file_store.get_download_url(&path, app_conf);
    let path = path
        .to_str()
        .context("Archive paths are built from uuids")?
        .to_string();
    Ok((path, download_url))
}

/// Re-derives the public and model solution specs of every live exercise task whose specs come
/// from an older version of one of the repository's exercises. A task whose specs cannot be
/// derived keeps its previous ones and is retried on the next sync.
async fn refresh_exercise_tasks(
    conn: &mut PgConnection,
    repository_id: Uuid,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
    report: &mut ExerciseRepositorySyncReport,
) -> anyhow::Result<()> {
    let outdated = repository_exercises::get_outdated_exercise_tasks(conn, repository_id).await?;
    if outdated.is_empty() {
        return Ok(());
    }
    let current: HashMap<Uuid, RepositoryExercise> =
        repository_exercises::get_for_repository(conn, repository_id)
            .await?
            .into_iter()
            .map(|exercise| (exercise.id, exercise))
            .collect();
    let exercise_types: Vec<String> = outdated
        .iter()
        .map(|task| task.exercise_type.clone())
        .unique()
        .collect();
    let services = exercise_service_info::get_selected_exercise_services_by_type(
        conn,
        &exercise_types,
        fetch_service_info,
    )
    .await?;
    for task in outdated {
        let Some(exercise) = current.get(&task.repository_exercise_id) else {
            continue;
        };
        match refresh_exercise_task(conn, &task, exercise, &services, &spec_fetcher).await {
            Ok(true) => report.refreshed_exercise_task_count += 1,
            // The teacher saved the task meanwhile, which derived its specs anew.
            Ok(false) => {}
            Err(err) => report
                .failed_exercise_tasks
                .push(FailedExerciseTaskRefresh {
                    exercise_task_id: task.id,
                    repository_exercise: display_name(&exercise.part, &exercise.name),
                    error: err.to_string(),
                }),
        }
    }
    Ok(())
}

async fn derive_spec(
    spec_fetcher: &impl SpecFetcher,
    url: Url,
    task: &OutdatedExerciseTask,
    exercise: &RepositoryExercise,
    declares_spec_files: bool,
) -> anyhow::Result<DerivedSpec> {
    let response = spec_fetcher(
        url,
        &task.exercise_type,
        task.private_spec.as_ref(),
        Some(exercise),
    )
    .await?;
    parse_derived_spec(response, declares_spec_files)
        .context("The exercise service declares spec files but did not answer with them")
}

async fn refresh_exercise_task(
    conn: &mut PgConnection,
    task: &OutdatedExerciseTask,
    exercise: &RepositoryExercise,
    services: &HashMap<String, (ExerciseService, ExerciseServiceInfo)>,
    spec_fetcher: &impl SpecFetcher,
) -> anyhow::Result<bool> {
    let (service, info) = services
        .get(&task.exercise_type)
        .with_context(|| format!("No exercise service for {}", task.exercise_type))?;
    let (public, model_solution) = futures::try_join!(
        derive_spec(
            spec_fetcher,
            exercise_services::get_internal_public_spec_url(service, info)?,
            task,
            exercise,
            info.declares_spec_files,
        ),
        derive_spec(
            spec_fetcher,
            exercise_services::get_model_solution_url(service, info)?,
            task,
            exercise,
            info.declares_spec_files,
        ),
    )?;
    let mut tx = conn.begin().await?;
    let updated = repository_exercises::update_exercise_task_specs(
        &mut tx,
        task,
        &exercise.checksum,
        public.spec.as_ref(),
        model_solution.spec.as_ref(),
    )
    .await?;
    if updated {
        for (kind, declared) in [
            (SpecKind::Public, public.declared_files),
            (SpecKind::ModelSolution, model_solution.declared_files),
        ] {
            if let Some(declared) = declared {
                exercise_task_spec_files::replace_for_exercise_task(
                    &mut tx, task.id, kind, &declared,
                )
                .await?;
            }
        }
    }
    tx.commit().await?;
    Ok(updated)
}

/// Removes the repository's retired archives that nothing refers to any more. Failures are only
/// logged; the archives are tried again after the next sync.
async fn remove_unused_archives(
    conn: &mut PgConnection,
    repository_id: Uuid,
    file_store: &dyn FileStore,
) {
    let archives =
        match exercise_repositories::get_unused_retired_archives(conn, repository_id).await {
            Ok(archives) => archives,
            Err(err) => {
                error!("Failed to list the retired archives of {repository_id}: {err}");
                return;
            }
        };
    for archive in archives {
        match file_store.delete(Path::new(&archive.archive_path)).await {
            Ok(()) => {}
            Err(err) if matches!(err.error_type(), UtilErrorType::FileNotFound) => {}
            Err(err) => {
                error!(
                    "Failed to remove the retired archive {}: {err}",
                    archive.archive_path
                );
                continue;
            }
        }
        if let Err(err) =
            exercise_repositories::mark_retired_archive_removed(conn, &archive.archive_path).await
        {
            error!(
                "Failed to record the removal of {}: {err}",
                archive.archive_path
            );
        }
    }
}

/// Deletes the repository and its exercises. Their archives are removed unless exercise tasks or
/// copies of the course still use them.
pub async fn delete(
    conn: &mut PgConnection,
    repository_id: Uuid,
    file_store: &dyn FileStore,
) -> anyhow::Result<()> {
    let mut tx = conn.begin().await?;
    let archives = repository_exercises::delete_for_repository(&mut tx, repository_id).await?;
    exercise_repositories::delete(&mut tx, repository_id).await?;
    for archive in &archives {
        exercise_repositories::retire_archive(&mut tx, repository_id, archive).await?;
    }
    tx.commit().await?;
    remove_unused_archives(conn, repository_id, file_store).await;
    Ok(())
}

#[cfg(test)]
mod test {
    #[test]
    fn clone_urls_name_their_host() {
        use super::clone_url_host_and_port;
        assert_eq!(
            clone_url_host_and_port("https://github.com/rage/x.git"),
            Some(("github.com".to_string(), 443))
        );
        assert_eq!(
            clone_url_host_and_port("ssh://git@github.com:2222/rage/x.git"),
            Some(("github.com".to_string(), 2222))
        );
        assert_eq!(
            clone_url_host_and_port("git@github.com:rage/x.git"),
            Some(("github.com".to_string(), 22))
        );
        assert_eq!(
            clone_url_host_and_port("git@GitHub.com.:rage/x.git"),
            Some(("github.com".to_string(), 22))
        );
        assert_eq!(
            clone_url_host_and_port("https://github.com./rage/x.git"),
            Some(("github.com".to_string(), 443))
        );
        for refused in [
            "http://github.com/rage/x.git",
            "file:///etc",
            "/var/run/secrets",
            "git://github.com/rage/x.git",
            "github.com:rage/x.git",
            "https://1.1.1.1\\@127.0.0.1/x.git",
            "https://1.1.1.1?@127.0.0.1/x.git",
            "https://1.1.1.1#@127.0.0.1/x.git",
            "https://a@b@127.0.0.1/x.git",
            "https://github.com/rage/x.git\n",
        ] {
            assert_eq!(clone_url_host_and_port(refused), None, "{refused}");
        }
    }

    #[tokio::test]
    async fn clone_urls_to_private_addresses_are_refused() {
        for url in [
            "https://127.0.0.1/x.git",
            "ssh://git@10.0.0.1/x.git",
            "git@localhost:x.git",
        ] {
            assert!(
                super::ensure_clone_url_is_allowed(url).await.is_err(),
                "{url}"
            );
        }
    }

    use super::*;

    fn remembered_key(sha256_fingerprint: &str) -> ExerciseRepositorySshHostKey {
        ExerciseRepositorySshHostKey {
            id: Uuid::new_v4(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            deleted_at: None,
            host: "git.example.org".to_string(),
            port: 22,
            sha256_fingerprint: sha256_fingerprint.to_string(),
        }
    }

    // git2 builds libgit2 without any network transport unless asked, so a dependency bump that
    // drops these features only shows up when a repository fails to clone.
    #[test]
    fn libgit2_can_clone_over_https_and_ssh() {
        let version = git2::Version::get();
        assert!(version.https(), "git2 is missing its `https` feature");
        assert!(version.ssh(), "git2 is missing its `ssh` feature");
    }

    #[test]
    fn pinned_hosts_accept_only_their_published_keys() {
        let github = "+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU";
        let gitlab = "eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8";
        assert_eq!(
            check_ssh_host_key("GitHub.com", 22, None, Some(github)),
            Ok(AcceptedHostKey::Known)
        );
        assert!(check_ssh_host_key("github.com", 22, None, Some(gitlab)).is_err());
        let remembered = remembered_key(gitlab);
        assert!(
            check_ssh_host_key("github.com", 22, Some(&remembered), Some(gitlab)).is_err(),
            "a remembered key must not override a pinned host"
        );
    }

    #[test]
    fn other_hosts_trust_the_first_key_and_reject_a_changed_one() {
        assert_eq!(
            check_ssh_host_key("git.example.org", 22, None, Some("first")),
            Ok(AcceptedHostKey::FirstSeen("first".to_string()))
        );
        let remembered = remembered_key("first");
        assert_eq!(
            check_ssh_host_key("git.example.org", 22, Some(&remembered), Some("first")),
            Ok(AcceptedHostKey::Known)
        );
        let changed =
            check_ssh_host_key("git.example.org", 2222, Some(&remembered), Some("second"))
                .unwrap_err();
        assert!(changed.contains("has changed"), "{changed}");
        assert!(changed.contains("git.example.org:2222"), "{changed}");
        assert!(changed.contains("SHA256:first"), "{changed}");
    }

    #[test]
    fn a_server_without_a_sha256_fingerprint_is_refused() {
        assert!(check_ssh_host_key("git.example.org", 22, None, None).is_err());
    }

    mod sync {
        use super::super::*;
        use crate::test_helper::*;
        use futures::FutureExt;
        use headless_lms_models::{
            CourseOrExamId, PKeyPolicy,
            exercise_service_info::PathInfo,
            exercise_services::ExerciseServiceNewOrUpdate,
            exercise_tasks::{self, NewExerciseTask},
        };
        use std::fs;

        fn write(root: &Path, relative: &str, contents: &str) {
            let path = root.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, contents).unwrap();
        }

        async fn insert_repository(conn: &mut PgConnection, course_id: Uuid) -> Uuid {
            let id = Uuid::new_v4();
            exercise_repositories::new(
                conn,
                id,
                CourseOrExamId::Course(course_id),
                "https://example.com/repo.git",
                None,
                None,
                None,
            )
            .await
            .unwrap();
            id
        }

        async fn insert_exercise_service(conn: &mut PgConnection) -> String {
            let slug = format!("repository-sync-{}", Uuid::new_v4());
            let service = exercise_services::insert_exercise_service(
                conn,
                &ExerciseServiceNewOrUpdate {
                    name: slug.clone(),
                    slug: slug.clone(),
                    public_url: "https://example.com".to_string(),
                    internal_url: None,
                    max_reprocessing_submissions_at_once: 1,
                    is_global_admin_only: false,
                    is_experimental: false,
                },
            )
            .await
            .unwrap();
            exercise_service_info::insert(
                conn,
                &PathInfo {
                    exercise_service_id: service.id,
                    user_interface_iframe_path: "/iframe".to_string(),
                    grade_endpoint_path: "/grade".to_string(),
                    public_spec_endpoint_path: "/public-spec".to_string(),
                    model_solution_spec_endpoint_path: "/model-solution".to_string(),
                    has_custom_view: false,
                    supports_native_client: false,
                    produces_file_answers: false,
                    declares_spec_files: false,
                },
            )
            .await
            .unwrap();
            slug
        }

        fn derive_from_download_url<'a>(
            url: Url,
            _: &'a str,
            _: Option<&'a serde_json::Value>,
            repository_exercise: Option<&'a RepositoryExercise>,
        ) -> BoxFuture<'a, ModelResult<serde_json::Value>> {
            let spec = serde_json::json!({
                "endpoint": url.path(),
                "derived_from": repository_exercise.unwrap().download_url,
            });
            async move { Ok(spec) }.boxed()
        }

        fn unused_spec_fetcher<'a>(
            _: Url,
            _: &'a str,
            _: Option<&'a serde_json::Value>,
            _: Option<&'a RepositoryExercise>,
        ) -> BoxFuture<'a, ModelResult<serde_json::Value>> {
            unreachable!("nothing is outdated")
        }

        fn unused_service_info_fetcher(
            _url: Url,
        ) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
            unreachable!("the service info is stored")
        }

        /// Points the task at the repository exercise, as if the editor had picked its current
        /// version.
        async fn use_repository_exercise(
            conn: &mut PgConnection,
            task_id: Uuid,
            exercise: &RepositoryExercise,
        ) {
            sqlx::query(
                "UPDATE exercise_tasks SET repository_exercise_id = $1, repository_exercise_checksum = $2 WHERE id = $3",
            )
            .bind(exercise.id)
            .bind(&exercise.checksum)
            .bind(task_id)
            .execute(conn)
            .await
            .unwrap();
        }

        async fn exercise_named(
            conn: &mut PgConnection,
            repository_id: Uuid,
            name: &str,
        ) -> RepositoryExercise {
            repository_exercises::get_for_repository(conn, repository_id)
                .await
                .unwrap()
                .into_iter()
                .find(|e| e.name == name)
                .unwrap()
        }

        #[actix_web::test]
        async fn an_unchanged_copy_does_not_take_the_original_id() {
            insert_data!(:tx, :user, :org, :course);
            let file_store = temp_file_store();
            let app_conf = init_app_conf().unwrap();
            let repository_id = insert_repository(tx.as_mut(), course).await;
            let checkout = tempfile::tempdir().unwrap();
            let root = checkout.path();
            write(root, "part01/original/setup.py", "same");
            sync_checkout(tx.as_mut(), repository_id, root, &file_store, &app_conf)
                .await
                .unwrap();
            let original = exercise_named(tx.as_mut(), repository_id, "original").await;

            write(root, "part01/a_copy/setup.py", "same");
            let report = sync_checkout(tx.as_mut(), repository_id, root, &file_store, &app_conf)
                .await
                .unwrap();

            assert_eq!(report.added, vec!["part01/a_copy"]);
            assert!(report.renamed.is_empty());
            let original_now = exercise_named(tx.as_mut(), repository_id, "original").await;
            assert_eq!(original_now.id, original.id);
        }

        #[actix_web::test]
        async fn a_resync_updates_exercises_in_place_and_reports_the_changes() {
            insert_data!(:tx, :user, :org, :course);
            let file_store = temp_file_store();
            let app_conf = init_app_conf().unwrap();
            let repository_id = insert_repository(tx.as_mut(), course).await;
            let checkout = tempfile::tempdir().unwrap();
            let root = checkout.path();
            write(root, "part01/changed/setup.py", "v1");
            write(root, "part01/moved/setup.py", "same");
            write(root, "part01/dropped/setup.py", "dropped");
            write(root, "part01/kept_in_use/setup.py", "in use");

            let first = sync_checkout(tx.as_mut(), repository_id, root, &file_store, &app_conf)
                .await
                .unwrap();
            assert_eq!(first.added.len(), 4);
            let changed = exercise_named(tx.as_mut(), repository_id, "changed").await;
            let moved = exercise_named(tx.as_mut(), repository_id, "moved").await;
            let in_use = exercise_named(tx.as_mut(), repository_id, "kept_in_use").await;
            insert_data!(tx: tx, user: user, org: org, course: course; instance: _instance, course_module: _course_module, :chapter, :page, :exercise, :slide);
            let task_id = exercise_tasks::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                NewExerciseTask {
                    exercise_slide_id: slide,
                    exercise_type: "tmc".to_string(),
                    assignment: vec![],
                    public_spec: None,
                    private_spec: Some(serde_json::json!({
                        "type": "browser",
                        "repository_exercise": in_use,
                    })),
                    model_solution_spec: None,
                    order_number: 0,
                },
            )
            .await
            .unwrap();
            use_repository_exercise(tx.as_mut(), task_id, &in_use).await;

            write(root, "part01/changed/setup.py", "v2");
            fs::rename(root.join("part01/moved"), root.join("part02-moved")).unwrap();
            fs::remove_dir_all(root.join("part01/dropped")).unwrap();
            fs::remove_dir_all(root.join("part01/kept_in_use")).unwrap();
            write(root, "part03/new/setup.py", "new");
            let second = sync_checkout(tx.as_mut(), repository_id, root, &file_store, &app_conf)
                .await
                .unwrap();

            assert_eq!(second.added, vec!["part03/new"]);
            assert_eq!(second.updated, vec!["part01/changed"]);
            assert_eq!(
                second.renamed,
                vec![RenamedRepositoryExercise {
                    from: "part01/moved".to_string(),
                    to: "part02-moved".to_string(),
                }]
            );
            assert_eq!(second.removed, vec!["part01/dropped"]);
            assert_eq!(second.missing_but_in_use, vec!["part01/kept_in_use"]);

            let changed_now = exercise_named(tx.as_mut(), repository_id, "changed").await;
            assert_eq!(changed_now.id, changed.id);
            assert_ne!(changed_now.checksum, changed.checksum);
            assert_ne!(changed_now.download_url, changed.download_url);
            let moved_now = exercise_named(tx.as_mut(), repository_id, "part02-moved").await;
            assert_eq!(moved_now.id, moved.id);
            assert_eq!(moved_now.part, "");
            assert_eq!(moved_now.download_url, moved.download_url);
            assert_eq!(
                exercise_named(tx.as_mut(), repository_id, "kept_in_use")
                    .await
                    .id,
                in_use.id
            );

            // The previous archive outlives the update until nothing refers to it.
            let old_path = changed.download_url.split("/api/v0/files/").nth(1).unwrap();
            assert!(file_store.0.path().join(old_path).exists());
            remove_unused_archives(tx.as_mut(), repository_id, &file_store).await;
            assert!(!file_store.0.path().join(old_path).exists());
            let in_use_path = in_use.download_url.split("/api/v0/files/").nth(1).unwrap();
            assert!(file_store.0.path().join(in_use_path).exists());
        }

        #[actix_web::test]
        async fn a_failed_sync_changes_nothing_and_removes_its_uploads() {
            insert_data!(:tx, :user, :org, :course);
            let file_store = temp_file_store();
            let app_conf = init_app_conf().unwrap();
            let repository_id = insert_repository(tx.as_mut(), course).await;
            let checkout = tempfile::tempdir().unwrap();
            write(checkout.path(), "part01/ex/setup.py", "v1");
            sync_checkout(
                tx.as_mut(),
                repository_id,
                checkout.path(),
                &file_store,
                &app_conf,
            )
            .await
            .unwrap();
            let before = exercise_named(tx.as_mut(), repository_id, "ex").await;

            write(checkout.path(), "part01/ex/setup.py", "v2");
            write(checkout.path(), "part01/other/setup.py", "");
            // A part longer than the column allows fails the transaction after uploading.
            let long_dir = "x".repeat(100);
            write(
                checkout.path(),
                &format!("{long_dir}/{long_dir}/{long_dir}/ex2/setup.py"),
                "",
            );
            assert!(
                sync_checkout(
                    tx.as_mut(),
                    repository_id,
                    checkout.path(),
                    &file_store,
                    &app_conf
                )
                .await
                .is_err()
            );

            let after = exercise_named(tx.as_mut(), repository_id, "ex").await;
            assert_eq!(after, before);
            let stored: Vec<_> = walkdir::WalkDir::new(file_store.0.path())
                .into_iter()
                .filter_map(Result::ok)
                .filter(|e| e.file_type().is_file())
                .collect();
            assert_eq!(stored.len(), 1, "{stored:?}");
        }

        #[actix_web::test]
        async fn refreshes_the_tasks_derived_from_an_outdated_exercise() {
            insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, :page, :exercise, :slide);
            let file_store = temp_file_store();
            let app_conf = init_app_conf().unwrap();
            let slug = insert_exercise_service(tx.as_mut()).await;
            let repository_id = insert_repository(tx.as_mut(), course).await;
            let checkout = tempfile::tempdir().unwrap();
            write(checkout.path(), "part01/ex/setup.py", "v1");
            sync_checkout(
                tx.as_mut(),
                repository_id,
                checkout.path(),
                &file_store,
                &app_conf,
            )
            .await
            .unwrap();
            let picked = exercise_named(tx.as_mut(), repository_id, "ex").await;
            let private_spec = serde_json::json!({
                "type": "editor",
                "repository_exercise": picked,
            });
            let task_id = exercise_tasks::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                NewExerciseTask {
                    exercise_slide_id: slide,
                    exercise_type: slug.clone(),
                    assignment: vec![],
                    public_spec: Some(serde_json::json!({ "checksum": "old" })),
                    private_spec: Some(private_spec.clone()),
                    model_solution_spec: None,
                    order_number: 0,
                },
            )
            .await
            .unwrap();
            use_repository_exercise(tx.as_mut(), task_id, &picked).await;

            write(checkout.path(), "part01/ex/setup.py", "v2");
            let mut report = sync_checkout(
                tx.as_mut(),
                repository_id,
                checkout.path(),
                &file_store,
                &app_conf,
            )
            .await
            .unwrap();
            refresh_exercise_tasks(
                tx.as_mut(),
                repository_id,
                derive_from_download_url,
                unused_service_info_fetcher,
                &mut report,
            )
            .await
            .unwrap();

            assert_eq!(report.refreshed_exercise_task_count, 1);
            assert!(report.failed_exercise_tasks.is_empty());
            let current = exercise_named(tx.as_mut(), repository_id, "ex").await;
            let task = exercise_tasks::get_exercise_task_by_id(tx.as_mut(), task_id)
                .await
                .unwrap();
            assert_eq!(task.private_spec, Some(private_spec));
            assert_eq!(
                task.repository_exercise_checksum,
                Some(current.checksum.clone())
            );
            assert_eq!(
                task.public_spec.unwrap(),
                serde_json::json!({
                    "endpoint": "/public-spec",
                    "derived_from": current.download_url,
                })
            );
            assert_eq!(
                task.model_solution_spec.unwrap(),
                serde_json::json!({
                    "endpoint": "/model-solution",
                    "derived_from": current.download_url,
                })
            );

            // An up-to-date task is left alone.
            refresh_exercise_tasks(
                tx.as_mut(),
                repository_id,
                unused_spec_fetcher,
                unused_service_info_fetcher,
                &mut ExerciseRepositorySyncReport::default(),
            )
            .await
            .unwrap();
        }
    }
}
