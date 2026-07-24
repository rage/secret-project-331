//! The `tmc` exercise service's editor answer shape.
//!
//! A submission's `data_json` is a plugin-owned blob the host normally forwards
//! verbatim, but the client controller is the one place in the host that both writes
//! this tmc shape (`submit_exercise`) and reads the archive URL back out of it
//! (`download_submission`). Owning it in one typed place keeps those two sides in sync
//! with each other and with `EditorUserAnswer` in
//! `services/tmc/src/util/stateInterfaces.ts`.

use serde::{Deserialize, Serialize};

/// Discriminant of the `tmc` plugin's editor answer; serializes as `"editor"`. A
/// browser answer (`"browser"`) deliberately fails to deserialize into [`EditorAnswer`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EditorAnswerType {
    Editor,
}

/// The `tmc` plugin's editor `UserAnswer`
/// (`{ "type": "editor", "archive_download_url": <url> }`). Mirrors
/// `EditorUserAnswer` in `services/tmc/src/util/stateInterfaces.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorAnswer {
    #[serde(rename = "type")]
    pub answer_type: EditorAnswerType,
    pub archive_download_url: String,
}

impl EditorAnswer {
    /// Builds an editor answer for the given uploaded-archive URL.
    pub fn new(archive_download_url: String) -> Self {
        Self {
            answer_type: EditorAnswerType::Editor,
            archive_download_url,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn serializes_to_the_tmc_editor_answer_shape() {
        let value = serde_json::to_value(EditorAnswer::new("https://files/x.tar.zst".to_string()))
            .expect("serializes");
        assert_eq!(
            value,
            json!({ "type": "editor", "archive_download_url": "https://files/x.tar.zst" })
        );
    }

    #[test]
    fn deserializes_an_editor_answer() {
        let answer: EditorAnswer =
            serde_json::from_value(json!({ "type": "editor", "archive_download_url": "u" }))
                .expect("deserializes");
        assert_eq!(answer.archive_download_url, "u");
    }

    #[test]
    fn rejects_a_browser_answer() {
        let result: Result<EditorAnswer, _> = serde_json::from_value(
            json!({ "type": "browser", "files": [{ "filepath": "a", "contents": "b" }] }),
        );
        assert!(result.is_err());
    }
}
