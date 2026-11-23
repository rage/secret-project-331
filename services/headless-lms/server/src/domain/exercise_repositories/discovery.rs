//! Finds the exercises in a repository checkout by the rules tmc-langs uses when tmc-server
//! refreshes a course, so a repository imports the same exercises on both.
//!
//! The rules mirror each tmc-langs plugin's `is_exercise_type_correct`, but never follow symlinks:
//! the repository is teacher-controlled, and the checkout is on the server.

use anyhow::Context;
use blake3::Hash;
use headless_lms_utils::folder_checksum;
use serde_json::{Map, Value};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

const TMCPROJECT_YML: &str = ".tmcproject.yml";

#[derive(Debug)]
pub(super) struct FoundExercise {
    /// The parent directories joined with `-`, as tmc-langs joins them into exercise names.
    pub part: String,
    pub name: String,
    pub checksum: Hash,
    pub path: PathBuf,
}

/// Finds the exercise directories under `root` and writes the root `.tmcproject.yml`, merged with
/// the exercise's own, into each, so the archived exercise carries the settings tmc-langs would
/// apply to it. Modifies the checkout.
pub(super) async fn find_exercises(root: &Path) -> anyhow::Result<Vec<FoundExercise>> {
    let root_config = read_tmcproject_yml(root)?;
    let mut exercises = vec![];
    let mut names = HashSet::new();
    let mut walker = WalkDir::new(root).min_depth(1).into_iter();
    while let Some(entry) = walker.next() {
        let entry = entry?;
        let path = entry.path();
        if !entry.file_type().is_dir() || is_skipped(path) {
            if entry.file_type().is_dir() {
                walker.skip_current_dir();
            }
            continue;
        }
        if !is_exercise(path) {
            continue;
        }
        walker.skip_current_dir();

        let relative = path.strip_prefix(root)?;
        let mut components = relative
            .iter()
            .map(|c| {
                c.to_str()
                    .map(str::to_string)
                    .with_context(|| format!("Invalid directory name in repository: {c:?}"))
            })
            .collect::<anyhow::Result<Vec<_>>>()?;
        let name = components
            .pop()
            .context("An exercise must be in a directory")?;
        let part = components.join("-");
        if !names.insert((part.clone(), name.clone())) {
            anyhow::bail!(
                "Two exercise directories are both named {part}/{name}; rename one of them."
            );
        }
        if let Some(root_config) = &root_config {
            write_merged_tmcproject_yml(path, root_config)?;
        }
        exercises.push(FoundExercise {
            part,
            name,
            checksum: folder_checksum::hash_folder(path).await?,
            path: path.to_path_buf(),
        });
    }
    Ok(exercises)
}

/// Hidden directories, `private` and directories with a `.tmcignore` are neither exercises nor
/// searched for them.
fn is_skipped(dir: &Path) -> bool {
    let name = dir.file_name().and_then(|n| n.to_str()).unwrap_or_default();
    name.starts_with('.') || name == "private" || is_file(&dir.join(".tmcignore"))
}

/// Whether some tmc-langs plugin recognises `dir` as an exercise.
fn is_exercise(dir: &Path) -> bool {
    let has = |relative: &str| exists(&dir.join(relative));
    let has_dir = |relative: &str| is_dir(&dir.join(relative));
    let has_file = |relative: &str| is_file(&dir.join(relative));
    // no-tests, C#, make, python3, R, maven, ant, in tmc-langs' order.
    declares_no_tests(dir)
        || has_csharp_sources(dir)
        || (has_dir("src") && has_file("Makefile"))
        || has("setup.py")
        || has("requirements.txt")
        || has("test/__init__.py")
        || has("tmc/__main__.py")
        || has("R")
        || has("tests/testthat")
        || has("pom.xml")
        || has_file("build.xml")
        || (has_dir("test") && has_dir("src"))
}

