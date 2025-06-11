use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseTaskInfo {
    pub assignment: serde_json::Value,
    pub public_spec: Option<PublicSpec>,
    pub model_solution_spec: Option<ModelSolutionSpec>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "lowercase")]
pub enum PublicSpec {
    Browser {
        files: Vec<ExerciseFile>,
    },
    Editor {
        archive_name: String,
        archive_download_url: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseFile {
    filepath: String,
    contents: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "lowercase")]
pub enum ModelSolutionSpec {
    Browser {
        files: Vec<ExerciseFile>,
    },
    Editor {
        archive_name: String,
        archive_download_url: String,
    },
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn deserializes_browser_public_spec() {
        let browser_task = r#"
{
    "type": "browser",
    "files": [
        {
            "filepath": "1",
            "contents": "2"
        },
        {
            "filepath": "3",
            "contents": "4"
        }
    ]
}
"#;
        serde_json::from_str::<PublicSpec>(browser_task).unwrap();
    }

    #[test]
    fn deserializes_editor_public_spec() {
        let editor_task = r#"
{
    "type": "editor",
    "archive_name": "1",
    "archive_download_url": "2"
}
"#;
        serde_json::from_str::<PublicSpec>(editor_task).unwrap();
    }
}
