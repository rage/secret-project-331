use anyhow::Context;
use base64::{Engine as _, engine::general_purpose::STANDARD_NO_PAD};
use blake3::Hash;
use git2::{
    CertificateCheckStatus, Cred, FetchOptions, RemoteCallbacks, RemoteRedirect,
    build::RepoBuilder, cert::Cert,
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    exercise_repositories, exercise_repository_ssh_host_keys,
    exercise_repository_ssh_host_keys::RememberedSshHostKey, repository_exercises,
};
use headless_lms_utils::{
    file_store::{self, FileStore},
    folder_checksum,
};
use secrecy::{ExposeSecret, SecretString};
use sqlx::{Acquire, PgConnection};
use std::{
    cell::Cell,
    collections::HashMap,
    io::Cursor,
    path::{Path, PathBuf},
};
use uuid::Uuid;
use walkdir::{DirEntry, WalkDir};

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
    remembered: Option<&RememberedSshHostKey>,
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

/// Clones `url` into `target`, verifying the server the way [`check_ssh_host_key`] describes and
/// remembering a first-seen ssh host key once the clone succeeds. TLS certificates are left to
/// libgit2's own validation.
async fn clone_repository(
    conn: &mut PgConnection,
    url: &str,
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
    fetch_opts.remote_callbacks(remote_cbs);
    if let Err(error) = RepoBuilder::new()
        .fetch_options(fetch_opts)
        .clone(url, target)
    {
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

pub struct StoredRepositoryExercise {
    pub url: String,
}

/// Processes an exercise repository, creating a repository exercise for each exercise in it.
/// Each exercise is compressed and uploaded to file storage.
pub async fn process(
    conn: &mut PgConnection,
    repository_id: Uuid,
    url: &str,
    public_key: Option<&str>,
    deploy_key: Option<&SecretString>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<Vec<StoredRepositoryExercise>> {
    let mut stored_files = vec![];
    match process_inner(InnerArgs {
        conn,
        repository_id,
        url,
        public_key,
        deploy_key,
        file_store,
        stored_files: &mut stored_files,
        app_conf,
    })
    .await
    {
        Ok(res) => {
            exercise_repositories::mark_success(conn, repository_id).await?;
            Ok(res)
        }
        Err(err) => {
            if !stored_files.is_empty() {
                warn!(
                    "Failed while creating new exercise repository, cleaning files that were uploaded"
                );
                for file in stored_files {
                    if let Err(err) = file_store.delete(&file).await {
                        error!("Failed to clean file {}: {err}", file.display());
                    }
                }
            }
            exercise_repositories::mark_failure(conn, repository_id, &err.to_string()).await?;
            Err(err)
        }
    }
}

struct InnerArgs<'a> {
    conn: &'a mut PgConnection,
    repository_id: Uuid,
    url: &'a str,
    public_key: Option<&'a str>,
    deploy_key: Option<&'a SecretString>,
    file_store: &'a dyn FileStore,
    stored_files: &'a mut Vec<PathBuf>,
    app_conf: &'a ApplicationConfiguration,
}

// implements the logic for process so that we can conveniently handle all errors in process
async fn process_inner(
    InnerArgs {
        conn,
        repository_id,
        url,
        public_key,
        deploy_key,
        file_store,
        stored_files,
        app_conf,
    }: InnerArgs<'_>,
) -> anyhow::Result<Vec<StoredRepositoryExercise>> {
    // clone repo to temp dir
    let temp = tempfile::tempdir()?;
    info!("Cloning {url} to {:?}", temp.path());
    // Outside the transaction: a first-seen host key must outlive a failed processing, and must not
    // lock out other clones of the host while processing runs.
    clone_repository(
        conn,
        url,
        deploy_key.map(|deploy_key| (public_key, deploy_key)),
        temp.path(),
    )
    .await?;
    info!("Finished cloning {url} to {:?}", temp.path());
    let mut tx = conn.begin().await?;

    // create exercises in db and store them in file store
    let found_exercises = find_exercise_directories(temp.path()).await?;
    let mut repository_exercises = vec![];
    // (part, name) => exercise
    let existing_exercises =
        repository_exercises::get_for_repository(&mut tx, repository_id).await?;

    // we try both the path and the checksum to find existing exercises
    // these are the only attributes found in the exercise repositories, so if both
    // the path and checksum change there's no way to detect that it's supposed to be an updated old exercise
    // rather than a new one
    // this way we can accommodate both renaming/relocating exercises and changing them, though not at the same time...
    let existing_exercises_path_map = existing_exercises
        .iter()
        .map(|ex| ((&ex.part, &ex.name), ex))
        .collect::<HashMap<_, _>>();
    let existing_exercises_checksum_map = existing_exercises
        .iter()
        .map(|ex| (ex.checksum.as_slice(), ex))
        .collect::<HashMap<_, _>>();
    for fe in &found_exercises {
        // check if the exercise is new
        match (
            existing_exercises_path_map.get(&(&fe.part, &fe.name)),
            existing_exercises_checksum_map.get(fe.checksum.as_bytes().as_slice()),
        ) {
            (Some(_), Some(_)) => {
                // both the path and checksum are unchanged, no-op
            }
            (Some(existing_exercise_by_path), None) => {
                // found exercise by path but the checksum has changed, exercise has been updated
                let path = update_exercise(
                    &mut tx,
                    repository_id,
                    existing_exercise_by_path.id,
                    fe,
                    file_store,
                    app_conf,
                )
                .await?;
                stored_files.push(path.clone());
                let url = file_store.get_direct_download_url(&path).await?;
                repository_exercises.push(StoredRepositoryExercise { url });
                repository_exercises::update_checksum(
                    &mut tx,
                    existing_exercise_by_path.id,
                    fe.checksum.as_bytes(),
                )
                .await?;
                // todo: uploaded files get cleaned up on an error, which means that if the refreshing fails
                // the exercise data will be missing entirely...
            }
            (None, Some(existing_exercise_by_checksum)) => {
                // found exercise by checksum but the path has changed, update path
                repository_exercises::update_part_and_name(
                    &mut tx,
                    existing_exercise_by_checksum.id,
                    &fe.part,
                    &fe.name,
                )
                .await?;
            }
            (None, None) => {
                // new exercise
                let new_exercise_id = uuid::Uuid::new_v4();
                let path = create_and_upload_exercise(
                    &mut tx,
                    repository_id,
                    new_exercise_id,
                    fe,
                    file_store,
                    app_conf,
                )
                .await?;
                stored_files.push(path.clone());
                let url = file_store.get_direct_download_url(&path).await?;
                repository_exercises.push(StoredRepositoryExercise { url });
            }
        }
    }

    tx.commit().await?;
    Ok(repository_exercises)
}

/// Updates the given repository using the given url.
/// Exercises with a known checksum but changed part or name are updated to reflect the new part or name.
/// Exercises with a known part and name but changed checksum are updated in the file store and the checksum updated.
/// Errors may leave some exercises updated and others not, since there's no mechanism for rolling back any file store updates.
/// However, these inconsistencies will be fixed after a successful retry.
pub async fn update(
    conn: &mut PgConnection,
    repository: Uuid,
    url: &str,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let mut new_stored_files = vec![];
    match update_inner(
        conn,
        repository,
        url,
        file_store,
        &mut new_stored_files,
        app_conf,
    )
    .await
    {
        Ok(res) => Ok(res),
        Err(err) => {
            if !new_stored_files.is_empty() {
                debug!(
                    "Failed while updating exercise repository, cleaning new exercises that were uploaded"
                );
                for file in new_stored_files {
                    if let Err(err) = file_store.delete(&file).await {
                        error!("Failed to clean file {}: {err}", file.display());
                    }
                }
            }
            Err(err)
        }
    }
}

async fn update_inner(
    conn: &mut PgConnection,
    repository: Uuid,
    url: &str,
    file_store: &dyn FileStore,
    new_stored_files: &mut Vec<PathBuf>,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let temp = tempfile::tempdir()?;
    clone_repository(conn, url, None, temp.path()).await?;
    let mut tx = conn.begin().await?;

    let repository_exercises = find_exercise_directories(temp.path()).await?;
    let current_exercises = repository_exercises::get_for_repository(&mut tx, repository).await?;

    let mut by_name = HashMap::new();
    let mut by_checksum = HashMap::new();
    for ex in &current_exercises {
        by_name.insert((&ex.part, &ex.name), ex);
        by_checksum.insert(ex.checksum.as_slice(), ex);
    }
    for ex in repository_exercises {
        if let Some(&current) = by_name.get(&(&ex.part, &ex.name)) {
            // found known exercise by part and name
            if current.checksum != ex.checksum.as_bytes() {
                // checksum changed, update files and checksum
                create_and_upload_exercise(
                    &mut tx, repository, current.id, &ex, file_store, app_conf,
                )
                .await?;
                repository_exercises::update_checksum(&mut tx, current.id, ex.checksum.as_bytes())
                    .await?;
            }
        } else if let Some(&current) = by_checksum.get(ex.checksum.as_bytes().as_slice()) {
            // found known exercise by checksum
            if current.part != ex.part || current.name != ex.name {
                // part and/or name changed
                repository_exercises::update_part_and_name(&mut tx, current.id, &ex.part, &ex.name)
                    .await?;
            }
        } else {
            // unknown part/name and checksum, assume new exercise
            let path = create_and_upload_exercise(
                &mut tx,
                repository,
                Uuid::new_v4(),
                &ex,
                file_store,
                app_conf,
            )
            .await?;
            new_stored_files.push(path);
        }
    }

    tx.commit().await?;
    Ok(())
}

/// Marks the exercises and repository as deleted and removes the associated files from the file store.
/// Only returns the last error if there are multiple errors when trying to remove the files.
pub async fn delete(
    conn: &mut PgConnection,
    repository_id: Uuid,
    file_store: &dyn FileStore,
) -> anyhow::Result<()> {
    let mut tx = conn.begin().await?;

    let mut latest_error = None;
    let exercises = repository_exercises::delete_for_repository(&mut tx, repository_id).await?;
    exercise_repositories::delete(&mut tx, repository_id).await?;
    for exercise in exercises {
        let path = file_store::repository_exercise_path(repository_id, exercise);
        if let Err(err) = file_store.delete(&path).await {
            error!(
                "Failed to delete file while deleting repository {}: {err}",
                path.display()
            );
            latest_error = Some(err);
        }
    }

    match latest_error {
        Some(latest_error) => Err(latest_error.into()),
        _ => {
            tx.commit().await?;
            Ok(())
        }
    }
}

async fn create_and_upload_exercise(
    conn: &mut PgConnection,
    repository: Uuid,
    exercise_id: Uuid,
    exercise: &FoundExercise,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<PathBuf> {
    // archive and compress
    let cursor = Cursor::new(vec![]);
    let mut tar = tar::Builder::new(cursor);
    // The repository is teacher-controlled; following its symlinks would archive server files.
    tar.follow_symlinks(false);
    tar.append_dir_all(".", &exercise.path)?;
    let mut tar = tar.into_inner()?;
    // rewind cursor back to the beginning
    tar.set_position(0);
    let tar_zstd = zstd::encode_all(tar, 0)?;

    // upload
    let path = file_store::repository_exercise_path(repository, exercise_id);
    file_store
        .upload(&path, tar_zstd, "application/zstd")
        .await?;
    let url = file_store.get_download_url(&path, app_conf);

    // create
    repository_exercises::new(
        conn,
        exercise_id,
        repository,
        &exercise.part,
        &exercise.name,
        exercise.checksum.as_bytes(),
        &url,
    )
    .await?;
    Ok(path)
}

async fn update_exercise(
    conn: &mut PgConnection,
    repository: Uuid,
    exercise_id: Uuid,
    exercise: &FoundExercise,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<PathBuf> {
    // archive and compress
    let cursor = Cursor::new(vec![]);
    let mut tar = tar::Builder::new(cursor);
    // The repository is teacher-controlled; following its symlinks would archive server files.
    tar.follow_symlinks(false);
    tar.append_dir_all(".", &exercise.path)?;
    let mut tar = tar.into_inner()?;
    // rewind cursor back to the beginning
    tar.set_position(0);
    let tar_zstd = zstd::encode_all(tar, 0)?;

    // upload
    let path = file_store::repository_exercise_path(repository, exercise_id);
    file_store
        .upload(&path, tar_zstd, "application/zstd")
        .await?;
    let url = file_store.get_download_url(&path, app_conf);

    // create
    repository_exercises::new(
        conn,
        exercise_id,
        repository,
        &exercise.part,
        &exercise.name,
        exercise.checksum.as_bytes(),
        &url,
    )
    .await?;
    Ok(path)
}

#[derive(Debug)]
struct FoundExercise {
    part: String,
    name: String,
    checksum: Hash,
    path: PathBuf,
}

async fn find_exercise_directories(clone_path: &Path) -> anyhow::Result<Vec<FoundExercise>> {
    info!("finding exercise directories in {}", clone_path.display());

    let mut exercises = vec![];
    // exercises in repositories are in subdirs like
    // part01/01_exercise
    // part01/02_exercise
    // part02/01_exercise
    for entry in WalkDir::new(clone_path)
        .min_depth(2)
        .max_depth(2)
        .into_iter()
        .filter_entry(|e| {
            e.file_type().is_dir()
                && e.file_name() != "private"
                && !is_hidden_dir(e)
                && !contains_tmcignore(e)
                && !is_in_git_dir(e.path())
        })
    {
        let entry = entry?;
        let checksum = folder_checksum::hash_folder(entry.path()).await?;

        let path = entry.into_path().canonicalize()?;
        let part = path
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Path should be in a subdirectory: {}", path.display()))?
            .file_name()
            .ok_or_else(|| {
                anyhow::anyhow!("The parent file name cannot be missing: {}", path.display())
            })?
            .to_str()
            .context("Invalid directory name in repository")?
            .to_string();
        let name = path
            .file_name()
            .ok_or_else(|| anyhow::anyhow!("Path should be a directory: {}", path.display()))?
            .to_str()
            .context("Invalid directory name in repository")?
            .to_string();
        exercises.push(FoundExercise {
            part,
            name,
            checksum,
            path,
        });
    }
    Ok(exercises)
}

// Filter for hidden directories (directories with names starting with '.')
fn is_hidden_dir(entry: &DirEntry) -> bool {
    let skip = entry.metadata().map(|e| e.is_dir()).unwrap_or_default()
        && entry
            .file_name()
            .to_str()
            .map(|s| s.starts_with('.'))
            .unwrap_or_default();
    if skip {
        debug!("is hidden dir: {}", entry.path().display());
    }
    skip
}

// Filter for .git directory
fn is_in_git_dir(path: &Path) -> bool {
    let skip = path.parent().map(|p| p.ends_with(".git")).unwrap_or(false);
    if skip {
        debug!("is in git dir: {}", path.display());
    }
    skip
}

fn contains_tmcignore(entry: &DirEntry) -> bool {
    for entry in WalkDir::new(entry.path())
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let is_file = entry.metadata().map(|e| e.is_file()).unwrap_or_default();
        if is_file && entry.file_name() == ".tmcignore" {
            debug!("contains .tmcignore: {}", entry.path().display());
            return true;
        }
    }
    false
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
    use std::{fs::Permissions, os::unix::prelude::PermissionsExt, str::FromStr};

    #[tokio::test]
    async fn finds_exercise_dirs() {
        let repo = tempfile::tempdir().unwrap();

        std::fs::create_dir_all(repo.path().join("part01/01_exercise")).unwrap();
        std::fs::write(repo.path().join("part01/01_exercise/file"), "1234").unwrap();

        std::fs::create_dir_all(repo.path().join("part01/02_exercise")).unwrap();
        std::fs::write(repo.path().join("part01/02_exercise/file"), "1234").unwrap();

        std::fs::create_dir_all(repo.path().join("part02/01_exercise")).unwrap();
        std::fs::write(repo.path().join("part02/01_exercise/file"), "1234").unwrap();

        // Make sure permissions are the same on all systems. Some systems have different default permissions in the temp folder.
        let file_paths = vec![
            repo.path().join("part01/01_exercise/file"),
            repo.path().join("part01/02_exercise/file"),
            repo.path().join("part02/01_exercise/file"),
        ];
        let folder_paths = vec![
            repo.path().join("part01/01_exercise"),
            repo.path().join("part01/02_exercise"),
            repo.path().join("part02/01_exercise"),
            repo.path().to_path_buf(),
        ];
        for path in file_paths {
            std::fs::set_permissions(path, Permissions::from_mode(0o644)).unwrap();
        }
        for path in folder_paths {
            std::fs::set_permissions(path, Permissions::from_mode(0o755)).unwrap();
        }

        let mut paths = find_exercise_directories(repo.path()).await.unwrap();
        paths.sort_by(|a, b| a.path.cmp(&b.path));
        assert_eq!(paths.len(), 3);

        assert_eq!(&paths[0].path, &repo.path().join("part01/01_exercise"));
        assert_eq!(&paths[0].part, "part01");
        assert_eq!(&paths[0].name, "01_exercise");
        assert_eq!(
            paths[0].checksum,
            Hash::from_str("3a01c5d9a407deec294c4ac561cdeea1a7507464193e06387083853e3ca71c3a")
                .unwrap()
        );

        assert_eq!(&paths[1].name, "02_exercise");
        assert_eq!(&paths[2].name, "01_exercise");
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
        let remembered = RememberedSshHostKey {
            sha256_fingerprint: gitlab.to_string(),
            created_at: chrono::Utc::now(),
        };
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
        let remembered = RememberedSshHostKey {
            sha256_fingerprint: "first".to_string(),
            created_at: chrono::Utc::now(),
        };
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

    #[test]
    fn filters_git() {
        assert!(is_in_git_dir(Path::new("something/.git/something")));
        assert!(!is_in_git_dir(Path::new(
            "something/.git/something/something"
        )));
    }
}
