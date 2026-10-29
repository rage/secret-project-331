//! Just-in-time hints placed inside structured results. Hints state facts; they never tell the
//! agent to run a command (the skill holds the procedures).

use headless_lms_utils::version::Version;
use serde::Serialize;

use crate::protocol::context::ClientKind;
use crate::validator::BlockSchemas;

/// The skill version this server is built for.
pub const CURRENT_SKILL_VERSION: Version = Version(0, 0, 0);
/// The oldest skill version this server still works with.
pub const MINIMUM_SKILL_VERSION: Version = Version(0, 0, 0);
/// Where teachers learn to set up the skill.
pub const SKILL_SETUP_URL: &str =
    "https://github.com/rage/course-material-agent-skills/blob/main/SETUP.md";

/// What a [`Hint`] tells the agent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum HintKind {
    FormatTip,
    State,
    Consequence,
    SkillVersion,
    VisualCheck,
}

/// A fact for the agent, placed in the structured result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Hint {
    pub kind: HintKind,
    pub text: String,
}

impl Hint {
    fn new(kind: HintKind, text: impl Into<String>) -> Self {
        Self {
            kind,
            text: text.into(),
        }
    }
}

/// A skill too old to work with this server; the call is rejected.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{message}")]
pub struct OutdatedSkill {
    pub message: String,
}

/// Checks the `skill_version` a call sent against [`CURRENT_SKILL_VERSION`] and
/// [`MINIMUM_SKILL_VERSION`]. No hint means the skill is current.
pub fn skill_version(reported: Option<&str>) -> Result<Option<Hint>, OutdatedSkill> {
    check_skill_version(reported, CURRENT_SKILL_VERSION, MINIMUM_SKILL_VERSION)
}

fn check_skill_version(
    reported: Option<&str>,
    current: Version,
    minimum: Version,
) -> Result<Option<Hint>, OutdatedSkill> {
    let Some(reported) = reported else {
        return Ok(Some(Hint::new(
            HintKind::SkillVersion,
            format!(
                "No skill_version was sent, so the course-material skill seems not to be installed. It documents the workflow and the content formats; setup: {SKILL_SETUP_URL}"
            ),
        )));
    };
    let Some(reported_version) = Version::parse(reported) else {
        return Ok(Some(Hint::new(
            HintKind::SkillVersion,
            format!(
                "skill_version \"{reported}\" isn't a version number; the current skill is {current}."
            ),
        )));
    };
    if reported_version < minimum {
        return Err(OutdatedSkill {
            message: format!(
                "Skill version {reported} is older than {minimum}, the oldest this server works with (current {current}). Update the skill as its update section describes, re-read SKILL.md, then repeat the call."
            ),
        });
    }
    if reported_version < current {
        return Ok(Some(Hint::new(
            HintKind::SkillVersion,
            format!(
                "Skill version {reported}; current {current}; see the skill's update section. An outdated skill can produce corrupted content."
            ),
        )));
    }
    Ok(None)
}

/// Changes are staged and wait for publishing.
pub fn staged(changeset_id: uuid::Uuid) -> Hint {
    Hint::new(
        HintKind::State,
        format!(
            "The changes are staged in changeset {changeset_id}; students don't see them until it is published."
        ),
    )
}

/// Risky changes wait for the teacher on the review page.
pub fn needs_teacher_review(review_url: &str, reason_count: usize) -> Hint {
    Hint::new(
        HintKind::State,
        format!(
            "{reason_count} staged change(s) are risky, so only the teacher can publish this changeset, on the review page: {review_url}"
        ),
    )
}

/// The changeset is published.
pub fn published(changeset_id: uuid::Uuid) -> Hint {
    Hint::new(
        HintKind::State,
        format!("Changeset {changeset_id} is published; students see the changes now."),
    )
}

/// Pages whose rendering changed haven't been checked in a browser.
pub fn not_visually_checked(page_count: usize, client: ClientKind) -> Hint {
    let tooling = match client {
        ClientKind::ClaudeCode | ClientKind::Codex => "playwright-cli and its skill",
        ClientKind::Other => "a browser tool such as playwright-cli",
    };
    Hint::new(
        HintKind::VisualCheck,
        format!(
            "{page_count} staged page(s) with rendering changes haven't been visually checked; checks are expected before a changeset is published. get_preview_link gives a preview URL to open with {tooling}."
        ),
    )
}

/// Moved pages get redirects when the changeset is published.
pub fn redirects_created(count: usize) -> Hint {
    Hint::new(
        HintKind::Consequence,
        format!(
            "{count} page path(s) changed; redirects from the old paths are created automatically when the changeset is published."
        ),
    )
}

/// Links to moved pages keep working through redirects.
pub fn links_to_old_paths(count: usize) -> Hint {
    Hint::new(
        HintKind::Consequence,
        format!(
            "{count} link(s) in course content point at old paths; they keep working through the redirects."
        ),
    )
}

