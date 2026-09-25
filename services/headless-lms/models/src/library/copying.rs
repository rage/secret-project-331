use std::collections::{HashMap, HashSet};

use serde_json::Value;

use crate::ModelResult;
use crate::course_instances;
use crate::course_instances::NewCourseInstance;
use crate::course_language_groups;
use crate::courses::Course;
use crate::courses::CourseAiPolicy;
use crate::courses::NewCourse;
use crate::courses::get_course;
use crate::exams;
use crate::exams::Exam;
use crate::exams::NewExam;
use crate::page_history::{self, HistoryChangeReason, PageHistoryContent};
use crate::pages;
use crate::prelude::*;

pub async fn copy_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_course: &NewCourse,
    same_language_group: bool,
    user_id: Uuid,
) -> ModelResult<Course> {
    let mut tx = conn.begin().await?;
    let parent_course = get_course(&mut tx, course_id).await?;
    let course_language_group_id = if same_language_group {
        parent_course.course_language_group_id
    } else {
        course_language_groups::insert(&mut tx, PKeyPolicy::Generate, &new_course.slug).await?
    };

    let copied_course = copy_course_with_language_group(
        &mut tx,
        course_id,
        course_language_group_id,
        new_course,
        user_id,
    )
    .await?;

    tx.commit().await?;

    Ok(copied_course)
}

