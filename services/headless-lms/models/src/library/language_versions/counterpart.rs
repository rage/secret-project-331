//! Creates a missing counterpart: copies a page with its exercises into another language version
//! and links the copy to the page and its exercises to theirs.

use std::collections::{HashMap, HashSet};

use futures::future::BoxFuture;
use headless_lms_utils::document_schema_processor::{GutenbergBlock, remap_ids_in_content};
use headless_lms_utils::strings::slugify;
use serde_json::json;
use url::Url;

use super::operation_logs::{self, LanguageVersionOperation};
use super::types::{
    CreateCounterpartRequest, CreateCounterpartResult, ExerciseCounterparts, LanguageVersionPage,
};
use super::{first_free_suffixed, invalid_request};
use crate::{
    SpecFetcher, chapters,
    entity_history::HistoryAuthor,
    exercise_service_info::ExerciseServiceInfoApi,
    library::copying::rewrite_course_links_in_content,
    page_history::HistoryChangeReason,
    page_language_groups,
    pages::{self, CmsPageUpdate, PageRow, PageUpdateArgs},
    prelude::*,
};

/// Copies the source page into the target course at the requested place and links the copy to
/// the source page's counterparts. Each copied exercise is linked to its source exercise unless
/// the target course already has a counterpart for it. Course links in the content point at the
/// target course. Runs in one transaction and logs the change.
///
/// Both courses must be live courses of `course_language_group_id`. Fails with `InvalidRequest`
/// (nothing changed) when they are not, when the target course already has a page linked to the
/// source page, when the chapter or `insert_after_page_id` is not in the target course at that
/// place, or when the title is empty.
pub async fn create_counterpart(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    actor_user_id: Uuid,
    request: &CreateCounterpartRequest,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CreateCounterpartResult> {
    let title = request.title.trim();
    if title.is_empty() {
        return Err(invalid_request("The page needs a title."));
    }
    let mut tx = conn.begin().await?;

    let source_page = pages::get_page(&mut tx, request.source_page_id).await?;
    let (Some(source_course_id), Some(page_language_group_id), None) = (
        source_page.course_id,
        source_page.page_language_group_id,
        source_page.deleted_at,
    ) else {
        return Err(invalid_request(
            "Only a live course page can be copied to another language version.",
        ));
    };
    if source_course_id == request.target_course_id {
        return Err(invalid_request(
            "The counterpart must be in another language version.",
        ));
    }
    let source_course = crate::courses::get_course(&mut tx, source_course_id).await?;
    let target_course = crate::courses::get_course(&mut tx, request.target_course_id).await?;
    if [&source_course, &target_course].iter().any(|course| {
        course.deleted_at.is_some() || course.course_language_group_id != course_language_group_id
    }) {
        return Err(invalid_request(
            "Both pages must be in courses of these language versions.",
        ));
    }
    if target_has_page_in_group(&mut tx, page_language_group_id, target_course.id).await? {
        return Err(invalid_request(
            "This language version already has a counterpart for the page.",
        ));
    }

    let chapter_number = match request.target_chapter_id {
        Some(chapter_id) => {
            let chapter = chapters::get_chapter(&mut tx, chapter_id).await?;
            if chapter.course_id != target_course.id || chapter.deleted_at.is_some() {
                return Err(invalid_request(
                    "The chapter is not in the target language version.",
                ));
            }
            Some(chapter.chapter_number)
        }
        None => None,
    };
    let order_number = make_room(
        &mut tx,
        target_course.id,
        request.target_chapter_id,
        request.insert_after_page_id,
    )
    .await?;
    let url_path = unique_url_path(&mut tx, target_course.id, chapter_number, title).await?;

    let page = pages::insert_page_row(
        &mut tx,
        PageRow {
            id: PKeyPolicy::Generate,
            course: Some(&target_course),
            exam_id: None,
            chapter_id: request.target_chapter_id,
            url_path: &url_path,
            title,
            order_number,
            hidden: source_page.hidden,
            content_search_language: None,
            page_language_group_id: Some(page_language_group_id),
        },
        &json!([]),
    )
    .await?;
    if page_language_groups::course_has_other_page(
        &mut tx,
        page_language_group_id,
        target_course.id,
        page.id,
    )
    .await?
    {
        return Err(invalid_request(
            "This language version got a counterpart for the page at the same time. Check again.",
        ));
    }
    sqlx::query!(
        "UPDATE pages SET copied_from = $2 WHERE id = $1",
        page.id,
        source_page.id
    )
    .execute(&mut *tx)
    .await?;

    let source = pages::with_exercises(&mut tx, source_page).await?;
    // Ids derived from the new page's id, as course copies derive theirs, so that the source ids
    // map to the copies' without update_page reporting the mapping. Not copying.rs's helpers:
    // those copy whole courses in SQL, while here update_page creates the rows.
    let copy_id = |source_id: Uuid| Uuid::new_v5(&page.id, source_id.to_string().as_bytes());
    let mut copied_ids: HashMap<Uuid, Uuid> = HashMap::new();
    let mut exercises = source.exercises;
    for exercise in &mut exercises {
        copied_ids.insert(exercise.id, copy_id(exercise.id));
        exercise.id = copy_id(exercise.id);
        if let Some(config) = exercise.peer_or_self_review_config.as_mut() {
            copied_ids.insert(config.id, copy_id(config.id));
            config.id = copy_id(config.id);
            config.course_id = target_course.id;
            config.exercise_id = config.exercise_id.map(copy_id);
        }
        for question in exercise.peer_or_self_review_questions.iter_mut().flatten() {
            question.id = copy_id(question.id);
            question.peer_or_self_review_config_id =
                copy_id(question.peer_or_self_review_config_id);
        }
    }
    let mut exercise_slides = source.exercise_slides;
    for slide in &mut exercise_slides {
        copied_ids.insert(slide.id, copy_id(slide.id));
        slide.id = copy_id(slide.id);
        slide.exercise_id = copy_id(slide.exercise_id);
    }
    let mut exercise_tasks = source.exercise_tasks;
    for task in &mut exercise_tasks {
        copied_ids.insert(task.id, copy_id(task.id));
        task.id = copy_id(task.id);
        task.exercise_slide_id = copy_id(task.exercise_slide_id);
    }
    let mut content = remap_ids_in_content(&source.page.content, copied_ids)?;
    rewrite_course_links_in_content(&mut content, &source_course.slug, &target_course.slug);
    let content: Vec<GutenbergBlock> = serde_json::from_value(content)?;

    let copied_exercise_count = exercises.len() as i64;
    pages::update_page(
        &mut tx,
        PageUpdateArgs {
            page_id: page.id,
            author: HistoryAuthor::user(actor_user_id),
            cms_page_update: CmsPageUpdate {
                content,
                exercises,
                exercise_slides,
                exercise_tasks,
                url_path: page.url_path.clone(),
                title: page.title.clone(),
                chapter_id: page.chapter_id,
                hidden: page.hidden,
            },
            retain_ids: true,
            history_change_reason: HistoryChangeReason::PageSaved,
            is_exam_page: false,
        },
        spec_fetcher,
        fetch_service_info,
    )
    .await?;

    let linked_exercises =
        link_copied_exercises(&mut tx, source.page.id, target_course.id, &copy_id).await?;

    operation_logs::insert(
        &mut tx,
        actor_user_id,
        LanguageVersionOperation::CreateCounterpart,
        course_language_group_id,
        json!({
            "source_page_id": source.page.id,
            "page_id": page.id,
            "target_course_id": target_course.id,
            "page_language_group_id": page_language_group_id,
            "exercises": linked_exercises,
        }),
    )
    .await?;
    let page = get_language_version_page(&mut tx, page.id).await?;
    tx.commit().await?;
    Ok(CreateCounterpartResult {
        page,
        copied_exercise_count,
    })
}

async fn target_has_page_in_group(
    conn: &mut PgConnection,
    page_language_group_id: Uuid,
    course_id: Uuid,
) -> ModelResult<bool> {
    let exists = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM pages
    WHERE page_language_group_id = $1
      AND course_id = $2
      AND deleted_at IS NULL
  ) AS "exists!"
        "#,
        page_language_group_id,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(exists)
}

