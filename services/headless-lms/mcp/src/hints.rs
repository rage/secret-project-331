//! Just-in-time hints placed inside structured results. Hints state facts; they never tell the
//! agent to run a command (the skill holds the procedures).

use headless_lms_utils::version::Version;
use serde::Serialize;

use crate::page_readiness::PlaceholderText;
use crate::protocol::context::ClientKind;
use crate::validator::BlockSchemas;

/// The skill version this server is built for.
pub const CURRENT_SKILL_VERSION: Version = Version(0, 5, 0);
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

/// The `skill_version` an agent sends once the teacher has said no to installing the skill.
pub const SKILL_DECLINED: &str = "declined";

/// Why a call is refused over the skill it reports.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SkillRefusal {
    /// The skill is older than [`MINIMUM_SKILL_VERSION`].
    #[error("{0}")]
    Outdated(String),
    /// A call without `skill_version`; see [`skill_missing`].
    #[error("{0}")]
    Missing(String),
}

/// Checks the `skill_version` a call sent against [`CURRENT_SKILL_VERSION`] and
/// [`MINIMUM_SKILL_VERSION`]. No hint means the skill is current or newer. A missing version only
/// gives a hint here; tools that need the skill refuse it with [`skill_missing`].
pub fn skill_version(reported: Option<&str>) -> Result<Option<Hint>, SkillRefusal> {
    check_skill_version(reported, CURRENT_SKILL_VERSION, MINIMUM_SKILL_VERSION)
}

/// The refusal of a call that sent no `skill_version`, written for the agent to relay to the
/// teacher.
pub fn skill_missing() -> SkillRefusal {
    // The install paths mirror the skill repository's SETUP.md.
    SkillRefusal::Missing(format!(
        "Nothing was done: no skill_version was sent, and this server can't be used safely without the course-material skill. \
Ask the teacher whether it is fine to install the skill, and wait for their answer before continuing. \
Tell them what it is: the course-material skill (https://github.com/rage/course-material-agent-skills) gives the agent the editing workflow, \
the safety rules (what needs the teacher's approval, checking pages before publishing) and the formats of course content. \
If the teacher agrees, install it: clone that repository into the user-level skills folder as course-material \
(Claude Code: ~/.claude/skills/course-material, or skills/course-material in $CLAUDE_CONFIG_DIR if it is set; Codex: ~/.agents/skills/course-material), \
read SKILL.md in it, then continue with the teacher's task, sending skill_version from the skill's VERSION file on every call. \
The rest of the setup ({SKILL_SETUP_URL}) isn't needed for the task and can wait until it is done. \
If the teacher says no, send skill_version \"{SKILL_DECLINED}\" on every call from then on; the tools then work without the skill."
    ))
}

fn check_skill_version(
    reported: Option<&str>,
    current: Version,
    minimum: Version,
) -> Result<Option<Hint>, SkillRefusal> {
    let Some(reported) = reported else {
        return Ok(Some(Hint::new(
            HintKind::SkillVersion,
            format!(
                "No skill_version was sent, so course tools are refused until the course-material skill is installed or the teacher declines it. The skill holds the workflow, the safety rules and the content formats; setup: {SKILL_SETUP_URL}"
            ),
        )));
    };
    if reported == SKILL_DECLINED {
        return Ok(Some(Hint::new(
            HintKind::SkillVersion,
            "The teacher declined the course-material skill, so its workflow, safety rules and content formats aren't in use; guide has the block formats.",
        )));
    }
    let Some(reported_version) = Version::parse(reported) else {
        return Ok(Some(Hint::new(
            HintKind::SkillVersion,
            format!(
                "skill_version \"{reported}\" isn't a version number; the current skill is {current}."
            ),
        )));
    };
    if reported_version < minimum {
        return Err(SkillRefusal::Outdated(format!(
            "Skill version {reported} is older than {minimum}, the oldest this server works with (current {current}). Update the skill as its update section describes, re-read SKILL.md, then repeat the call."
        )));
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

/// Changes are staged and wait for publishing. `is_draft`: the course is a draft, which
/// students don't see even after publishing.
pub fn staged(changeset_id: uuid::Uuid, is_draft: bool) -> Hint {
    let text = if is_draft {
        format!(
            "The changes are staged in changeset {changeset_id}. The course is a draft, so students see neither them nor the published course until the teacher takes the course out of draft."
        )
    } else {
        format!(
            "The changes are staged in changeset {changeset_id}; students don't see them until it is published."
        )
    };
    Hint::new(HintKind::State, text)
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

/// The changeset is published. `is_draft` as in [`staged`].
pub fn published(changeset_id: uuid::Uuid, is_draft: bool) -> Hint {
    let text = if is_draft {
        format!(
            "Changeset {changeset_id} is published to the draft course; students see the course once the teacher takes it out of draft."
        )
    } else {
        format!("Changeset {changeset_id} is published; students see the changes now.")
    };
    Hint::new(HintKind::State, text)
}

/// Pages of the open changeset render differently from the published course.
pub fn rendering_changes(page_count: usize, client: ClientKind) -> Hint {
    let tooling = match client {
        ClientKind::ClaudeCode | ClientKind::Codex => "playwright-cli and its skill",
        ClientKind::Other => "a browser tool such as playwright-cli",
    };
    Hint::new(
        HintKind::VisualCheck,
        format!(
            "{page_count} page(s) in the changeset have rendering changes; preview them before publishing. get_preview_link gives one preview URL for the whole changeset to open with {tooling}."
        ),
    )
}

/// Pages a just published changeset changed the rendering of.
pub fn published_rendering_changes(page_count: usize) -> Hint {
    Hint::new(
        HintKind::VisualCheck,
        format!(
            "{page_count} published page(s) have rendering changes; any not previewed before publishing can be checked on the course site."
        ),
    )
}

/// The page still holds placeholder text from a default page template.
pub fn template_placeholders(page_id: uuid::Uuid, placeholders: &[PlaceholderText]) -> Hint {
    let blocks: Vec<String> = placeholders
        .iter()
        .map(|p| {
            format!(
                "{} {} {} \"{}\"",
                p.block_name, p.block, p.attribute, p.text
            )
        })
        .collect();
    Hint::new(
        HintKind::State,
        format!(
            "Page {page_id} still holds placeholder text from the default page template ({}); publish_changeset refuses it until the text is replaced or those blocks are removed.",
            blocks.join("; ")
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

/// Task instructions edited on an exercise students have already answered.
pub fn answered_task_instructions_edited() -> Hint {
    Hint::new(
        HintKind::Consequence,
        "Students have already answered this exercise. Before staging the change, tell the teacher what it means for those earlier answers. Answer options and answer keys are in the task spec, which only the teacher can change, in the exercise editor; a changed question can leave them wrong.",
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
        assert!(missing.text.contains("No skill_version was sent"));
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
            check_skill_version(Some("1.7.0"), Version(1, 6, 0), Version(1, 2, 0))
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
        assert!(too_old.to_string().contains("update section"));
        let declined =
            check_skill_version(Some(SKILL_DECLINED), Version(1, 6, 0), Version(1, 2, 0))
                .unwrap()
                .unwrap();
        assert!(declined.text.contains("declined"));
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
            rendering_changes(2, ClientKind::Codex),
            redirects_created(3),
            needs_teacher_review("https://x/review", 1),
            skill_version(None).unwrap().unwrap(),
            skill_version(Some(SKILL_DECLINED)).unwrap().unwrap(),
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