pub async fn copy_course_with_language_group(
    conn: &mut PgConnection,
    src_course_id: Uuid,
    target_clg_id: Uuid,
    new_course: &NewCourse,
    user_id: Uuid,
) -> ModelResult<Course> {
    let parent_course = get_course(conn, src_course_id).await?;
    let same_clg = target_clg_id == parent_course.course_language_group_id;
    let description = if new_course.description.trim().is_empty() {
        parent_course.description.clone()
    } else {
        Some(new_course.description.clone())
    };

    let mut tx = conn.begin().await?;

    let copied_course = sqlx::query_as!(
        Course,
        r#"
INSERT INTO courses (
    name,
    organization_id,
    slug,
    content_search_language,
    language_code,
    copied_from,
    course_language_group_id,
    is_draft,
    base_module_completion_requires_n_submodule_completions,
    can_add_chatbot,
    is_unlisted,
    is_joinable_by_code_only,
    join_code,
    ask_marketing_consent,
    description,
    flagged_answers_threshold,
    flagged_answers_skip_manual_review_and_allow_retry,
    cheater_detection_enabled,
    chapter_locking_enabled,
    ai_policy,
    course_material_ai_instructions,
    is_test_mode
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17,
    $18,
    $19,
    $20,
    $21,
    $22
  )
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions,
  can_add_chatbot,
  is_unlisted,
  is_joinable_by_code_only,
  join_code,
  ask_marketing_consent,
  flagged_answers_threshold,
  flagged_answers_skip_manual_review_and_allow_retry,
  closed_at,
  closed_additional_message,
  closed_course_successor_id,
  chapter_locking_enabled,
  cheater_detection_enabled,
  ai_policy,
  course_material_ai_instructions
        "#,
        new_course.name,
        new_course.organization_id,
        new_course.slug,
        parent_course.content_search_language as _,
        new_course.language_code,
        parent_course.id,
        target_clg_id,
        new_course.is_draft,
        parent_course.base_module_completion_requires_n_submodule_completions,
        parent_course.can_add_chatbot,
        new_course.is_unlisted,
        new_course.is_joinable_by_code_only,
        new_course.join_code,
        new_course.ask_marketing_consent,
        description,
        parent_course.flagged_answers_threshold,
        parent_course.flagged_answers_skip_manual_review_and_allow_retry,
        parent_course.cheater_detection_enabled,
        parent_course.chapter_locking_enabled,
        parent_course.ai_policy as CourseAiPolicy,
        parent_course.course_material_ai_instructions,
        new_course.is_test_mode,
    )
    .fetch_one(&mut *tx)
    .await?;

    let mut content_rewrite = ContentRewrite::new(copied_course.id);
    content_rewrite.source_course_id = Some(src_course_id);
    content_rewrite.course_slugs = Some((&parent_course.slug, &new_course.slug));

    content_rewrite.course_module_ids =
        copy_course_modules(&mut tx, copied_course.id, src_course_id).await?;
    copy_course_chapters(&mut tx, copied_course.id, src_course_id).await?;

    if new_course.copy_user_permissions {
        copy_user_permissions(&mut tx, copied_course.id, src_course_id, user_id).await?;
    }

    let page_contents = copy_course_pages_and_return_contents(
        &mut tx,
        copied_course.id,
        src_course_id,
        target_clg_id,
        same_clg,
    )
    .await?;

    set_chapter_front_pages(&mut tx, copied_course.id).await?;

    content_rewrite.exercise_ids = copy_course_exercises(
        &mut tx,
        copied_course.id,
        src_course_id,
        target_clg_id,
        same_clg,
    )
    .await?;

    copy_exercise_slides(&mut tx, copied_course.id, src_course_id).await?;
    copy_exercise_tasks(&mut tx, copied_course.id, src_course_id).await?;

    // We don't copy course instances at the moment because they are not related to the course content, and someone might want to take the content without the instances. We could add an option to copy them in the future.
    let course_instance = course_instances::insert(
        &mut tx,
        PKeyPolicy::Generate,
        NewCourseInstance {
            course_id: copied_course.id,
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: &new_course.teacher_in_charge_name,
            teacher_in_charge_email: &new_course.teacher_in_charge_email,
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;
    content_rewrite.course_instance_id = Some(course_instance.id);

    copy_peer_or_self_review_configs(&mut tx, copied_course.id, src_course_id).await?;
    copy_peer_or_self_review_questions(&mut tx, copied_course.id, src_course_id).await?;
    copy_material_references(&mut tx, copied_course.id, src_course_id).await?;
    copy_glossary_entries(&mut tx, copied_course.id, src_course_id).await?;

    // Copy course configurations and optional content
    copy_certificate_configurations_and_requirements(&mut tx, copied_course.id, src_course_id)
        .await?;
    content_rewrite.chatbot_configuration_ids =
        copy_chatbot_configurations(&mut tx, copied_course.id, src_course_id).await?;
    copy_cheater_thresholds(&mut tx, copied_course.id, src_course_id).await?;
    copy_course_module_suotar_configurations(&mut tx, copied_course.id, src_course_id).await?;
    copy_course_custom_privacy_policy_checkbox_texts(&mut tx, copied_course.id, src_course_id)
        .await?;
    copy_exercise_repositories(&mut tx, copied_course.id, src_course_id).await?;
    copy_partners_blocks(&mut tx, copied_course.id, src_course_id).await?;
    copy_privacy_links(&mut tx, copied_course.id, src_course_id).await?;
    content_rewrite.consent_form_question_ids =
        copy_research_consent_forms_and_questions(&mut tx, copied_course.id, src_course_id).await?;
    copy_email_templates(&mut tx, copied_course.id, src_course_id).await?;
    content_rewrite.code_giveaway_ids =
        copy_code_giveaways(&mut tx, copied_course.id, src_course_id).await?;
    copy_page_audio_files(&mut tx, copied_course.id, src_course_id).await?;

    let copied_page_ids = page_contents.keys().copied().collect::<Vec<_>>();
    rewrite_page_contents(&mut tx, page_contents, &content_rewrite).await?;
    rewrite_course_texts(&mut tx, copied_course.id, &content_rewrite).await?;
    insert_page_history_for_copies(&mut tx, &copied_page_ids, user_id).await?;

    tx.commit().await?;

    Ok(copied_course)
}

pub async fn copy_exam(
    conn: &mut PgConnection,
    parent_exam_id: &Uuid,
    new_exam: &NewExam,
    user_id: Uuid,
) -> ModelResult<Exam> {
    let mut tx = conn.begin().await?;
    let copied_exam = copy_exam_content(&mut tx, parent_exam_id, new_exam, None, user_id).await?;
    tx.commit().await?;
    Ok(copied_exam)
}

async fn copy_exam_content(
    tx: &mut PgConnection,
    parent_exam_id: &Uuid,
    new_exam: &NewExam,
    new_exam_id: Option<Uuid>,
    user_id: Uuid,
) -> ModelResult<Exam> {
    let parent_exam = exams::get(tx, *parent_exam_id).await?;

    let parent_exam_fields = sqlx::query!(
        "
SELECT *
FROM exams
WHERE id = $1
        ",
        parent_exam.id
    )
    .fetch_one(&mut *tx)
    .await?;

    let final_exam_id = new_exam_id.unwrap_or_else(Uuid::new_v4);

    // create new exam
    let copied_exam = sqlx::query!(
        "
INSERT INTO exams(
    id,
    name,
    organization_id,
    instructions,
    starts_at,
    ends_at,
    language,
    time_minutes,
    minimum_points_treshold,
    grade_manually
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
        ",
        final_exam_id,
        new_exam.name,
        parent_exam_fields.organization_id,
        parent_exam.instructions,
        new_exam.starts_at,
        new_exam.ends_at,
        parent_exam_fields.language,
        new_exam.time_minutes,
        new_exam.minimum_points_treshold,
        new_exam.grade_manually,
    )
    .fetch_one(&mut *tx)
    .await?;

    let page_contents =
        copy_exam_pages_and_return_contents(&mut *tx, copied_exam.id, parent_exam.id).await?;

    let mut content_rewrite = ContentRewrite::new(copied_exam.id);
    content_rewrite.exercise_ids =
        copy_exam_exercises(&mut *tx, copied_exam.id, parent_exam.id).await?;

    copy_exercise_slides(&mut *tx, copied_exam.id, parent_exam.id).await?;
    copy_exercise_tasks(&mut *tx, copied_exam.id, parent_exam.id).await?;
    copy_page_audio_files(&mut *tx, copied_exam.id, parent_exam.id).await?;

    let copied_page_ids = page_contents.keys().copied().collect::<Vec<_>>();
    rewrite_page_contents(&mut *tx, page_contents, &content_rewrite).await?;
    insert_page_history_for_copies(&mut *tx, &copied_page_ids, user_id).await?;

    let get_page_id = sqlx::query!("SELECT id FROM pages WHERE exam_id = $1;", copied_exam.id)
        .fetch_one(&mut *tx)
        .await?;

    Ok(Exam {
        courses: vec![], // no related courses on newly copied exam
        ends_at: copied_exam.ends_at,
        starts_at: copied_exam.starts_at,
        id: copied_exam.id,
        instructions: copied_exam.instructions,
        name: copied_exam.name,
        time_minutes: copied_exam.time_minutes,
        page_id: get_page_id.id,
        minimum_points_treshold: copied_exam.minimum_points_treshold,
        language: copied_exam
            .language
            .unwrap_or_else(|| parent_exam_fields.language.unwrap_or("en-US".to_string())),
        grade_manually: copied_exam.grade_manually,
    })
}

/// Points references inside copied block content at the copy.
///
/// Every copied row's id is `uuid_generate_v5(namespace_id, source_id)`; the id sets hold the ids of
/// the rows that were actually copied, so references to anything left behind can be told apart.
struct ContentRewrite<'a> {
    namespace_id: Uuid,
    source_course_id: Option<Uuid>,
    course_instance_id: Option<Uuid>,
    /// `(source slug, copy slug)`.
    course_slugs: Option<(&'a str, &'a str)>,
    exercise_ids: HashSet<Uuid>,
    chatbot_configuration_ids: HashSet<Uuid>,
    course_module_ids: HashSet<Uuid>,
    code_giveaway_ids: HashSet<Uuid>,
    consent_form_question_ids: HashSet<Uuid>,
}

impl<'a> ContentRewrite<'a> {
    fn new(namespace_id: Uuid) -> Self {
        Self {
            namespace_id,
            source_course_id: None,
            course_instance_id: None,
            course_slugs: None,
            exercise_ids: HashSet::new(),
            chatbot_configuration_ids: HashSet::new(),
            course_module_ids: HashSet::new(),
            code_giveaway_ids: HashSet::new(),
            consent_form_question_ids: HashSet::new(),
        }
    }

    /// The copy of the row `source_id` names, if that row was copied into `copied_ids`.
    fn copy_of(&self, copied_ids: &HashSet<Uuid>, source_id: &Value) -> Option<Value> {
        let source_id = Uuid::parse_str(source_id.as_str()?).ok()?;
        let copied_id = Uuid::new_v5(&self.namespace_id, source_id.to_string().as_bytes());
        copied_ids
            .contains(&copied_id)
            .then(|| Value::String(copied_id.to_string()))
    }

    fn rewrite_content(&self, content: &Value) -> Value {
        match content {
            Value::Array(blocks) => Value::Array(self.rewrite_blocks(blocks.clone())),
            other => other.clone(),
        }
    }

    fn rewrite_blocks(&self, blocks: Vec<Value>) -> Vec<Value> {
        blocks
            .into_iter()
            .filter_map(|block| self.rewrite_block(block))
            .collect()
    }

    /// `None` drops the block.
    fn rewrite_block(&self, mut block: Value) -> Option<Value> {
        let name = block["name"].as_str().unwrap_or_default().to_string();
        if name == "moocfi/research-consent-question"
            && let Some(copied_id) =
                self.copy_of(&self.consent_form_question_ids, &block["clientId"])
        {
            block["clientId"] = copied_id;
        }
        if let Some(attributes) = block.get_mut("attributes").and_then(Value::as_object_mut) {
            match name.as_str() {
                // The exercise was left behind, so the block could only render as broken.
                "moocfi/exercise" => {
                    if let Some(source_id) = attributes.get("id").filter(|id| id.is_string()) {
                        let copied_id = self.copy_of(&self.exercise_ids, source_id)?;
                        attributes.insert("id".to_string(), copied_id);
                    }
                }
                "moocfi/chatbot" => {
                    if let Some(copied_id) = attributes
                        .get("chatbotConfigurationId")
                        .and_then(|id| self.copy_of(&self.chatbot_configuration_ids, id))
                    {
                        attributes.insert("chatbotConfigurationId".to_string(), copied_id);
                    }
                    if let Some(source_course_id) = self.source_course_id
                        && attributes.get("courseId").and_then(Value::as_str)
                            == Some(source_course_id.to_string().as_str())
                    {
                        attributes.insert(
                            "courseId".to_string(),
                            Value::String(self.namespace_id.to_string()),
                        );
                    }
                }
                "moocfi/conditional-block" => {
                    if let Some(Value::Array(module_ids)) = attributes.get_mut("module_completion")
                    {
                        for module_id in module_ids.iter_mut() {
                            if let Some(copied_id) =
                                self.copy_of(&self.course_module_ids, module_id)
                            {
                                *module_id = copied_id;
                            }
                        }
                    }
                    // Instances are not copied. Requiring the copy's instance keeps the content
                    // gated and shows the condition in the editor, where a source id would not.
                    if let Some(course_instance_id) = self.course_instance_id
                        && let Some(Value::Array(instance_ids)) =
                            attributes.get_mut("instance_enrollment")
                        && !instance_ids.is_empty()
                    {
                        *instance_ids = vec![Value::String(course_instance_id.to_string())];
                    }
                }
                "moocfi/code-giveaway" => {
                    if let Some(copied_id) = attributes
                        .get("code_giveaway_id")
                        .and_then(|id| self.copy_of(&self.code_giveaway_ids, id))
                    {
                        attributes.insert("code_giveaway_id".to_string(), copied_id);
                    }
                }
                _ => {}
            }
            if let Some((source_slug, copy_slug)) = self.course_slugs {
                for (key, value) in attributes.iter_mut() {
                    rewrite_course_links(value, Some(key), source_slug, copy_slug);
                }
            }
        }
        if let Some(Value::Array(inner_blocks)) = block.get_mut("innerBlocks") {
            *inner_blocks = self.rewrite_blocks(std::mem::take(inner_blocks));
        }
        Some(block)
    }
}

/// Rewrites `/courses/<source_slug>` link targets in `value`: whole `url`/`href` attributes, and
/// `href` values inside HTML strings. Visible text is left alone.
fn rewrite_course_links(value: &mut Value, key: Option<&str>, source_slug: &str, copy_slug: &str) {
    match value {
        Value::String(text) => {
            if !text.contains(&format!("/courses/{source_slug}")) {
                return;
            }
            *text = if matches!(key, Some("url" | "href")) {
                rewrite_course_path(text, source_slug, copy_slug)
            } else {
                rewrite_html_hrefs(text, source_slug, copy_slug)
            };
        }
        Value::Array(items) => {
            for item in items {
                rewrite_course_links(item, None, source_slug, copy_slug);
            }
        }
        Value::Object(fields) => {
            for (field_key, field_value) in fields.iter_mut() {
                rewrite_course_links(field_value, Some(field_key), source_slug, copy_slug);
            }
        }
        _ => {}
    }
}

fn rewrite_html_hrefs(html: &str, source_slug: &str, copy_slug: &str) -> String {
    let mut rewritten = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(attribute_start) = rest.find("href=") {
        let quote_start = attribute_start + "href=".len();
        let Some(quote) = rest[quote_start..]
            .chars()
            .next()
            .filter(|c| matches!(c, '"' | '\''))
        else {
            rewritten.push_str(&rest[..quote_start]);
            rest = &rest[quote_start..];
            continue;
        };
        let target_start = quote_start + quote.len_utf8();
        let Some(target_len) = rest[target_start..].find(quote) else {
            break;
        };
        let target_end = target_start + target_len;
        rewritten.push_str(&rest[..target_start]);
        rewritten.push_str(&rewrite_course_path(
            &rest[target_start..target_end],
            source_slug,
            copy_slug,
        ));
        rest = &rest[target_end..];
    }
    rewritten.push_str(rest);
    rewritten
}

fn rewrite_course_path(target: &str, source_slug: &str, copy_slug: &str) -> String {
    let source_path = format!("/courses/{source_slug}");
    let mut rewritten = String::with_capacity(target.len());
    let mut rest = target;
    while let Some(path_start) = rest.find(&source_path) {
        let path_end = path_start + source_path.len();
        let ends_at_slug = rest[path_end..]
            .chars()
            .next()
            .is_none_or(|c| matches!(c, '/' | '?' | '#' | '"'));
        rewritten.push_str(&rest[..path_start]);
        if ends_at_slug {
            rewritten.push_str("/courses/");
            rewritten.push_str(copy_slug);
        } else {
            rewritten.push_str(&source_path);
        }
        rest = &rest[path_end..];
    }
    rewritten.push_str(rest);
    rewritten
}

async fn rewrite_page_contents(
    tx: &mut PgConnection,
    page_contents: HashMap<Uuid, Value>,
    content_rewrite: &ContentRewrite<'_>,
) -> ModelResult<()> {
    for (page_id, content) in page_contents {
        let rewritten = content_rewrite.rewrite_content(&content);
        if rewritten == content {
            continue;
        }
        sqlx::query!(
            "
UPDATE pages
SET content = $1
WHERE id = $2;
            ",
            rewritten,
            page_id
        )
        .execute(&mut *tx)
        .await?;
    }
    Ok(())
}

/// Applies `content_rewrite` to the copied course's block content and links outside pages.
async fn rewrite_course_texts(
    tx: &mut PgConnection,
    course_id: Uuid,
    content_rewrite: &ContentRewrite<'_>,
) -> ModelResult<()> {
    let assignments = sqlx::query!(
        "
SELECT t.id,
  t.assignment
FROM exercise_tasks t
  JOIN exercise_slides s ON s.id = t.exercise_slide_id
  JOIN exercises e ON e.id = s.exercise_id
WHERE e.course_id = $1
  AND t.deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(&mut *tx)
    .await?;
    for task in assignments {
        let rewritten = content_rewrite.rewrite_content(&task.assignment);
        if rewritten != task.assignment {
            sqlx::query!(
                "UPDATE exercise_tasks SET assignment = $1 WHERE id = $2;",
                rewritten,
                task.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let review_instructions = sqlx::query!(
        "
SELECT id,
  review_instructions
FROM peer_or_self_review_configs
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(&mut *tx)
    .await?;
    for config in review_instructions {
        let Some(instructions) = config.review_instructions else {
            continue;
        };
        let rewritten = content_rewrite.rewrite_content(&instructions);
        if rewritten != instructions {
            sqlx::query!(
                "UPDATE peer_or_self_review_configs SET review_instructions = $1 WHERE id = $2;",
                rewritten,
                config.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let research_forms = sqlx::query!(
        "
SELECT id,
  content
FROM course_specific_research_consent_forms
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(&mut *tx)
    .await?;
    for form in research_forms {
        let rewritten = content_rewrite.rewrite_content(&form.content);
        if rewritten != form.content {
            sqlx::query!(
                "UPDATE course_specific_research_consent_forms SET content = $1 WHERE id = $2;",
                rewritten,
                form.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let email_templates = sqlx::query!(
        "
SELECT id,
  content
FROM email_templates
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(&mut *tx)
    .await?;
    for template in email_templates {
        let Some(content) = template.content else {
            continue;
        };
        let rewritten = content_rewrite.rewrite_content(&content);
        if rewritten != content {
            sqlx::query!(
                "UPDATE email_templates SET content = $1 WHERE id = $2;",
                rewritten,
                template.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let partners_blocks = sqlx::query!(
        "
SELECT id,
  content
FROM partners_blocks
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(&mut *tx)
    .await?;
    for partners_block in partners_blocks {
        let Some(content) = partners_block.content else {
            continue;
        };
        let rewritten = content_rewrite.rewrite_content(&content);
        if rewritten != content {
            sqlx::query!(
                "UPDATE partners_blocks SET content = $1 WHERE id = $2;",
                rewritten,
                partners_block.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let Some((source_slug, copy_slug)) = content_rewrite.course_slugs else {
        return Ok(());
    };

    let checkbox_texts = sqlx::query!(
        "
SELECT id,
  text_html
FROM course_custom_privacy_policy_checkbox_texts
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(&mut *tx)
    .await?;
    for checkbox_text in checkbox_texts {
        let rewritten = rewrite_html_hrefs(&checkbox_text.text_html, source_slug, copy_slug);
        if rewritten != checkbox_text.text_html {
            sqlx::query!(
                "UPDATE course_custom_privacy_policy_checkbox_texts SET text_html = $1 WHERE id = $2;",
                rewritten,
                checkbox_text.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let privacy_links = sqlx::query!(
        "
SELECT id,
  url
FROM privacy_links
WHERE course_id = $1
  AND deleted_at IS NULL;
        ",
        course_id
    )
    .fetch_all(&mut *tx)
    .await?;
    for privacy_link in privacy_links {
        let rewritten = rewrite_course_path(&privacy_link.url, source_slug, copy_slug);
        if rewritten != privacy_link.url {
            sqlx::query!(
                "UPDATE privacy_links SET url = $1 WHERE id = $2;",
                rewritten,
                privacy_link.id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    Ok(())
}

/// Records each copied page's final state as its first history entry, as saving it in the CMS
/// would. The chatbot syncer only indexes pages that have one.
async fn insert_page_history_for_copies(
    tx: &mut PgConnection,
    page_ids: &[Uuid],
    author_user_id: Uuid,
) -> ModelResult<()> {
    for page_id in page_ids {
        let page = pages::get_page_with_exercises(&mut *tx, *page_id).await?;
        page_history::insert(
            &mut *tx,
            PKeyPolicy::Generate,
            page.page.id,
            &page.page.title,
            &PageHistoryContent {
                content: page.page.content,
                exercises: page.exercises,
                exercise_slides: page.exercise_slides,
                exercise_tasks: page.exercise_tasks,
                peer_or_self_review_configs: page.peer_or_self_review_configs,
                peer_or_self_review_questions: page.peer_or_self_review_questions,
            },
            HistoryChangeReason::PageSaved,
            author_user_id,
            None,
        )
        .await?;
    }
    Ok(())
}

/// Skips pages of deleted chapters: chapter deletion once left the pages in place.
async fn copy_course_pages_and_return_contents(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_course_id: Uuid,
    target_clg_id: Uuid,
    same_clg: bool,
) -> ModelResult<HashMap<Uuid, Value>> {
    // Copy course pages. At this point, exercise ids in content will point to old course's exercises.
    let contents = sqlx::query!(
        "
WITH src AS (
  SELECT p.*,
    CASE
      WHEN $4 THEN p.page_language_group_id
      ELSE uuid_generate_v5($3, p.page_language_group_id::text)
    END AS tgt_plg_id
  FROM pages p
  WHERE p.course_id = $2
    AND p.deleted_at IS NULL
    AND (
      p.chapter_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM chapters c
        WHERE c.id = uuid_generate_v5($1, p.chapter_id::text)
      )
    )
),
ins_plg AS (
  INSERT INTO page_language_groups (id, course_language_group_id)
  SELECT DISTINCT tgt_plg_id,
    $3
  FROM src
  WHERE NOT $4
    AND tgt_plg_id IS NOT NULL ON CONFLICT (id) DO NOTHING
)
INSERT INTO pages (
    id,
    course_id,
    content,
    url_path,
    title,
    chapter_id,
    order_number,
    copied_from,
    content_search_language,
    page_language_group_id,
    hidden
  )
SELECT uuid_generate_v5($1, src.id::text),
  $1,
  src.content,
  src.url_path,
  src.title,
  uuid_generate_v5($1, src.chapter_id::text),
  src.order_number,
  src.id,
  src.content_search_language,
  src.tgt_plg_id,
  src.hidden
FROM src
RETURNING id,
  content;
        ",
        namespace_id,
        parent_course_id,
        target_clg_id,
        same_clg,
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| (record.id, record.content))
    .collect();

    Ok(contents)
}

async fn copy_exam_pages_and_return_contents(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_exam_id: Uuid,
) -> ModelResult<HashMap<Uuid, Value>> {
    let contents = sqlx::query!(
        "
INSERT INTO pages (
    id,
    exam_id,
    content,
    url_path,
    title,
    chapter_id,
    order_number,
    copied_from,
    content_search_language,
    hidden
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  content,
  url_path,
  title,
  NULL,
  order_number,
  id,
  content_search_language,
  hidden
FROM pages
WHERE (exam_id = $2)
  AND deleted_at IS NULL
RETURNING id,
  content;
        ",
        namespace_id,
        parent_exam_id
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| (record.id, record.content))
    .collect();

    Ok(contents)
}

/// A chapter whose front page was not copied is left without one.
async fn set_chapter_front_pages(tx: &mut PgConnection, namespace_id: Uuid) -> ModelResult<()> {
    // Update front_page_id of chapters now that new pages exist.
    sqlx::query!(
        "
UPDATE chapters c
SET front_page_id = (
    SELECT p.id
    FROM pages p
    WHERE p.id = uuid_generate_v5(c.course_id, c.front_page_id::text)
  )
WHERE c.course_id = $1
  AND c.front_page_id IS NOT NULL;
            ",
        namespace_id,
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

/// Returns the ids of the copied modules.
async fn copy_course_modules(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<HashSet<Uuid>> {
    let copied_ids = sqlx::query!(
        "
INSERT INTO course_modules (
    id,
    course_id,
    name,
    order_number,
    copied_from,
    automatic_completion,
    automatic_completion_number_of_exercises_attempted_treshold,
    automatic_completion_number_of_points_treshold,
    automatic_completion_requires_exam,
    certification_enabled,
    completion_registration_link_override,
    ects_credits,
    enable_registering_completion_to_uh_open_university,
    enable_credit_registration_via_suotar,
    uh_course_code
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  order_number,
  id,
  automatic_completion,
  automatic_completion_number_of_exercises_attempted_treshold,
  automatic_completion_number_of_points_treshold,
  automatic_completion_requires_exam,
  certification_enabled,
  completion_registration_link_override,
  ects_credits,
  enable_registering_completion_to_uh_open_university,
  enable_credit_registration_via_suotar,
  uh_course_code
FROM course_modules
WHERE course_id = $2
  AND deleted_at IS NULL
RETURNING id
        ",
        new_course_id,
        old_course_id,
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|record| record.id)
    .collect();
    Ok(copied_ids)
}

/// After this one `set_chapter_front_pages` needs to be called to get these to point to the correct front pages.
async fn copy_course_chapters(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO chapters (
    id,
    name,
    course_id,
    chapter_number,
    front_page_id,
    opens_at,
    chapter_image_path,
    copied_from,
    course_module_id,
    color,
    deadline
  )
SELECT uuid_generate_v5($1, id::text),
  name,
  $1,
  chapter_number,
  front_page_id,
  opens_at,
  chapter_image_path,
  id,
  uuid_generate_v5($1, course_module_id::text),
  color,
  deadline
FROM chapters
WHERE (course_id = $2)
  AND deleted_at IS NULL;
    ",
        namespace_id,
        parent_course_id
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

/// Copies the exercises of the copied pages and returns the copies' ids.
///
/// Exercises take their page's chapter, since `exercises.chapter_id` can be stale after a page
/// moved between chapters.
async fn copy_course_exercises(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    src_course_id: Uuid,
    target_clg_id: Uuid,
    same_clg: bool,
) -> ModelResult<HashSet<Uuid>> {
    let copied_ids = sqlx::query!(
        r#"
WITH src AS (
  SELECT e.*,
    copied_page.chapter_id AS tgt_chapter_id,
    CASE
      WHEN $4 THEN e.exercise_language_group_id
      ELSE uuid_generate_v5($3, e.id::text)
    END AS tgt_elg_id
  FROM exercises e
    JOIN pages copied_page ON copied_page.id = uuid_generate_v5($1, e.page_id::text)
  WHERE e.course_id = $2
    AND e.deleted_at IS NULL
),
ins_elg AS (
  INSERT INTO exercise_language_groups (id, course_language_group_id)
  SELECT DISTINCT tgt_elg_id,
    $3
  FROM src
  WHERE NOT $4 ON CONFLICT (id) DO NOTHING
),
ins_exercises AS (
  INSERT INTO exercises (
      id,
      course_id,
      name,
      deadline,
      page_id,
      score_maximum,
      order_number,
      chapter_id,
      copied_from,
      exercise_language_group_id,
      max_tries_per_slide,
      limit_number_of_tries,
      needs_peer_review,
      use_course_default_peer_or_self_review_config,
      needs_self_review,
      teacher_reviews_answer_after_locking
    )
  SELECT uuid_generate_v5($1, src.id::text),
    $1,
    src.name,
    src.deadline,
    uuid_generate_v5($1, src.page_id::text),
    src.score_maximum,
    src.order_number,
    src.tgt_chapter_id,
    src.id,
    src.tgt_elg_id,
    src.max_tries_per_slide,
    src.limit_number_of_tries,
    src.needs_peer_review,
    src.use_course_default_peer_or_self_review_config,
    src.needs_self_review,
    src.teacher_reviews_answer_after_locking
  FROM src
  RETURNING id
)
SELECT id
FROM ins_exercises;
        "#,
        new_course_id,
        src_course_id,
        target_clg_id,
        same_clg,
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| record.id)
    .collect();

    Ok(copied_ids)
}

/// Copies the exercises of the copied exam pages and returns the copies' ids.
async fn copy_exam_exercises(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_exam_id: Uuid,
) -> ModelResult<HashSet<Uuid>> {
    let copied_ids = sqlx::query!(
        "
INSERT INTO exercises (
    id,
    exam_id,
    name,
    deadline,
    page_id,
    score_maximum,
    order_number,
    chapter_id,
    copied_from,
    max_tries_per_slide,
    limit_number_of_tries,
    needs_peer_review,
    use_course_default_peer_or_self_review_config,
    needs_self_review,
    teacher_reviews_answer_after_locking
  )
SELECT uuid_generate_v5($1, e.id::text),
  $1,
  e.name,
  e.deadline,
  copied_page.id,
  e.score_maximum,
  e.order_number,
  NULL,
  e.id,
  e.max_tries_per_slide,
  e.limit_number_of_tries,
  e.needs_peer_review,
  e.use_course_default_peer_or_self_review_config,
  e.needs_self_review,
  e.teacher_reviews_answer_after_locking
FROM exercises e
  JOIN pages copied_page ON copied_page.id = uuid_generate_v5($1, e.page_id::text)
WHERE e.exam_id = $2
  AND e.deleted_at IS NULL
RETURNING id;
            ",
        namespace_id,
        parent_exam_id
    )
    .fetch_all(tx)
    .await?
    .into_iter()
    .map(|record| record.id)
    .collect();

    Ok(copied_ids)
}

async fn copy_exercise_slides(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_slides (id, exercise_id, order_number)
SELECT uuid_generate_v5($1, s.id::text),
  copied_exercise.id,
  s.order_number
FROM exercise_slides s
  JOIN exercises e ON e.id = s.exercise_id
  JOIN exercises copied_exercise ON copied_exercise.id = uuid_generate_v5($1, s.exercise_id::text)
WHERE (e.course_id = $2 OR e.exam_id = $2)
  AND s.deleted_at IS NULL;
            ",
        namespace_id,
        parent_id
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

async fn copy_exercise_tasks(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_tasks (
    id,
    exercise_slide_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec,
    model_solution_spec,
    order_number,
    copied_from
  )
SELECT uuid_generate_v5($1, t.id::text),
  copied_slide.id,
  t.exercise_type,
  t.assignment,
  t.private_spec,
  t.public_spec,
  t.model_solution_spec,
  t.order_number,
  t.id
FROM exercise_tasks t
  JOIN exercise_slides s ON s.id = t.exercise_slide_id
  JOIN exercises e ON e.id = s.exercise_id
  JOIN exercise_slides copied_slide ON copied_slide.id = uuid_generate_v5($1, t.exercise_slide_id::text)
WHERE (e.course_id = $2 OR e.exam_id = $2)
  AND t.deleted_at IS NULL;
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;

    // The copied specs name the same stored files as the originals, so the copy has to declare
    // them too. Otherwise only the original task declares them, and editing or deleting the
    // original leaves the copy serving files the reaper is free to delete.
    sqlx::query!(
        "
INSERT INTO exercise_task_spec_files (exercise_task_id, file_upload_id, spec_kind)
SELECT copied_task.id,
  f.file_upload_id,
  f.spec_kind
FROM exercise_task_spec_files f
  JOIN exercise_tasks t ON t.id = f.exercise_task_id
  JOIN exercise_slides s ON s.id = t.exercise_slide_id
  JOIN exercises e ON e.id = s.exercise_id
  JOIN exercise_tasks copied_task ON copied_task.id = uuid_generate_v5($1, f.exercise_task_id::text)
WHERE (e.course_id = $2 OR e.exam_id = $2)
  AND f.deleted_at IS NULL;
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

pub async fn copy_user_permissions(
    conn: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO roles (
    id,
    user_id,
    organization_id,
    course_id,
    role
  )
SELECT uuid_generate_v5($2, id::text),
  user_id,
  organization_id,
  $2,
  role
FROM roles
WHERE (course_id = $1)
AND NOT (user_id = $3)
AND deleted_at IS NULL;
    ",
        old_course_id,
        new_course_id,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

async fn copy_peer_or_self_review_configs(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    // Matched on the exercise's course, not the config's: older configs can carry the course_id of
    // the course their exercise block was pasted from.
    sqlx::query!(
        "
INSERT INTO peer_or_self_review_configs (
    id,
    course_id,
    exercise_id,
    peer_reviews_to_give,
    peer_reviews_to_receive,
    processing_strategy,
    accepting_threshold,
    manual_review_cutoff_in_days,
    points_are_all_or_nothing,
    review_instructions,
    reset_answer_if_zero_points_from_review
  )
SELECT uuid_generate_v5($1, posrc.id::text),
  $1,
  copied_exercise.id,
  posrc.peer_reviews_to_give,
  posrc.peer_reviews_to_receive,
  posrc.processing_strategy,
  posrc.accepting_threshold,
  posrc.manual_review_cutoff_in_days,
  posrc.points_are_all_or_nothing,
  posrc.review_instructions,
  posrc.reset_answer_if_zero_points_from_review
FROM peer_or_self_review_configs posrc
  LEFT JOIN exercises e ON (e.id = posrc.exercise_id)
  LEFT JOIN exercises copied_exercise ON (
    copied_exercise.id = uuid_generate_v5($1, posrc.exercise_id::text)
  )
WHERE posrc.deleted_at IS NULL
  AND (
    (
      posrc.exercise_id IS NULL
      AND posrc.course_id = $2
    )
    OR (
      e.course_id = $2
      AND copied_exercise.id IS NOT NULL
    )
  );
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_peer_or_self_review_questions(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO peer_or_self_review_questions (
    id,
    peer_or_self_review_config_id,
    order_number,
    question,
    question_type,
    answer_required,
    weight
  )
SELECT uuid_generate_v5($1, q.id::text),
  copied_config.id,
  q.order_number,
  q.question,
  q.question_type,
  q.answer_required,
  q.weight
FROM peer_or_self_review_questions q
  JOIN peer_or_self_review_configs posrc ON (posrc.id = q.peer_or_self_review_config_id)
  JOIN peer_or_self_review_configs copied_config ON (
    copied_config.id = uuid_generate_v5($1, q.peer_or_self_review_config_id::text)
  )
  LEFT JOIN exercises e ON (e.id = posrc.exercise_id)
WHERE q.deleted_at IS NULL
  AND (
    posrc.course_id = $2
    OR e.course_id = $2
  );
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_material_references(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    // Copy material references
    sqlx::query!(
        "
INSERT INTO material_references (
    citation_key,
    course_id,
    id,
    reference
)
SELECT citation_key,
  $1,
  uuid_generate_v5($1, id::text),
  reference
FROM material_references
WHERE course_id = $2
AND deleted_at IS NULL;
    ",
        namespace_id,
        parent_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_glossary_entries(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO glossary (
    id,
    course_id,
    term,
    definition
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  term,
  definition
FROM glossary
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_certificate_configurations_and_requirements(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO certificate_configurations (
    id,
    background_svg_file_upload_id,
    background_svg_path,
    certificate_date_font_size,
    certificate_date_text_anchor,
    certificate_date_text_color,
    certificate_date_x_pos,
    certificate_date_y_pos,
    certificate_grade_font_size,
    certificate_grade_text_anchor,
    certificate_grade_text_color,
    certificate_grade_x_pos,
    certificate_grade_y_pos,
    certificate_locale,
    certificate_owner_name_font_size,
    certificate_owner_name_text_anchor,
    certificate_owner_name_text_color,
    certificate_owner_name_x_pos,
    certificate_owner_name_y_pos,
    certificate_validate_url_font_size,
    certificate_validate_url_text_anchor,
    certificate_validate_url_text_color,
    certificate_validate_url_x_pos,
    certificate_validate_url_y_pos,
    overlay_svg_file_upload_id,
    overlay_svg_path,
    paper_size,
    render_certificate_grade
  )
SELECT uuid_generate_v5($1, id::text),
  background_svg_file_upload_id,
  background_svg_path,
  certificate_date_font_size,
  certificate_date_text_anchor,
  certificate_date_text_color,
  certificate_date_x_pos,
  certificate_date_y_pos,
  certificate_grade_font_size,
  certificate_grade_text_anchor,
  certificate_grade_text_color,
  certificate_grade_x_pos,
  certificate_grade_y_pos,
  certificate_locale,
  certificate_owner_name_font_size,
  certificate_owner_name_text_anchor,
  certificate_owner_name_text_color,
  certificate_owner_name_x_pos,
  certificate_owner_name_y_pos,
  certificate_validate_url_font_size,
  certificate_validate_url_text_anchor,
  certificate_validate_url_text_color,
  certificate_validate_url_x_pos,
  certificate_validate_url_y_pos,
  overlay_svg_file_upload_id,
  overlay_svg_path,
  paper_size,
  render_certificate_grade
FROM certificate_configurations
WHERE id IN (
    SELECT certificate_configuration_id
    FROM certificate_configuration_to_requirements cctr
      JOIN course_modules cm ON cctr.course_module_id = cm.id
    WHERE cm.course_id = $2
      AND cctr.deleted_at IS NULL
      AND cm.deleted_at IS NULL
  )
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "
INSERT INTO certificate_configuration_to_requirements (
    id,
    certificate_configuration_id,
    course_module_id
  )
SELECT uuid_generate_v5($1, cctr.id::text),
  uuid_generate_v5($1, cctr.certificate_configuration_id::text),
  uuid_generate_v5($1, cctr.course_module_id::text)
FROM certificate_configuration_to_requirements cctr
  JOIN course_modules cm ON cctr.course_module_id = cm.id
  JOIN certificate_configurations cc ON cctr.certificate_configuration_id = cc.id
WHERE cm.course_id = $2
  AND cctr.deleted_at IS NULL
  AND cm.deleted_at IS NULL
  AND cc.deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}

/// Returns the ids of the copied configurations.
async fn copy_chatbot_configurations(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<HashSet<Uuid>> {
    let copied_ids = sqlx::query!(
        "
INSERT INTO chatbot_configurations (
    id,
    course_id,
    chatbot_name,
    initial_message,
    prompt,
    use_azure_search,
    maintain_azure_search_index,
    use_semantic_reranking,
    hide_citations,
    temperature,
    top_p,
    presence_penalty,
    frequency_penalty,
    max_output_tokens,
    daily_tokens_per_user,
    weekly_tokens_per_user,
    default_chatbot,
    enabled_to_students,
    model_id,
    enabled_tool_categories,
    verbosity,
    reasoning_effort,
    suggest_next_messages,
    initial_suggested_messages,
    publicly_accessible
  )
SELECT
  uuid_generate_v5($1, id::text),
  $1,
  chatbot_name,
  initial_message,
  prompt,
  use_azure_search,
  maintain_azure_search_index,
  use_semantic_reranking,
  hide_citations,
  temperature,
  top_p,
  presence_penalty,
  frequency_penalty,
  max_output_tokens,
  daily_tokens_per_user,
  weekly_tokens_per_user,
  default_chatbot,
  enabled_to_students,
  model_id,
  enabled_tool_categories,
  verbosity,
  reasoning_effort,
  suggest_next_messages,
  initial_suggested_messages,
  publicly_accessible
FROM chatbot_configurations
WHERE course_id = $2
  AND deleted_at IS NULL
RETURNING id;
        ",
        new_course_id,
        old_course_id
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|record| record.id)
    .collect();
    Ok(copied_ids)
}

async fn copy_cheater_thresholds(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO cheater_thresholds (id, course_module_id, duration_seconds)
SELECT uuid_generate_v5($1, ct.id::text),
  copied_module.id,
  ct.duration_seconds
FROM cheater_thresholds ct
  JOIN course_modules cm ON cm.id = ct.course_module_id
  JOIN course_modules copied_module ON copied_module.id = uuid_generate_v5($1, ct.course_module_id::text)
WHERE cm.course_id = $2
  AND ct.deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

/// Copies what a teacher typed, matching the `uh_course_code` and `ects_credits` that
/// `copy_course_modules` already carries over. The pause record and the config-check verdict are
/// dropped on purpose: they describe the source course. Realisations are per-term and not copied.
async fn copy_course_module_suotar_configurations(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_module_suotar_configurations (
    id,
    course_module_id,
    open_university_product_id,
    grade_scale_id
  )
SELECT uuid_generate_v5($1, cmsc.id::text),
  uuid_generate_v5($1, cmsc.course_module_id::text),
  cmsc.open_university_product_id,
  cmsc.grade_scale_id
FROM course_module_suotar_configurations cmsc
  JOIN course_modules cm ON cm.id = cmsc.course_module_id
WHERE cm.course_id = $2
  AND cmsc.deleted_at IS NULL
  AND cm.deleted_at IS NULL
  AND (
    cmsc.open_university_product_id IS NOT NULL
    OR cmsc.grade_scale_id IS NOT NULL
  );
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_course_custom_privacy_policy_checkbox_texts(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_custom_privacy_policy_checkbox_texts (id, course_id, text_slug, text_html)
SELECT uuid_generate_v5($1, id::text),
  $1,
  text_slug,
  text_html
FROM course_custom_privacy_policy_checkbox_texts
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_exercise_repositories(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_repositories (
    id,
    course_id,
    url,
    deploy_key,
    public_key,
    STATUS,
    error_message
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  url,
  deploy_key,
  public_key,
  STATUS,
  error_message
FROM exercise_repositories
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_partners_blocks(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO partners_blocks (id, course_id, content)
SELECT uuid_generate_v5($1, id::text),
  $1,
  content
FROM partners_blocks
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

async fn copy_privacy_links(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO privacy_links (id, course_id, url, title)
SELECT uuid_generate_v5($1, id::text),
  $1,
  url,
  title
FROM privacy_links
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

/// Returns the ids of the copied questions. The form content still names the source questions
/// until it goes through `ContentRewrite`.
async fn copy_research_consent_forms_and_questions(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<HashSet<Uuid>> {
    sqlx::query!(
        "
INSERT INTO course_specific_research_consent_forms (id, course_id, content)
SELECT uuid_generate_v5($1, id::text),
  $1,
  content
FROM course_specific_research_consent_forms
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;

    let copied_ids = sqlx::query!(
        "
INSERT INTO course_specific_consent_form_questions (
    id,
    course_id,
    research_consent_form_id,
    question
  )
SELECT uuid_generate_v5($1, q.id::text),
  $1,
  copied_form.id,
  q.question
FROM course_specific_consent_form_questions q
  JOIN course_specific_research_consent_forms copied_form ON (
    copied_form.id = uuid_generate_v5($1, q.research_consent_form_id::text)
  )
WHERE q.course_id = $2
  AND q.deleted_at IS NULL
RETURNING id;
        ",
        new_course_id,
        old_course_id
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|record| record.id)
    .collect();

    Ok(copied_ids)
}

async fn copy_email_templates(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO email_templates (
    id,
    course_id,
    content,
    subject,
    exercise_completions_threshold,
    points_threshold,
    language,
    email_template_type
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  content,
  subject,
  exercise_completions_threshold,
  points_threshold,
  language,
  email_template_type
FROM email_templates
WHERE course_id = $2
  AND deleted_at IS NULL;
        ",
        new_course_id,
        old_course_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

/// Copies the giveaways without their codes and returns the copies' ids. Must run after the
/// modules and the research consent questions are copied.
async fn copy_code_giveaways(
    tx: &mut PgConnection,
    new_course_id: Uuid,
    old_course_id: Uuid,
) -> ModelResult<HashSet<Uuid>> {
    // A required consent question that was deleted cannot be answered, so the source giveaway can
    // never hand out codes; dropping the requirement would open the copy to everyone instead.
    let copied_ids = sqlx::query!(
        "
INSERT INTO code_giveaways (
    id,
    course_id,
    course_module_id,
    enabled,
    require_course_specific_consent_form_question_id,
    name
  )
SELECT uuid_generate_v5($1, cg.id::text),
  $1,
  copied_module.id,
  cg.enabled
  AND (
    cg.require_course_specific_consent_form_question_id IS NULL
    OR copied_question.id IS NOT NULL
  ),
  copied_question.id,
  cg.name
FROM code_giveaways cg
  LEFT JOIN course_modules copied_module ON (
    copied_module.id = uuid_generate_v5($1, cg.course_module_id::text)
  )
  LEFT JOIN course_specific_consent_form_questions copied_question ON (
    copied_question.id = uuid_generate_v5(
      $1,
      cg.require_course_specific_consent_form_question_id::text
    )
  )
WHERE cg.course_id = $2
  AND cg.deleted_at IS NULL
RETURNING id;
        ",
        new_course_id,
        old_course_id
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|record| record.id)
    .collect();
    Ok(copied_ids)
}

/// The copies share the stored audio files with the source pages.
async fn copy_page_audio_files(
    tx: &mut PgConnection,
    namespace_id: Uuid,
    parent_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO page_audio_files (id, page_id, path, mime_type)
SELECT uuid_generate_v5($1, a.id::text),
  copied_page.id,
  a.path,
  a.mime_type
FROM page_audio_files a
  JOIN pages p ON p.id = a.page_id
  JOIN pages copied_page ON copied_page.id = uuid_generate_v5($1, a.page_id::text)
WHERE (p.course_id = $2 OR p.exam_id = $2)
  AND a.deleted_at IS NULL;
        ",
        namespace_id,
        parent_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{exercise_tasks::ExerciseTask, pages::Page, test_helper::*};
    use pretty_assertions::assert_eq;

    #[tokio::test]
    async fn elg_preserved_when_same_course_language_group() {
        insert_data!(:tx, :user, :org, :course, instance: _i, course_module: _m,
                     :chapter, :page, :exercise);
        let original_ex = crate::exercises::get_by_id(tx.as_mut(), exercise)
            .await
            .unwrap();

        /* copy into THE SAME CLG via same_language_group = true */
        let new_meta = create_new_course(org, "fi-FI".into());
        let copied_course = copy_course(tx.as_mut(), course, &new_meta, true, user)
            .await
            .unwrap();

        let copied_ex = crate::exercises::get_exercises_by_course_id(tx.as_mut(), copied_course.id)
            .await
            .unwrap()
            .pop()
            .unwrap();

        assert_eq!(
            original_ex.exercise_language_group_id, copied_ex.exercise_language_group_id,
            "ELG must stay identical when CLG is unchanged"
        );
    }

    /// 2.  When we copy to a *different* CLG twice **with the same target id**,
    ///     every exercise must get the SAME deterministic ELG each time.
    #[tokio::test]
    async fn elg_deterministic_when_reusing_target_clg() {
        insert_data!(:tx, :user, :org, :course, instance: _i, course_module: _m,
                     :chapter, :page, exercise: _e);

        // Pre-create a brand-new CLG that both copies will use
        let reusable_clg =
            course_language_groups::insert(tx.as_mut(), PKeyPolicy::Generate, "reusable-clg")
                .await
                .unwrap();

        let meta1 = create_new_course(org, "en-US".into());
        let copy1 =
            copy_course_with_language_group(tx.as_mut(), course, reusable_clg, &meta1, user)
                .await
                .unwrap();

        let meta2 = {
            let mut nc = create_new_course(org, "pt-BR".into());
            nc.slug = "copied-course-2".into(); // ensure uniqueness
            nc
        };
        let copy2 =
            copy_course_with_language_group(tx.as_mut(), course, reusable_clg, &meta2, user)
                .await
                .unwrap();

        let ex1 = crate::exercises::get_exercises_by_course_id(tx.as_mut(), copy1.id)
            .await
            .unwrap()
            .pop()
            .unwrap();
        let ex2 = crate::exercises::get_exercises_by_course_id(tx.as_mut(), copy2.id)
            .await
            .unwrap()
            .pop()
            .unwrap();

        assert_ne!(ex1.course_id, ex2.course_id); // different copies
        assert_eq!(
            ex1.exercise_language_group_id, ex2.exercise_language_group_id,
            "ELG must be deterministic for the same (target CLG, src exercise)"
        );
    }

    #[tokio::test]
    async fn copies_course_as_different_course_language_group() {
        insert_data!(:tx, :user, :org, :course);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "en-US".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, false, user)
            .await
            .unwrap();
        assert_ne!(
            course.course_language_group_id,
            copied_course.course_language_group_id
        );
    }

    #[tokio::test]
    async fn copies_course_as_same_course_language_group() {
        insert_data!(:tx, :user, :org, :course);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "fi-FI".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        assert_eq!(
            course.course_language_group_id,
            copied_course.course_language_group_id
        );
    }

    #[tokio::test]
    async fn copies_course_instances() {
        insert_data!(:tx, :user, :org, :course, instance: _instance);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "en-GB".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        let copied_instances =
            crate::course_instances::get_course_instances_for_course(tx.as_mut(), copied_course.id)
                .await
                .unwrap();
        assert_eq!(copied_instances.len(), 1);
    }

    #[tokio::test]
    async fn copies_course_modules() {
        insert_data!(:tx, :user, :org, :course);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "pt-BR".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();

        let original_modules = crate::course_modules::get_by_course_id(tx.as_mut(), course.id)
            .await
            .unwrap();
        let copied_modules = crate::course_modules::get_by_course_id(tx.as_mut(), copied_course.id)
            .await
            .unwrap();
        assert_eq!(
            original_modules.first().unwrap().id,
            copied_modules.first().unwrap().copied_from.unwrap(),
        )
    }

    async fn insert_certificate_configuration(conn: &mut PgConnection) -> Uuid {
        let background_svg_file_upload_id = crate::file_uploads::insert(
            &mut *conn,
            "background.svg",
            "certificates/background.svg",
            "image/svg+xml",
            None,
            None,
        )
        .await
        .unwrap();
        let configuration = crate::certificate_configurations::DatabaseCertificateConfiguration {
            id: Uuid::new_v4(),
            certificate_owner_name_y_pos: None,
            certificate_owner_name_x_pos: None,
            certificate_owner_name_font_size: None,
            certificate_owner_name_text_color: None,
            certificate_owner_name_text_anchor: None,
            certificate_validate_url_y_pos: None,
            certificate_validate_url_x_pos: None,
            certificate_validate_url_font_size: None,
            certificate_validate_url_text_color: None,
            certificate_validate_url_text_anchor: None,
            certificate_date_y_pos: None,
            certificate_date_x_pos: None,
            certificate_date_font_size: None,
            certificate_date_text_color: None,
            certificate_date_text_anchor: None,
            certificate_locale: None,
            paper_size: None,
            background_svg_path: "certificates/background.svg".to_string(),
            background_svg_file_upload_id,
            overlay_svg_path: None,
            overlay_svg_file_upload_id: None,
            render_certificate_grade: false,
            certificate_grade_y_pos: None,
            certificate_grade_x_pos: None,
            certificate_grade_font_size: None,
            certificate_grade_text_color: None,
            certificate_grade_text_anchor: None,
        };
        crate::certificate_configurations::insert(conn, &configuration)
            .await
            .unwrap()
            .id
    }

    async fn certificate_configurations_for_course(
        conn: &mut PgConnection,
        course_id: Uuid,
    ) -> Vec<crate::certificate_configurations::CertificateConfigurationAndRequirements> {
        crate::certificate_configurations::get_default_certificate_configurations_and_requirements_by_course(
            conn, course_id,
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn copies_certificate_configurations() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);
        let configuration = insert_certificate_configuration(tx.as_mut()).await;
        crate::certificate_configuration_to_requirements::insert(
            tx.as_mut(),
            configuration,
            Some(course_module.id),
        )
        .await
        .unwrap();

        let new_course = create_new_course(org, "en-NZ".into());
        let copied_course = copy_course(tx.as_mut(), course, &new_course, true, user)
            .await
            .unwrap();

        let copied = certificate_configurations_for_course(tx.as_mut(), copied_course.id).await;
        assert_eq!(copied.len(), 1);
        let required_module_id = *copied[0]
            .requirements
            .course_module_ids
            .first()
            .expect("the copied configuration should require a module");
        let required_module = crate::course_modules::get_by_id(tx.as_mut(), required_module_id)
            .await
            .unwrap();
        assert_eq!(required_module.course_id, copied_course.id);
        assert_eq!(required_module.copied_from, Some(course_module.id));
    }

    /// Older data can hold requirements pointing at a deleted configuration.
    #[tokio::test]
    async fn skips_requirements_of_deleted_certificate_configurations() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);
        let configuration = insert_certificate_configuration(tx.as_mut()).await;
        crate::certificate_configurations::delete(tx.as_mut(), configuration)
            .await
            .unwrap();
        // `delete` clears requirements, so the link has to come after it.
        crate::certificate_configuration_to_requirements::insert(
            tx.as_mut(),
            configuration,
            Some(course_module.id),
        )
        .await
        .unwrap();

        let new_course = create_new_course(org, "en-IE".into());
        let copied_course = copy_course(tx.as_mut(), course, &new_course, true, user)
            .await
            .unwrap();

        assert!(
            certificate_configurations_for_course(tx.as_mut(), copied_course.id)
                .await
                .is_empty()
        );
    }

    #[tokio::test]
    async fn copies_course_chapters() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "sv-SV".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        let copied_chapters = crate::chapters::get_course_chapters(tx.as_mut(), copied_course.id)
            .await
            .unwrap();
        assert_eq!(copied_chapters.len(), 1);
        assert_eq!(copied_chapters.first().unwrap().copied_from, Some(chapter));
    }

    #[tokio::test]
    async fn updates_chapter_front_pages() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, chapter: _chapter);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "fr-CA".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        let copied_chapters = crate::chapters::get_course_chapters(tx.as_mut(), copied_course.id)
            .await
            .unwrap();
        let copied_chapter = copied_chapters.first().unwrap();
        let copied_chapter_front_page =
            crate::pages::get_page(tx.as_mut(), copied_chapter.front_page_id.unwrap())
                .await
                .unwrap();
        assert_eq!(copied_chapter_front_page.course_id, Some(copied_course.id));
    }

    #[tokio::test]
    async fn copies_course_pages() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, page: _page);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "es-US".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        let mut original_pages_by_id: HashMap<Uuid, Page> =
            crate::pages::get_all_by_course_id_and_visibility(
                tx.as_mut(),
                course.id,
                crate::pages::PageVisibility::Any,
            )
            .await
            .unwrap()
            .into_iter()
            .map(|page| (page.id, page))
            .collect();
        assert_eq!(original_pages_by_id.len(), 3);
        let copied_pages = crate::pages::get_all_by_course_id_and_visibility(
            tx.as_mut(),
            copied_course.id,
            crate::pages::PageVisibility::Any,
        )
        .await
        .unwrap();
        assert_eq!(copied_pages.len(), 3);
        copied_pages.into_iter().for_each(|copied_page| {
            assert!(
                original_pages_by_id
                    .remove(&copied_page.copied_from.unwrap())
                    .is_some()
            );
        });
        assert!(original_pages_by_id.is_empty());
    }

    #[tokio::test]
    async fn updates_course_slugs_in_internal_links_in_pages_contents() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, :page);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        crate::pages::update_page_content(
            tx.as_mut(),
            page,
            &serde_json::json!([{
                "name": "core/paragraph",
                "isValid": true,
                "clientId": "b2ecb473-38cc-4df1-84f7-45709cc63e95",
                "attributes": {
                    "content": format!("Internal link <a href=\"http://project-331.local/org/uh-cs/courses/{slug2}\">http://project-331.local/org/uh-cs/courses/{slug1}</a>", slug2 = course.slug, slug1 = course.slug),
                    "dropCap":false
                },
                "innerBlocks": []
            }]),
        )
        .await.unwrap();

        let new_course = create_new_course(org, "fi-FI".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();

        let copied_pages = crate::pages::get_all_by_course_id_and_visibility(
            tx.as_mut(),
            copied_course.id,
            crate::pages::PageVisibility::Any,
        )
        .await
        .unwrap();
        let copied_page = copied_pages
            .into_iter()
            .find(|copied_page| copied_page.copied_from == Some(page))
            .unwrap();
        let copied_content_in_page = copied_page.content[0]["attributes"]["content"]
            .as_str()
            .unwrap();
        let content_with_updated_course_slug = format!(
            "Internal link <a href=\"http://project-331.local/org/uh-cs/courses/copied-course\">http://project-331.local/org/uh-cs/courses/{}</a>",
            course.slug
        );
        assert_eq!(copied_content_in_page, content_with_updated_course_slug);
    }

    #[tokio::test]
    async fn updates_exercise_id_in_content() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, :page, :exercise);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        crate::pages::update_page_content(
            tx.as_mut(),
            page,
            &serde_json::json!([{
                "name": "moocfi/exercise",
                "isValid": true,
                "clientId": "b2ecb473-38cc-4df1-84f7-06709cc63e95",
                "attributes": {
                    "id": exercise,
                    "name": "Exercise"
                },
                "innerBlocks": []
            }]),
        )
        .await
        .unwrap();
        let new_course = create_new_course(org, "es-MX".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        let copied_pages = crate::pages::get_all_by_course_id_and_visibility(
            tx.as_mut(),
            copied_course.id,
            crate::pages::PageVisibility::Any,
        )
        .await
        .unwrap();
        let copied_page = copied_pages
            .into_iter()
            .find(|copied_page| copied_page.copied_from == Some(page))
            .unwrap();
        let copied_exercise_id_in_content =
            Uuid::parse_str(copied_page.content[0]["attributes"]["id"].as_str().unwrap()).unwrap();
        let copied_exercise =
            crate::exercises::get_by_id(tx.as_mut(), copied_exercise_id_in_content)
                .await
                .unwrap();
        assert_eq!(copied_exercise.course_id.unwrap(), copied_course.id);
    }

    #[tokio::test]
    async fn copies_exercises_tasks_and_slides() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, course_module: _course_module, :chapter, :page, :exercise, :slide, :task);
        let course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let new_course = create_new_course(org, "fi-SV".into());
        let copied_course = copy_course(tx.as_mut(), course.id, &new_course, true, user)
            .await
            .unwrap();
        let copied_exercises =
            crate::exercises::get_exercises_by_course_id(tx.as_mut(), copied_course.id)
                .await
                .unwrap();
        assert_eq!(copied_exercises.len(), 1);
        let copied_exercise = copied_exercises.first().unwrap();
        assert_eq!(copied_exercise.copied_from, Some(exercise));
        let original_exercise = crate::exercises::get_by_id(tx.as_mut(), exercise)
            .await
            .unwrap();
        assert_eq!(
            copied_exercise.max_tries_per_slide,
            original_exercise.max_tries_per_slide
        );
        assert_eq!(
            copied_exercise.limit_number_of_tries,
            original_exercise.limit_number_of_tries
        );
        assert_eq!(
            copied_exercise.needs_peer_review,
            original_exercise.needs_peer_review
        );
        assert_eq!(
            copied_exercise.use_course_default_peer_or_self_review_config,
            original_exercise.use_course_default_peer_or_self_review_config
        );
        let copied_slides = crate::exercise_slides::get_exercise_slides_by_exercise_id(
            tx.as_mut(),
            copied_exercise.id,
        )
        .await
        .unwrap();
        assert_eq!(copied_slides.len(), 1);
        let copied_slide = copied_slides.first().unwrap();
        let copied_tasks: Vec<ExerciseTask> =
            crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_id(
                tx.as_mut(),
                &copied_slide.id,
            )
            .await
            .unwrap();
        assert_eq!(copied_tasks.len(), 1);
        let copied_task = copied_tasks.first().unwrap();
        assert_eq!(copied_task.copied_from, Some(task));

        let original_course_chapters = crate::chapters::get_course_chapters(tx.as_mut(), course.id)
            .await
            .unwrap();
        for original_chapter in original_course_chapters {
            for copied_exercise in &copied_exercises {
                assert_ne!(original_chapter.id, copied_exercise.id);
            }
        }
    }

    /// A copied course's specs name the same stored files as the originals, so the copy has to
    /// declare them too. Without this the file is declared only by the original task, and editing
    /// or deleting the original hands the copy's files to the abandoned-upload reaper.
    #[tokio::test]
    async fn copies_the_files_the_specs_declare() {
        insert_data!(:tx, :user, :org, :course, instance: _i, course_module: _m,
                     :chapter, :page, :exercise, :slide, task: task);
        let file_upload_id = crate::file_uploads::insert(
            tx.as_mut(),
            "teacher-example.pdf",
            "declaring-service/teacher-example.pdf",
            "application/pdf",
            None,
            None,
        )
        .await
        .unwrap();
        crate::exercise_task_spec_files::replace_for_exercise_task(
            tx.as_mut(),
            task,
            crate::exercise_task_spec_files::SpecKind::Private,
            &[file_upload_id],
        )
        .await
        .unwrap();

        let new_meta = create_new_course(org, "fi-FI".into());
        let copied_course = copy_course(tx.as_mut(), course, &new_meta, false, user)
            .await
            .unwrap();

        let copied_exercise =
            crate::exercises::get_exercises_by_course_id(tx.as_mut(), copied_course.id)
                .await
                .unwrap()
                .pop()
                .unwrap();
        let copied_slides = crate::exercise_slides::get_exercise_slides_by_exercise_ids(
            tx.as_mut(),
            &[copied_exercise.id],
        )
        .await
        .unwrap();
        let copied_tasks = crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_ids(
            tx.as_mut(),
            &copied_slides
                .iter()
                .map(|slide| slide.id)
                .collect::<Vec<_>>(),
        )
        .await
        .unwrap();
        let copied_task = copied_tasks.first().expect("the copy has a task");

        let declared = crate::exercise_task_spec_files::get_for_exercise_task(
            tx.as_mut(),
            copied_task.id,
            crate::exercise_task_spec_files::SpecKind::Private,
        )
        .await
        .unwrap();
        assert_eq!(declared, vec![file_upload_id]);
    }

    fn create_new_course(organization_id: Uuid, language_code: String) -> NewCourse {
        NewCourse {
            name: "Copied course".to_string(),
            slug: "copied-course".to_string(),
            organization_id,
            language_code,
            teacher_in_charge_name: "Teacher".to_string(),
            teacher_in_charge_email: "teacher@example.com".to_string(),
            description: "".to_string(),
            is_draft: true,
            is_test_mode: false,
            is_unlisted: false,
            copy_user_permissions: false,
            is_joinable_by_code_only: false,
            join_code: None,
            ask_marketing_consent: false,
            flagged_answers_threshold: Some(3),
            can_add_chatbot: false,
        }
    }
}
