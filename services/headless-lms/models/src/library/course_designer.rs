//! Turning a course design plan into a course.

use std::collections::HashSet;

use futures::future::BoxFuture;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::strings::{is_ietf_language_code_like, non_empty_trimmed, slugify};
use serde_json::json;
use url::Url;

use crate::{
    SpecFetcher,
    chapters::{self, NewChapter},
    course_designer_plans::{CourseDesignerStage, insert_plan_event},
    course_designer_stage_workspace::{
        AnalysisWorkspaceV1, CourseDesignerStageWorkspace, DesignWorkspaceV1, parse_workspace_data,
    },
    courses::{Course, NewCourse},
    exercise_service_info::ExerciseServiceInfoApi,
    library::content_management,
    pages::{self, NewPage},
    prelude::*,
    roles::{self, RoleDomain, UserRole},
};

const MAX_COURSE_NAME_CHARS: usize = 255;
const MAX_SLUG_CHARS: usize = 80;
const FALLBACK_LANGUAGE_CODE: &str = "en";

/// What the person creating a course from a plan chose in the dialog. Blank or missing values fall
/// back to the plan's Analysis form.
#[derive(Debug, Clone)]
pub struct CourseFromPlanOptions {
    pub organization_id: Uuid,
    pub name: Option<String>,
    pub language_code: Option<String>,
}

/// Creates a draft course from the plan's Design course structure: one chapter per planned chapter,
/// each with an Introduction page, one page per topic and a Conclusion page. The creator becomes a
/// teacher on the course and the plan remembers the course.
///
/// The caller must have checked that `user_id` may create courses in the organization. Fails if
/// the user is not a plan member or the plan already has a course.
pub async fn create_course_from_plan(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    plan_id: Uuid,
    user_id: Uuid,
    options: CourseFromPlanOptions,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> + Copy,
) -> ModelResult<Course> {
    let mut tx = conn.begin().await?;
    let plan =
        crate::course_designer_plan_members::lock_editable_plan_for_user(&mut tx, plan_id, user_id)
            .await?;
    if plan.created_course_id.is_some() {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "A course has already been created from this plan.".to_string(),
            None,
        ));
    }
    let (analysis, design) = get_analysis_and_design(&mut tx, plan_id).await?;

    let name = options
        .name
        .as_deref()
        .and_then(non_empty_trimmed)
        .or_else(|| analysis.course_title.as_deref().and_then(non_empty_trimmed))
        .or_else(|| plan.name.as_deref().and_then(non_empty_trimmed))
        .unwrap_or("Untitled course")
        .chars()
        .take(MAX_COURSE_NAME_CHARS)
        .collect::<String>();
    let language_code = options
        .language_code
        .as_deref()
        .and_then(non_empty_trimmed)
        .map(|code| {
            if is_ietf_language_code_like(code) {
                Ok(code.to_string())
            } else {
                Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Malformed language code.".to_string(),
                    None,
                ))
            }
        })
        .transpose()?
        .unwrap_or_else(|| language_code_from_analysis(analysis.language.as_deref()));
    let teacher = crate::user_details::get_user_details_by_user_id(&mut tx, user_id).await?;
    let teacher_name = crate::user_details::full_name_or_email(
        teacher.first_name.as_deref(),
        teacher.last_name.as_deref(),
        &teacher.email,
    );
    let slug = unique_course_slug(&mut tx, &name).await?;

    let new_course = NewCourse {
        name,
        slug,
        organization_id: options.organization_id,
        language_code,
        teacher_in_charge_name: teacher_name,
        teacher_in_charge_email: teacher.email,
        description: String::new(),
        is_draft: true,
        is_test_mode: false,
        is_unlisted: false,
        copy_user_permissions: false,
        is_joinable_by_code_only: false,
        join_code: None,
        ask_marketing_consent: false,
        flagged_answers_threshold: None,
        can_add_chatbot: false,
    };
    let (course, _front_page, _instance, default_module) = content_management::create_new_course(
        &mut tx,
        app_config,
        PKeyPolicy::Generate,
        new_course,
        user_id,
        &spec_fetcher,
        fetch_service_info,
    )
    .await?;
    roles::insert(
        &mut tx,
        user_id,
        UserRole::Teacher,
        RoleDomain::Course(course.id),
    )
    .await?;

    for (index, planned_chapter) in design.chapters.iter().enumerate() {
        let chapter_number = i32::try_from(index + 1).map_err(|_| {
            ModelError::new(
                ModelErrorType::InvalidRequest,
                "Too many chapters.".to_string(),
                None,
            )
        })?;
        let chapter_name = non_empty_trimmed(&planned_chapter.title)
            .map(str::to_string)
            .unwrap_or_else(|| format!("Chapter {chapter_number}"));
        let (chapter, _) = content_management::create_new_chapter(
            &mut tx,
            PKeyPolicy::Generate,
            &NewChapter {
                name: chapter_name,
                color: None,
                course_id: course.id,
                chapter_number,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(default_module.id),
            },
            user_id,
            &spec_fetcher,
            fetch_service_info,
        )
        .await?;

        let page_titles = std::iter::once("Introduction")
            .chain(
                planned_chapter
                    .topics
                    .iter()
                    .filter_map(|topic| non_empty_trimmed(&topic.title)),
            )
            .chain(std::iter::once("Conclusion"));
        let mut used_segments = HashSet::new();
        for title in page_titles {
            let segment = unique_segment(&mut used_segments, title);
            pages::insert_new_content_page(
                &mut tx,
                NewPage {
                    exercises: vec![],
                    exercise_slides: vec![],
                    exercise_tasks: vec![],
                    content: vec![],
                    url_path: chapters::page_path(chapter_number, &segment),
                    title: title.to_string(),
                    course_id: Some(course.id),
                    exam_id: None,
                    chapter_id: Some(chapter.id),
                    front_page_of_chapter_id: None,
                    content_search_language: None,
                    hidden: false,
                },
                user_id,
                &spec_fetcher,
                fetch_service_info,
            )
            .await?;
        }
    }

    sqlx::query!(
        r#"
UPDATE course_designer_plans
SET created_course_id = $2
WHERE id = $1
"#,
        plan_id,
        course.id
    )
    .execute(&mut *tx)
    .await?;
    insert_plan_event(
        &mut tx,
        plan_id,
        Some(user_id),
        "course_created",
        Some(CourseDesignerStage::Design),
        json!({ "course_id": course.id, "chapter_count": design.chapters.len() }),
    )
    .await?;
    tx.commit().await?;
    Ok(course)
}

