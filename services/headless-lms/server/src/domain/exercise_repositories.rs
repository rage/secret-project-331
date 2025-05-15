use anyhow::Context;
use blake3::Hash;
use git2::{build::RepoBuilder, Cred, FetchOptions, RemoteCallbacks, Repository};
use headless_lms_models::{exercise_repositories, repository_exercises};
use headless_lms_utils::{
    file_store::{self, FileStore},
    folder_checksum, ApplicationConfiguration,
};
use sqlx::{Acquire, PgConnection};
use std::{
    collections::HashMap,
    io::Cursor,
    path::{Path, PathBuf},
};
use uuid::Uuid;
use walkdir::{DirEntry, WalkDir};

pub struct StoredRepositoryExercise {
    pub url: String,
}

/// Processes an exercise repository, creating a repository exercise for each exercise in it.
/// Each exercise is compressed and uploaded to file storage.
pub async fn process(
    conn: &mut PgConnection,
    repository_id: Uuid,
    url: &str,
    deploy_key: Option<&str>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<Vec<StoredRepositoryExercise>> {
    let mut stored_files = vec![];
    match process_inner(
        conn,
        repository_id,
        url,
        deploy_key,
        file_store,
        &mut stored_files,
        app_conf,
    )
    .await
    {
        Ok(res) => {
            exercise_repositories::mark_success(conn, repository_id).await?;
            Ok(res)
        }
        Err(err) => {
            if !stored_files.is_empty() {
                warn!("Failed while creating new exercise repository, cleaning files that were uploaded");
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

// implements the logic for process so that we can conveniently handle all errors in process
async fn process_inner(
    conn: &mut PgConnection,
    repository_id: Uuid,
    url: &str,
    deploy_key: Option<&str>,
    file_store: &dyn FileStore,
    stored_files: &mut Vec<PathBuf>,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<Vec<StoredRepositoryExercise>> {
    let mut tx = conn.begin().await?;

    // clone repo to temp dir
    let temp = tempfile::tempdir()?;
    let mut fetch_opts = FetchOptions::new();
    if let Some(deploy_key) = deploy_key {
        let mut remote_cbs = RemoteCallbacks::new();
        remote_cbs.credentials(|_, username, credential_type| {
            if credential_type.is_ssh_memory() {
                Cred::ssh_key_from_memory(username.unwrap_or("git"), None, deploy_key, None)
            } else {
                Err(git2::Error::from_str(
                    "The git server does not support the SSH_MEMORY credential type",
                ))
            }
        });
        fetch_opts.remote_callbacks(remote_cbs);
    }
    RepoBuilder::new()
        .fetch_options(fetch_opts)
        .clone(url, temp.path())?;

    // create exercises in db and store them in file store
    let new_exercises = find_exercise_directories(temp.path()).await?;
    let mut repository_exercises = vec![];
    for ex in &new_exercises {
        let new_exercise_id = Uuid::new_v4();
        let path = create_and_upload_exercise(
            &mut tx,
            repository_id,
            new_exercise_id,
            ex,
            file_store,
            app_conf,
        )
        .await?;
        let url = file_store.get_direct_download_url(&path).await?;
        stored_files.push(path);
        repository_exercises.push(StoredRepositoryExercise { url });
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
                debug!("Failed while updating exercise repository, cleaning new exercises that were uploaded");
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
    let mut tx = conn.begin().await?;

    let temp = tempfile::tempdir()?;
    Repository::clone(url, &temp)?;

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

    if let Some(latest_error) = latest_error {
        Err(latest_error.into())
    } else {
        tx.commit().await?;
        Ok(())
    }
}

async fn create_and_upload_exercise(
    conn: &mut PgConnection,
    repository: Uuid,
    exercise_id: Uuid,
    exercise: &NewExercise,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> anyhow::Result<PathBuf> {
    // archive and compress
    let cursor = Cursor::new(vec![]);
    let mut tar = tar::Builder::new(cursor);
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
struct NewExercise {
    part: String,
    name: String,
    checksum: Hash,
    path: PathBuf,
}

async fn find_exercise_directories(clone_path: &Path) -> anyhow::Result<Vec<NewExercise>> {
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
            e.file_name() != "private"
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
            .expect("Path should be in a subdirectory")
            .file_name()
            .expect("The parent file name cannot be missing")
            .to_str()
            .context("Invalid directory name in repository")?
            .to_string();
        let name = path
            .file_name()
            .expect("Path should be a file")
            .to_str()
            .context("Invalid directory name in repository")?
            .to_string();
        exercises.push(NewExercise {
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

    #[test]
    fn filters_git() {
        assert!(is_in_git_dir(Path::new("something/.git/something")));
        assert!(!is_in_git_dir(Path::new(
            "something/.git/something/something"
        )));
    }
}