fn declares_no_tests(dir: &Path) -> bool {
    match read_tmcproject_yml(dir) {
        Ok(Some(config)) => match config.get("no-tests") {
            Some(Value::Bool(flag)) => *flag,
            Some(Value::Object(_)) => true,
            _ => false,
        },
        _ => false,
    }
}

fn has_csharp_sources(dir: &Path) -> bool {
    let src = dir.join("src");
    is_dir(&src)
        && WalkDir::new(src)
            .max_depth(2)
            .into_iter()
            .filter_map(Result::ok)
            .any(|entry| {
                matches!(
                    entry.path().extension().and_then(|e| e.to_str()),
                    Some("cs" | "csproj")
                )
            })
}

fn exists(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok()
}

fn is_dir(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok_and(|m| m.is_dir())
}

fn is_file(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok_and(|m| m.is_file())
}

/// Reads the directory's `.tmcproject.yml` if it is a regular file. A symlink could point at any
/// file on the server, whose contents would then end up in a downloadable archive.
fn read_tmcproject_yml(dir: &Path) -> anyhow::Result<Option<Map<String, Value>>> {
    let path = dir.join(TMCPROJECT_YML);
    if !is_file(&path) {
        return Ok(None);
    }
    let contents = fs::read_to_string(&path)?;
    let config: Option<Map<String, Value>> =
        serde_saphyr::from_str(&contents).with_context(|| format!("Invalid {}", path.display()))?;
    Ok(Some(config.unwrap_or_default()))
}

/// The exercise's settings over the root's. A list the exercise leaves empty is taken from the
/// root, as tmc-langs merges them.
fn merge_tmcproject_configs(
    mut exercise: Map<String, Value>,
    root: &Map<String, Value>,
) -> Map<String, Value> {
    for (key, root_value) in root {
        let exercise_value = exercise.get(key);
        let take_root = match exercise_value {
            None | Some(Value::Null) => true,
            Some(Value::Array(items)) => items.is_empty(),
            Some(_) => false,
        };
        if take_root {
            exercise.insert(key.clone(), root_value.clone());
        }
    }
    exercise
}