/// The plan's saved Analysis and Design forms, empty when not saved yet.
async fn get_analysis_and_design(
    conn: &mut PgConnection,
    plan_id: Uuid,
) -> ModelResult<(AnalysisWorkspaceV1, DesignWorkspaceV1)> {
    let rows = sqlx::query!(
        r#"
SELECT workspace_data
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1
  AND stage IN ('analysis', 'design')
  AND deleted_at IS NULL
"#,
        plan_id
    )
    .fetch_all(conn)
    .await?;
    let mut analysis = AnalysisWorkspaceV1::default();
    let mut design = DesignWorkspaceV1::default();
    for row in rows {
        match parse_workspace_data(row.workspace_data)? {
            Some(CourseDesignerStageWorkspace::AnalysisV1(a)) => analysis = a,
            Some(CourseDesignerStageWorkspace::DesignV1(d)) => design = d,
            None => {}
        }
    }
    Ok((analysis, design))
}

/// The Analysis form's language is free text, so accept a code or a few common language names.
fn language_code_from_analysis(language: Option<&str>) -> String {
    let Some(language) = language.and_then(non_empty_trimmed) else {
        return FALLBACK_LANGUAGE_CODE.to_string();
    };
    if is_ietf_language_code_like(language) {
        return language.to_string();
    }
    match language.to_lowercase().as_str() {
        "finnish" | "suomi" | "suomeksi" => "fi",
        "swedish" | "svenska" | "ruotsi" => "sv",
        _ => FALLBACK_LANGUAGE_CODE,
    }
    .to_string()
}

fn truncated_slug(title: &str, fallback: &str) -> String {
    let slug: String = slugify(title).chars().take(MAX_SLUG_CHARS).collect();
    let slug = slug.trim_end_matches('-');
    if slug.is_empty() {
        fallback.to_string()
    } else {
        slug.to_string()
    }
}

fn unique_segment(used_segments: &mut HashSet<String>, title: &str) -> String {
    let base = truncated_slug(title, "page");
    let mut candidate = base.clone();
    let mut suffix = 2;
    while !used_segments.insert(candidate.clone()) {
        candidate = format!("{base}-{suffix}");
        suffix += 1;
    }
    candidate
}

/// A slug free in both `courses` and `course_language_groups`, which a new course takes from it.
async fn unique_course_slug(conn: &mut PgConnection, name: &str) -> ModelResult<String> {
    let base = truncated_slug(name, "course");
    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let is_taken = sqlx::query_scalar!(
            r#"
SELECT (
    EXISTS (
      SELECT 1
      FROM courses
      WHERE slug = $1
        AND deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM course_language_groups
      WHERE slug = $1
        AND deleted_at IS NULL
    )
  ) AS "is_taken!"
"#,
            candidate
        )
        .fetch_one(&mut *conn)
        .await?;
        if !is_taken {
            return Ok(candidate);
        }
        candidate = format!("{base}-{suffix}");
        suffix += 1;
    }
}

/// What one plan's weekly progress email reports.
#[derive(Debug, Clone)]
pub struct WeeklyDigest {
    pub plan_id: Uuid,
    pub plan_name: Option<String>,
    pub active_stage: Option<CourseDesignerStage>,
    pub active_stage_planned_ends_on: Option<chrono::NaiveDate>,
    /// Members who have not opted out.
    pub recipient_user_ids: Vec<Uuid>,
    pub tasks_completed_since: Vec<String>,
    pub task_count: i64,
    pub completed_task_count: i64,
    /// Stages with at least one section marked unfinished, with how many, in workflow order.
    pub unfinished_section_counts: Vec<(CourseDesignerStage, i64)>,
    /// Picked from the Analysis form's course language, which is the best hint of the team's language.
    pub language_code: String,
}