/// Shifts the pages after the insertion point one place down and returns the order number the
/// new page takes. The chapter front page keeps its place, so `None` puts the page right after it.
/// Not [pages::reorder_pages]: that one needs every page of the course in its new order.
async fn make_room(
    conn: &mut PgConnection,
    course_id: Uuid,
    chapter_id: Option<Uuid>,
    insert_after_page_id: Option<Uuid>,
) -> ModelResult<i32> {
    let siblings = sqlx::query!(
        r#"
SELECT p.id,
  p.order_number,
  COALESCE(ch.front_page_id = p.id, FALSE) AS "is_chapter_front_page!"
FROM pages p
  LEFT JOIN chapters ch ON ch.id = p.chapter_id
WHERE p.course_id = $1
  AND p.chapter_id IS NOT DISTINCT FROM $2
  AND p.deleted_at IS NULL
ORDER BY p.order_number,
  p.id
FOR UPDATE OF p
        "#,
        course_id,
        chapter_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let front_page = siblings.iter().find(|p| p.is_chapter_front_page);
    let order_number = match insert_after_page_id {
        Some(after_id) => {
            let after = siblings.iter().find(|p| p.id == after_id).ok_or_else(|| {
                invalid_request("The page to insert after is not in the chosen chapter.")
            })?;
            after.order_number + 1
        }
        None => siblings
            .iter()
            .find(|p| !p.is_chapter_front_page)
            .map(|p| p.order_number)
            .or(front_page.map(|p| p.order_number + 1))
            .unwrap_or(1),
    };
    crate::courses::defer_structure_constraints(&mut *conn).await?;
    sqlx::query!(
        r#"
UPDATE pages
SET order_number = order_number + 1
WHERE course_id = $1
  AND chapter_id IS NOT DISTINCT FROM $2
  AND deleted_at IS NULL
  AND order_number >= $3
  AND id IS DISTINCT FROM $4
        "#,
        course_id,
        chapter_id,
        order_number,
        front_page.map(|p| p.id)
    )
    .execute(&mut *conn)
    .await?;
    Ok(order_number)
}

/// A path made from the title as for agent-created pages, under the chapter's path, with a numeric
/// suffix when a live page of the course has it already.
async fn unique_url_path(
    conn: &mut PgConnection,
    course_id: Uuid,
    chapter_number: Option<i32>,
    title: &str,
) -> ModelResult<String> {
    let taken: HashSet<String> = sqlx::query_scalar!(
        "SELECT url_path FROM pages WHERE course_id = $1 AND deleted_at IS NULL",
        course_id
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .collect();
    let slug = match slugify(title) {
        slug if slug.is_empty() => "page".to_string(),
        slug => slug,
    };
    let path_of = |segment: &str| match chapter_number {
        Some(number) => chapters::page_path(number, segment),
        None => format!("/{segment}"),
    };
    let path = |segment: &str| pages::normalize_url_path_for_storage(&path_of(segment));
    let segment = first_free_suffixed(&slug, |segment| taken.contains(&path(segment)));
    Ok(path(&segment))
}

#[derive(Debug, Serialize)]
struct CopiedExercise {
    source_exercise_id: Uuid,
    exercise_id: Uuid,
    /// `None` when the copy was left unlinked: the target course already had a counterpart, or the
    /// source exercise had no group.
    exercise_language_group_id: Option<Uuid>,
}

/// Moves each copy into its source exercise's language group, unless the target course already
/// has an exercise there, and removes the group update_page made for it.
async fn link_copied_exercises(
    conn: &mut PgConnection,
    source_page_id: Uuid,
    target_course_id: Uuid,
    copy_id: &dyn Fn(Uuid) -> Uuid,
) -> ModelResult<Vec<CopiedExercise>> {
    let sources = sqlx::query!(
        r#"
SELECT id,
  exercise_language_group_id
FROM exercises
WHERE page_id = $1
  AND deleted_at IS NULL
ORDER BY order_number,
  id
        "#,
        source_page_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut copied = Vec::with_capacity(sources.len());
    for source in sources {
        let exercise_id = copy_id(source.id);
        sqlx::query!(
            "UPDATE exercises SET copied_from = $2 WHERE id = $1",
            exercise_id,
            source.id
        )
        .execute(&mut *conn)
        .await?;
        let Some(group_id) = source.exercise_language_group_id else {
            copied.push(CopiedExercise {
                source_exercise_id: source.id,
                exercise_id,
                exercise_language_group_id: None,
            });
            continue;
        };
        let own_group_id = sqlx::query_scalar!(
            r#"SELECT exercise_language_group_id AS "id!" FROM exercises WHERE id = $1"#,
            exercise_id
        )
        .fetch_one(&mut *conn)
        .await?;
        sqlx::query!(
            "UPDATE exercises SET exercise_language_group_id = $2 WHERE id = $1",
            exercise_id,
            group_id
        )
        .execute(&mut *conn)
        .await?;
        // Locked after joining it, as with pages: see page_language_groups::course_has_other_page.
        sqlx::query!(
            "SELECT id FROM exercise_language_groups WHERE id = $1 FOR NO KEY UPDATE",
            group_id
        )
        .fetch_optional(&mut *conn)
        .await?;
        let has_counterpart = sqlx::query_scalar!(
            r#"
SELECT EXISTS (
    SELECT 1
    FROM exercises
    WHERE exercise_language_group_id = $1
      AND course_id = $2
      AND id <> $3
      AND deleted_at IS NULL
  ) AS "exists!"
            "#,
            group_id,
            target_course_id,
            exercise_id
        )
        .fetch_one(&mut *conn)
        .await?;
        if has_counterpart {
            sqlx::query!(
                "UPDATE exercises SET exercise_language_group_id = $2 WHERE id = $1",
                exercise_id,
                own_group_id
            )
            .execute(&mut *conn)
            .await?;
        } else {
            sqlx::query!(
                "DELETE FROM exercise_language_groups WHERE id = $1",
                own_group_id
            )
            .execute(&mut *conn)
            .await?;
        }
        copied.push(CopiedExercise {
            source_exercise_id: source.id,
            exercise_id,
            exercise_language_group_id: (!has_counterpart).then_some(group_id),
        });
    }
    Ok(copied)
}

async fn get_language_version_page(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<LanguageVersionPage> {
    let page = sqlx::query_as!(
        LanguageVersionPage,
        r#"
SELECT p.id AS "id!",
  p.course_id AS "course_id!",
  c.language_code AS "language_code!",
  p.title AS "title!",
  p.url_path AS "url_path!",
  p.chapter_id,
  ch.chapter_number AS "chapter_number?",
  ch.name AS "chapter_name?",
  (
    SELECT COUNT(*)
    FROM pages sibling
    WHERE sibling.course_id = p.course_id
      AND sibling.chapter_id IS NOT DISTINCT FROM p.chapter_id
      AND sibling.deleted_at IS NULL
      AND (sibling.order_number, sibling.id) <= (p.order_number, p.id)
  )::INTEGER AS "position!",
  COALESCE(ch.front_page_id = p.id, FALSE) AS "is_chapter_front_page!",
  p.page_language_group_id,
  (
    SELECT COUNT(*)
    FROM exercises e
    WHERE e.page_id = p.id
      AND e.deleted_at IS NULL
  ) AS "exercise_count!",
  FALSE AS "is_deleted!"
FROM pages p
  JOIN courses c ON c.id = p.course_id
  LEFT JOIN chapters ch ON ch.id = p.chapter_id
WHERE p.id = $1
        "#,
        page_id
    )
    .fetch_one(conn)
    .await?;
    Ok(page)
}

/// Which of the course's live exercises lack a counterpart in some other language version.
pub async fn get_exercise_counterparts(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<ExerciseCounterparts> {
    let language_codes = sqlx::query_scalar!(
        "
SELECT o.language_code
FROM courses c
  JOIN courses o ON o.course_language_group_id = c.course_language_group_id
WHERE c.id = $1
  AND o.id <> c.id
  AND o.deleted_at IS NULL
ORDER BY o.created_at,
  o.id
        ",
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let rows = sqlx::query!(
        r#"
SELECT e.id,
  ARRAY(
    SELECT o.language_code
    FROM courses o
    WHERE o.course_language_group_id = c.course_language_group_id
      AND o.id <> c.id
      AND o.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM exercises x
        WHERE x.exercise_language_group_id = e.exercise_language_group_id
          AND x.course_id = o.id
          AND x.deleted_at IS NULL
      )
    ORDER BY o.created_at,
      o.id
  ) AS "missing_language_codes!"
FROM exercises e
  JOIN courses c ON c.id = e.course_id
WHERE e.course_id = $1
  AND e.deleted_at IS NULL
  AND c.deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(ExerciseCounterparts {
        language_codes,
        missing_language_codes_by_exercise_id: rows
            .into_iter()
            .filter(|r| !r.missing_language_codes.is_empty())
            .map(|r| (r.id, r.missing_language_codes))
            .collect(),
    })
}