fn write_merged_tmcproject_yml(
    exercise_dir: &Path,
    root_config: &Map<String, Value>,
) -> anyhow::Result<()> {
    let exercise_config = read_tmcproject_yml(exercise_dir)?.unwrap_or_default();
    let merged = merge_tmcproject_configs(exercise_config, root_config);
    let path = exercise_dir.join(TMCPROJECT_YML);
    // Removed first so that writing replaces a symlink instead of writing through it.
    if exists(&path) {
        if is_dir(&path) {
            anyhow::bail!("{} is a directory", path.display());
        }
        fs::remove_file(&path)?;
    }
    fs::write(&path, serde_saphyr::to_string(&merged)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(root: &Path, relative: &str, contents: &str) {
        let path = root.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    async fn found(root: &Path) -> Vec<(String, String)> {
        let mut found: Vec<_> = find_exercises(root)
            .await
            .unwrap()
            .into_iter()
            .map(|e| (e.part, e.name))
            .collect();
        found.sort();
        found
    }

    fn pair(part: &str, name: &str) -> (String, String) {
        (part.to_string(), name.to_string())
    }

    #[tokio::test]
    async fn keeps_the_part_name_and_checksum_of_two_level_layouts() {
        let repo = tempfile::tempdir().unwrap();
        write(repo.path(), "part01/01_exercise/src/main.py", "1234");
        write(repo.path(), "part01/01_exercise/test/__init__.py", "");
        let exercise_dir = repo.path().join("part01/01_exercise");
        let checksum_before = folder_checksum::hash_folder(&exercise_dir).await.unwrap();

        let exercises = find_exercises(repo.path()).await.unwrap();

        assert_eq!(exercises.len(), 1);
        assert_eq!(exercises[0].part, "part01");
        assert_eq!(exercises[0].name, "01_exercise");
        assert_eq!(exercises[0].path, exercise_dir);
        assert_eq!(exercises[0].checksum, checksum_before);
    }

    #[tokio::test]
    async fn finds_exercises_at_any_depth_by_plugin_rules() {
        let repo = tempfile::tempdir().unwrap();
        let root = repo.path();
        write(root, "osa01/python/setup.py", "");
        write(root, "deep/er/still/maven/pom.xml", "");
        write(root, "top_level_make/Makefile", "");
        fs::create_dir_all(root.join("top_level_make/src")).unwrap();
        write(root, "csharp/ex/src/Program.cs", "");
        write(root, "r/ex/R/main.R", "");
        write(
            root,
            "notests/ex/.tmcproject.yml",
            "no-tests:\n  points: [1, two]\n",
        );
        write(root, "ant/ex/build.xml", "");
        write(root, "not/an/exercise/README.md", "");

        assert_eq!(
            found(root).await,
            vec![
                pair("", "top_level_make"),
                pair("ant", "ex"),
                pair("csharp", "ex"),
                pair("deep-er-still", "maven"),
                pair("notests", "ex"),
                pair("osa01", "python"),
                pair("r", "ex"),
            ]
        );
    }

    #[tokio::test]
    async fn skips_hidden_private_and_ignored_dirs_and_does_not_descend_into_exercises() {
        let repo = tempfile::tempdir().unwrap();
        let root = repo.path();
        write(root, ".git/part/ex/setup.py", "");
        write(root, "private/ex/setup.py", "");
        write(root, "part/ignored/.tmcignore", "");
        write(root, "part/ignored/ex/setup.py", "");
        write(root, "part/outer/setup.py", "");
        write(root, "part/outer/inner/setup.py", "");

        assert_eq!(found(root).await, vec![pair("part", "outer")]);
    }

    #[tokio::test]
    async fn merges_the_root_tmcproject_yml_into_each_exercise() {
        let repo = tempfile::tempdir().unwrap();
        let root = repo.path();
        write(
            root,
            ".tmcproject.yml",
            "sandbox_image: root-image\ntests_timeout_ms: 1000\nextra_student_files: [a]\n",
        );
        write(root, "part/with_own/setup.py", "");
        write(
            root,
            "part/with_own/.tmcproject.yml",
            "tests_timeout_ms: 5000\nextra_student_files: []\n",
        );
        write(root, "part/without_own/setup.py", "");

        let exercises = find_exercises(root).await.unwrap();
        assert_eq!(exercises.len(), 2);

        let with_own = read_tmcproject_yml(&root.join("part/with_own"))
            .unwrap()
            .unwrap();
        assert_eq!(with_own["sandbox_image"], "root-image");
        assert_eq!(with_own["tests_timeout_ms"], 5000);
        assert_eq!(with_own["extra_student_files"], serde_json::json!(["a"]));
        let without_own = read_tmcproject_yml(&root.join("part/without_own"))
            .unwrap()
            .unwrap();
        assert_eq!(without_own["tests_timeout_ms"], 1000);
    }

    #[tokio::test]
    async fn a_symlinked_tmcproject_yml_is_replaced_not_followed() {
        let repo = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let root = repo.path();
        write(outside.path(), "secret", "secret: value\n");
        write(root, ".tmcproject.yml", "sandbox_image: root-image\n");
        write(root, "part/ex/setup.py", "");
        std::os::unix::fs::symlink(
            outside.path().join("secret"),
            root.join("part/ex/.tmcproject.yml"),
        )
        .unwrap();

        find_exercises(root).await.unwrap();

        let merged = fs::read_to_string(root.join("part/ex/.tmcproject.yml")).unwrap();
        assert!(!merged.contains("secret"), "{merged}");
        assert_eq!(
            fs::read_to_string(outside.path().join("secret")).unwrap(),
            "secret: value\n"
        );
    }

    #[tokio::test]
    async fn refuses_two_exercises_with_the_same_name() {
        let repo = tempfile::tempdir().unwrap();
        write(repo.path(), "a-b/ex/setup.py", "");
        write(repo.path(), "a/b/ex/setup.py", "");
        assert!(find_exercises(repo.path()).await.is_err());
    }
}