/// Links to paths that other pages now have open those pages instead.
pub fn links_to_reused_paths(count: usize) -> Hint {
    Hint::new(
        HintKind::Consequence,
        format!(
            "{count} link(s) in course content point at old paths that other pages now have, so they will open those pages (now_opens_page in links_to_old_paths). Change them to the new paths if they should still open the moved pages."
        ),
    )
}

/// Copied exercises are new ones without submissions.
pub fn exercises_copied(count: usize) -> Hint {
    Hint::new(
        HintKind::Consequence,
        format!("{count} copied exercise(s) are new exercises with no submissions."),
    )
}

/// Moved blocks keep their ids, so feedback and proposed edits follow them.
pub fn blocks_moved_between_pages(count: usize) -> Hint {
    Hint::new(
        HintKind::Consequence,
        format!(
            "{count} block(s) moved to another page keep their ids; feedback and proposed edits on them follow."
        ),
    )
}

/// Switching an exercise's review config orphans the reviews students have given.
pub fn review_config_switched_with_reviews(review_count: i64) -> Hint {
    Hint::new(
        HintKind::Consequence,
        format!(
            "Students have given {review_count} review(s) on this exercise. After the switch students no longer see those reviews and they no longer match the review questions; the teacher sees this warning on the review page."
        ),
    )
}

/// Removed exercises have student submissions.
pub fn submissions_affected(count: usize) -> Hint {
    Hint::new(
        HintKind::Consequence,
        format!("{count} removed exercise(s) have student submissions."),
    )
}

/// Format facts for the block types in a result, from the CMS schema export. `block_names` are
/// distinct.
pub fn format_tips<'a>(
    block_names: impl IntoIterator<Item = &'a str>,
    schemas: &BlockSchemas,
) -> Vec<Hint> {
    block_names
        .into_iter()
        .filter_map(|name| {
            let schema = schemas.blocks.get(name)?;
            let rich_text: Vec<&str> = schema
                .attributes
                .iter()
                .filter(|(_, s)| {
                    s.get("x-rich-text").and_then(serde_json::Value::as_bool) == Some(true)
                })
                .map(|(attribute, _)| attribute.as_str())
                .collect();
            let mut facts = Vec::new();
            if !rich_text.is_empty() {
                facts.push(format!("rich text in {}", rich_text.join(", ")));
            }
            if let Some(children) = &schema.allowed_children {
                if children.is_empty() {
                    facts.push("no inner blocks".to_string());
                } else {
                    facts.push(format!("inner blocks: {}", children.join(", ")));
                }
            }
            if schema
                .allowed_parents
                .as_ref()
                .is_some_and(|p| p.iter().any(|p| p == "root"))
            {
                facts.push("top level only".to_string());
            }
            (!facts.is_empty()).then(|| {
                Hint::new(
                    HintKind::FormatTip,
                    format!("{name}: {}.", facts.join("; ")),
                )
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_versions() {
        let missing = check_skill_version(None, Version(1, 6, 0), Version(1, 2, 0))
            .unwrap()
            .unwrap();
        assert!(missing.text.contains("not to be installed"));
        let outdated = check_skill_version(Some("1.4.2"), Version(1, 6, 0), Version(1, 2, 0))
            .unwrap()
            .unwrap();
        assert_eq!(
            outdated.text,
            "Skill version 1.4.2; current 1.6.0; see the skill's update section. An outdated skill can produce corrupted content."
        );
        assert!(
            check_skill_version(Some("1.6.0"), Version(1, 6, 0), Version(1, 2, 0))
                .unwrap()
                .is_none()
        );
        assert!(
            check_skill_version(Some("2.0"), Version(1, 6, 0), Version(1, 2, 0))
                .unwrap()
                .is_none()
        );
        let too_old =
            check_skill_version(Some("1.1.9"), Version(1, 6, 0), Version(1, 2, 0)).unwrap_err();
        assert!(too_old.message.contains("update section"));
        for not_a_version in ["banana", "1.3.0-rc1", "1.x", "1.2.3.4"] {
            let hint = check_skill_version(Some(not_a_version), Version(1, 6, 0), Version(1, 2, 0))
                .unwrap()
                .unwrap();
            assert!(
                hint.text.contains("isn't a version number"),
                "{not_a_version}"
            );
        }
        assert!(
            skill_version(Some(&CURRENT_SKILL_VERSION.to_string()))
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn hints_state_facts_not_commands() {
        let hints = [
            not_visually_checked(2, ClientKind::Codex),
            redirects_created(3),
            needs_teacher_review("https://x/review", 1),
            skill_version(None).unwrap().unwrap(),
        ];
        for hint in hints {
            let lower = hint.text.to_lowercase();
            assert!(
                !lower.contains("git pull") && !lower.starts_with("run "),
                "{}",
                hint.text
            );
        }
    }
}
