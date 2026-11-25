//! How far the course created from a course design plan is, and the automatic tasks that follow it.

use headless_lms_utils::strings::{decode_html_entities, strip_html_tags};
use serde_json::Value;
use utoipa::ToSchema;

use crate::{
    course_designer_plans::CourseDesignerAutomaticCheck,
    library::content_management::TEMPLATE_PLACEHOLDER_TEXTS, prelude::*,
};

/// The `className` that marks a block as an AI-drafted outline the teacher has not replaced yet.
/// A page holding one counts as unfilled until the block is deleted.
pub const AI_OUTLINE_CLASS_NAME: &str = "course-plan-ai-outline";

const PAGE_TITLE_BLOCKS: [&str; 2] = ["moocfi/hero-section", "moocfi/landing-page-hero-section"];

/// Why a page of the course does not count as written yet. When several apply, the first in
/// declaration order is reported.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CourseDesignerUnfilledPageReason {
    /// Nothing but the page title (hero section).
    Empty,
    /// Text the default templates hold for the teacher to replace.
    PlaceholderText,
    /// The AI outline the course was created with is still on the page.
    AiOutline,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]
pub struct CourseDesignerUnfilledPage {
    pub page_id: Uuid,
    pub title: String,
    pub url_path: String,
    /// `None` for the front page and other top-level pages.
    pub chapter_id: Option<Uuid>,
    pub reason: CourseDesignerUnfilledPageReason,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]
pub struct CourseDesignerChapterWithoutExercises {
    pub chapter_id: Uuid,
    pub name: String,
    pub chapter_number: i32,
}

/// The state of a plan's course that the plan pages and automatic tasks show. Hidden pages are
/// left out.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]
pub struct CourseDesignerCourseStatus {
    pub course_id: Uuid,
    pub name: String,
    pub slug: String,
    pub is_draft: bool,
    pub chapter_count: i64,
    pub page_count: i64,
    /// In course order: top-level pages first, then chapter by chapter.
    pub unfilled_pages: Vec<CourseDesignerUnfilledPage>,
    pub chapters_without_exercises: Vec<CourseDesignerChapterWithoutExercises>,
}

impl CourseDesignerCourseStatus {
    /// Whether an automatic task with `check` is done for this course.
    pub fn passes(&self, check: CourseDesignerAutomaticCheck) -> bool {
        match check {
            CourseDesignerAutomaticCheck::ContentFilled => self.unfilled_pages.is_empty(),
            CourseDesignerAutomaticCheck::ExercisesExist => {
                self.chapter_count > 0 && self.chapters_without_exercises.is_empty()
            }
            CourseDesignerAutomaticCheck::CoursePublished => !self.is_draft,
        }
    }
}

/// Whether an automatic task with `check` is done; never before the plan has a course.
pub fn is_check_passed(
    course_status: Option<&CourseDesignerCourseStatus>,
    check: CourseDesignerAutomaticCheck,
) -> bool {
    course_status.is_some_and(|status| status.passes(check))
}

/// The status of the course a plan created, or `None` when it has none or the course was deleted.
/// Callers check access to the plan themselves.
pub async fn get_for_plan(
    conn: &mut PgConnection,
    plan_id: Uuid,
) -> ModelResult<Option<CourseDesignerCourseStatus>> {
    let course = sqlx::query!(
        r#"
SELECT c.id,
  c.name,
  c.slug,
  c.is_draft
FROM course_designer_plans p
JOIN courses c ON c.id = p.created_course_id
  AND c.deleted_at IS NULL
WHERE p.id = $1
"#,
        plan_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    let Some(course) = course else {
        return Ok(None);
    };
    let pages = sqlx::query!(
        r#"
SELECT p.id,
  p.title,
  p.url_path,
  p.chapter_id,
  p.content
FROM pages p
LEFT JOIN chapters ch ON ch.id = p.chapter_id
WHERE p.course_id = $1
  AND p.deleted_at IS NULL
  AND NOT p.hidden
ORDER BY ch.chapter_number NULLS FIRST,
  p.order_number,
  p.id
"#,
        course.id
    )
    .fetch_all(&mut *conn)
    .await?;
    let chapter_count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*)::BIGINT AS "count!"
FROM chapters
WHERE course_id = $1
  AND deleted_at IS NULL
"#,
        course.id
    )
    .fetch_one(&mut *conn)
    .await?;
    let chapters_without_exercises = sqlx::query_as!(
        CourseDesignerChapterWithoutExercises,
        r#"
SELECT ch.id AS chapter_id,
  ch.name,
  ch.chapter_number
FROM chapters ch
WHERE ch.course_id = $1
  AND ch.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM exercises e
    WHERE e.chapter_id = ch.id
      AND e.deleted_at IS NULL
  )
ORDER BY ch.chapter_number
"#,
        course.id
    )
    .fetch_all(&mut *conn)
    .await?;

    let page_count = pages.len() as i64;
    let unfilled_pages = pages
        .into_iter()
        .filter_map(|page| {
            unfilled_reason(&page.content).map(|reason| CourseDesignerUnfilledPage {
                page_id: page.id,
                title: page.title,
                url_path: page.url_path,
                chapter_id: page.chapter_id,
                reason,
            })
        })
        .collect();
    Ok(Some(CourseDesignerCourseStatus {
        course_id: course.id,
        name: course.name,
        slug: course.slug,
        is_draft: course.is_draft,
        chapter_count,
        page_count,
        unfilled_pages,
        chapters_without_exercises,
    }))
}

/// Walks stored page content as JSON so that content an older block version wrote cannot make the
/// status fail to load.
fn unfilled_reason(content: &Value) -> Option<CourseDesignerUnfilledPageReason> {
    let blocks = content.as_array().map(Vec::as_slice).unwrap_or_default();
    let has_body = blocks.iter().any(|block| {
        block
            .get("name")
            .and_then(Value::as_str)
            .is_none_or(|name| !PAGE_TITLE_BLOCKS.contains(&name))
    });
    if !has_body {
        return Some(CourseDesignerUnfilledPageReason::Empty);
    }
    let mut has_placeholder = false;
    let mut has_ai_outline = false;
    visit_blocks(blocks, &mut |block| {
        let Some(attributes) = block.get("attributes").and_then(Value::as_object) else {
            return;
        };
        has_ai_outline |= attributes
            .get("className")
            .and_then(Value::as_str)
            .is_some_and(|class_name| {
                class_name
                    .split_whitespace()
                    .any(|c| c == AI_OUTLINE_CLASS_NAME)
            });
        has_placeholder |= attributes.values().filter_map(Value::as_str).any(|text| {
            let text = strip_html_tags(text);
            let text = decode_html_entities(&text);
            TEMPLATE_PLACEHOLDER_TEXTS.contains(&text.trim())
        });
    });
    if has_placeholder {
        Some(CourseDesignerUnfilledPageReason::PlaceholderText)
    } else if has_ai_outline {
        Some(CourseDesignerUnfilledPageReason::AiOutline)
    } else {
        None
    }
}

fn visit_blocks(blocks: &[Value], visit: &mut dyn FnMut(&Value)) {
    for block in blocks {
        visit(block);
        if let Some(inner_blocks) = block.get("innerBlocks").and_then(Value::as_array) {
            visit_blocks(inner_blocks, visit);
        }
    }
}