/// In-progress plans whose last weekly email is older than six days or that never got one. Six
/// rather than seven so a weekly job running a little early still sends.
pub async fn get_plan_ids_due_for_weekly_digest(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query_scalar!(
        r#"
SELECT id
FROM course_designer_plans
WHERE status = 'in_progress'
  AND deleted_at IS NULL
  AND (
    last_weekly_stage_email_sent_at IS NULL
    OR last_weekly_stage_email_sent_at < $1::TIMESTAMPTZ - INTERVAL '6 days'
  )
ORDER BY id
"#,
        now
    )
    .fetch_all(conn)
    .await?;
    Ok(ids)
}

/// Gathers a plan's weekly email content: task completions since the previous email, or the past
/// week for the first one. Locks the plan row, so call it in the transaction that queues the email
/// and calls [`mark_weekly_digest_sent`].
pub async fn get_weekly_digest(
    conn: &mut PgConnection,
    plan_id: Uuid,
    now: DateTime<Utc>,
) -> ModelResult<WeeklyDigest> {
    let plan = sqlx::query!(
        r#"
SELECT
  p.name,
  p.active_stage AS "active_stage: CourseDesignerStage",
  p.last_weekly_stage_email_sent_at,
  s.planned_ends_on AS "active_stage_planned_ends_on?"
FROM course_designer_plans p
LEFT JOIN course_designer_plan_stages s
  ON s.course_designer_plan_id = p.id
  AND s.stage = p.active_stage
  AND s.deleted_at IS NULL
WHERE p.id = $1
  AND p.deleted_at IS NULL
FOR UPDATE OF p
"#,
        plan_id
    )
    .fetch_one(&mut *conn)
    .await?;
    let since = plan
        .last_weekly_stage_email_sent_at
        .unwrap_or(now - chrono::Duration::days(7));
    let recipient_user_ids = sqlx::query_scalar!(
        r#"
SELECT m.user_id
FROM course_designer_plan_members m
JOIN users u ON u.id = m.user_id
WHERE m.course_designer_plan_id = $1
  AND m.receives_weekly_digest
  AND m.deleted_at IS NULL
  AND u.deleted_at IS NULL
ORDER BY m.created_at, m.id
"#,
        plan_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let task_counts = sqlx::query!(
        r#"
SELECT COUNT(*)::BIGINT AS "task_count!",
  COUNT(*) FILTER (WHERE t.is_completed)::BIGINT AS "completed_task_count!"
FROM course_designer_plan_stage_tasks t
JOIN course_designer_plan_stages s ON s.id = t.course_designer_plan_stage_id
WHERE s.course_designer_plan_id = $1
  AND s.deleted_at IS NULL
  AND t.deleted_at IS NULL
"#,
        plan_id
    )
    .fetch_one(&mut *conn)
    .await?;
    let tasks_completed_since = sqlx::query_scalar!(
        r#"
SELECT t.title
FROM course_designer_plan_stage_tasks t
JOIN course_designer_plan_stages s ON s.id = t.course_designer_plan_stage_id
WHERE s.course_designer_plan_id = $1
  AND s.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND t.is_completed
  AND t.completed_at > $2
ORDER BY t.completed_at, t.order_number
"#,
        plan_id,
        since
    )
    .fetch_all(&mut *conn)
    .await?;
    let unfinished_rows = sqlx::query!(
        r#"
SELECT stage AS "stage: CourseDesignerStage",
  COUNT(*)::BIGINT AS "count!"
FROM course_designer_plan_section_statuses
WHERE course_designer_plan_id = $1
  AND status = 'unfinished'
  AND deleted_at IS NULL
GROUP BY stage
ORDER BY stage
"#,
        plan_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let analysis_language = sqlx::query_scalar!(
        r#"
SELECT workspace_data->'payload'->>'language' AS language
FROM course_designer_plan_stages
WHERE course_designer_plan_id = $1
  AND stage = 'analysis'
  AND workspace_data->>'schema' = 'analysis_v1'
  AND deleted_at IS NULL
"#,
        plan_id
    )
    .fetch_optional(&mut *conn)
    .await?
    .flatten();

    Ok(WeeklyDigest {
        plan_id,
        plan_name: plan.name,
        active_stage: plan.active_stage,
        active_stage_planned_ends_on: plan.active_stage_planned_ends_on,
        recipient_user_ids,
        tasks_completed_since,
        task_count: task_counts.task_count,
        completed_task_count: task_counts.completed_task_count,
        unfinished_section_counts: unfinished_rows
            .into_iter()
            .map(|r| (r.stage, r.count))
            .collect(),
        language_code: language_code_from_analysis(analysis_language.as_deref()),
    })
}

/// Records that the plan's weekly email went out, which keeps it out of the next run.
pub async fn mark_weekly_digest_sent(
    conn: &mut PgConnection,
    plan_id: Uuid,
    sent_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_designer_plans
SET last_weekly_stage_email_sent_at = $2
WHERE id = $1
"#,
        plan_id,
        sent_at
    )
    .execute(conn)
    .await?;
    Ok(())
}
