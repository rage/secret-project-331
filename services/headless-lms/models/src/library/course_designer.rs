//! Turning a course design plan into a course.

use std::collections::HashSet;

use futures::future::BoxFuture;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use headless_lms_utils::strings::{is_ietf_language_code_like, non_empty_trimmed, slugify};
use serde_json::json;
use url::Url;

use crate::{
    SpecFetcher,
    chapters::{self, NewChapter},
    chatbot_configurations::{self, NewChatbotConf},
    course_designer_plans::{
        CourseDesignerPlan, CourseDesignerPlanStageStatus, CourseDesignerStage, insert_plan_event,
    },
    course_designer_stage_workspace::{
        AnalysisWorkspaceV1, CourseDesignerStageWorkspace, DesignChapter, DesignWorkspaceV1,
        parse_workspace_data,
    },
    courses::{Course, NewCourse},
    exercise_service_info::ExerciseServiceInfoApi,
    library::{
        content_management::{self, NewCourseContent},
        course_designer_course_content::{self as course_content, CourseCopy},
        course_designer_course_status::{self, CourseDesignerCourseStatus},
    },
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
    /// Gives every other plan member the Teacher role on the new course.
    pub should_give_members_course_roles: bool,
}

/// The plan a course is created from, read once so that the AI drafts and the course itself come
/// from the same plan.
#[derive(Debug, Clone)]
pub struct CourseFromPlanSource {
    pub plan_id: Uuid,
    pub course_name: String,
    pub language_code: String,
    pub great_mooc_vision: Option<String>,
    pub analysis: AnalysisWorkspaceV1,
    pub design: DesignWorkspaceV1,
}

impl CourseFromPlanSource {
    /// The non-blank course learning goals, each of which gets a front page column.
    pub fn learning_goals(&self) -> Vec<&str> {
        self.design
            .learning_goals
            .iter()
            .filter_map(|goal| non_empty_trimmed(goal))
            .collect()
    }

    /// Whether the course gets a chatbot and a drafted chatbot configuration.
    pub fn has_planned_chatbot(&self) -> bool {
        self.design.planned_content_formats.chatbots
    }
}

/// The non-blank topic titles of a planned chapter; each becomes a topic page.
pub fn chapter_topic_titles(chapter: &DesignChapter) -> Vec<&str> {
    chapter
        .topics
        .iter()
        .filter_map(|topic| non_empty_trimmed(&topic.title))
        .collect()
}

/// Course-level texts an AI drafted from the plan, in the course's language.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CourseDraft {
    /// The catalog description.
    pub description: String,
    pub hero_subtitle: String,
    pub about_text: String,
    /// One per [`CourseFromPlanSource::learning_goals`], in order.
    pub learning_goal_headings: Vec<String>,
    pub how_to_study_paragraphs: Vec<String>,
    /// Present when [`CourseFromPlanSource::has_planned_chatbot`].
    #[serde(default)]
    pub chatbot: Option<ChatbotDraft>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatbotDraft {
    pub name: String,
    pub prompt: String,
    pub initial_message: String,
    pub suggested_messages: Vec<String>,
}

/// Texts an AI drafted for one planned chapter, in the course's language.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChapterDraft {
    pub prior_learning_heading: String,
    pub prior_learning_questions: Vec<String>,
    /// One per [`chapter_topic_titles`], in order.
    pub topic_outlines: Vec<TopicOutline>,
}

/// What a topic page should cover: headings with points, not prose.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct TopicOutline {
    pub sections: Vec<TopicOutlineSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TopicOutlineSection {
    pub heading: String,
    pub points: Vec<String>,
}

/// Everything an AI drafted for a course from a plan.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CourseFromPlanDrafts {
    pub course: CourseDraft,
    /// One per planned chapter, in order.
    pub chapters: Vec<ChapterDraft>,
}

/// Reads the plan a course is about to be created from, for drafting its texts before
/// [`create_course_from_plan`].
///
/// Fails like [`create_course_from_plan`] when no course may be created from the plan, so the
/// caller does not draft for nothing.
pub async fn get_course_from_plan_source(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
    options: &CourseFromPlanOptions,
) -> ModelResult<CourseFromPlanSource> {
    let mut tx = conn.begin().await?;
    let plan =
        crate::course_designer_plan_members::lock_editable_plan_for_user(&mut tx, plan_id, user_id)
            .await?;
    ensure_course_can_be_created(&mut tx, &plan).await?;
    let (analysis, design) = get_analysis_and_design(&mut tx, plan_id).await?;
    if design.planned_content_formats.chatbots {
        default_chatbot_model(&mut tx).await?;
    }
    tx.commit().await?;

    let course_name = options
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
                Err(model_err!(
                    InvalidRequest,
                    "Malformed language code.".to_string()
                ))
            }
        })
        .transpose()?
        .unwrap_or_else(|| language_code_from_analysis(analysis.language.as_deref()));
    Ok(CourseFromPlanSource {
        plan_id,
        course_name,
        language_code,
        great_mooc_vision: plan.great_mooc_vision,
        analysis,
        design,
    })
}

/// A plan has at most one live course, and gets one only once Design is done.
async fn ensure_course_can_be_created(
    conn: &mut PgConnection,
    plan: &CourseDesignerPlan,
) -> ModelResult<()> {
    let row = sqlx::query!(
        r#"
SELECT (c.id IS NOT NULL) AS "has_live_course!",
  (
    SELECT s.status
    FROM course_designer_plan_stages s
    WHERE s.course_designer_plan_id = p.id
      AND s.stage = 'design'
      AND s.deleted_at IS NULL
  ) AS design_status
FROM course_designer_plans p
  LEFT JOIN courses c ON c.id = p.created_course_id
  AND c.deleted_at IS NULL
WHERE p.id = $1
  AND p.deleted_at IS NULL
"#,
        plan.id
    )
    .fetch_one(conn)
    .await?;
    if row.has_live_course {
        return Err(model_err!(
            PreconditionFailed,
            "A course has already been created from this plan.".to_string()
        ));
    }
    if row.design_status != Some(CourseDesignerPlanStageStatus::Completed) {
        return Err(model_err!(
            PreconditionFailed,
            "The course can be created once the Design phase is done.".to_string()
        ));
    }
    Ok(())
}

async fn default_chatbot_model(
    conn: &mut PgConnection,
) -> ModelResult<crate::chatbot_configurations_models::ChatbotConfigurationModel> {
    crate::chatbot_configurations_models::get_default(conn)
        .await
        .map_err(|e| {
            model_err!(
                PreconditionFailed,
                "No default chatbot model is configured, so the planned chatbot cannot be created."
                    .to_string(),
                e
            )
        })
}

/// Creates a draft course from a plan read with [`get_course_from_plan_source`] and the texts an
/// AI drafted from it: one chapter per planned chapter, each with an Introduction page, one page
/// per topic and a Conclusion page, plus the front page, Contributors and How to study pages,
/// glossary, chapter colours and, when planned, a disabled chatbot. The creator becomes a teacher
/// on the course and the plan remembers the course.
///
/// The caller must have checked that `user_id` may create courses in the organization. Fails if
/// the user is not a plan member, Design is not done or the plan already has a course.
#[allow(clippy::too_many_arguments)]
pub async fn create_course_from_plan(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    user_id: Uuid,
    options: &CourseFromPlanOptions,
    source: &CourseFromPlanSource,
    drafts: &CourseFromPlanDrafts,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> + Copy,
) -> ModelResult<Course> {
    let plan_id = source.plan_id;
    let mut tx = conn.begin().await?;
    let plan =
        crate::course_designer_plan_members::lock_editable_plan_for_user(&mut tx, plan_id, user_id)
            .await?;
    ensure_course_can_be_created(&mut tx, &plan).await?;
    let (analysis, design) = (&source.analysis, &source.design);
    let copy = CourseCopy::for_language(&source.language_code);

    let teacher = crate::user_details::get_user_details_by_user_id(&mut tx, user_id).await?;
    let teacher_name = crate::user_details::full_name_or_email(
        teacher.first_name.as_deref(),
        teacher.last_name.as_deref(),
        &teacher.email,
    );
    let slug = unique_course_slug(&mut tx, &source.course_name).await?;

    let new_course = NewCourse {
        name: source.course_name.clone(),
        slug,
        organization_id: options.organization_id,
        language_code: source.language_code.clone(),
        teacher_in_charge_name: teacher_name,
        teacher_in_charge_email: teacher.email,
        description: drafts.course.description.trim().to_string(),
        is_draft: true,
        is_test_mode: false,
        is_unlisted: false,
        copy_user_permissions: false,
        is_joinable_by_code_only: false,
        join_code: None,
        ask_marketing_consent: false,
        flagged_answers_threshold: None,
        can_add_chatbot: source.has_planned_chatbot(),
    };
    let ects_credits = analysis
        .credits
        .filter(|credits| *credits > 0.0)
        .map(|credits| credits as f32);
    let (course, _front_page, _instance, default_module) =
        content_management::create_new_course_with_content(
            &mut tx,
            app_config,
            PKeyPolicy::Generate,
            new_course,
            user_id,
            NewCourseContent {
                front_page_content: Some(course_content::front_page_content(
                    copy,
                    &source.course_name,
                    &source.learning_goals(),
                    &drafts.course,
                )),
                default_module_ects_credits: ects_credits,
            },
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
    if options.should_give_members_course_roles {
        let members =
            crate::course_designer_plan_members::get_plan_members(&mut tx, plan_id).await?;
        for member in members.iter().filter(|member| member.user_id != user_id) {
            roles::insert(
                &mut tx,
                member.user_id,
                UserRole::Teacher,
                RoleDomain::Course(course.id),
            )
            .await?;
        }
    }

    let chapter_colors = course_content::chapter_colors(&design.style_guide.colour_palette);
    if drafts.chapters.len() != design.chapters.len() {
        return Err(model_err!(
            InvalidRequest,
            "The drafts must have one chapter draft per planned chapter.".to_string()
        ));
    }
    for (index, planned_chapter) in design.chapters.iter().enumerate() {
        let chapter_number = i32::try_from(index + 1)
            .map_err(|_| model_err!(InvalidRequest, "Too many chapters.".to_string()))?;
        let chapter_name = non_empty_trimmed(&planned_chapter.title)
            .map(str::to_string)
            .unwrap_or_else(|| format!("Chapter {chapter_number}"));
        let color = (!chapter_colors.is_empty())
            .then(|| chapter_colors[index % chapter_colors.len()].clone());
        let objectives = course_content::learning_objectives(planned_chapter);
        let (chapter, _) = content_management::create_new_chapter_with_content(
            &mut tx,
            PKeyPolicy::Generate,
            &NewChapter {
                name: chapter_name.clone(),
                color: color.clone(),
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
            Some(course_content::chapter_front_page_content(
                &chapter_name,
                &objectives,
                color.as_deref(),
            )),
        )
        .await?;

        let chapter_draft = &drafts.chapters[index];
        let topic_titles = chapter_topic_titles(planned_chapter);
        let mut pages_to_insert = Vec::with_capacity(topic_titles.len() + 2);
        pages_to_insert.push((
            copy.introduction_title,
            course_content::introduction_content(copy, chapter_draft),
        ));
        for (topic_index, title) in topic_titles.iter().enumerate() {
            let outline = chapter_draft
                .topic_outlines
                .get(topic_index)
                .cloned()
                .unwrap_or_default();
            pages_to_insert.push((*title, course_content::topic_content(copy, title, &outline)));
        }
        pages_to_insert.push((
            copy.conclusion_title,
            course_content::conclusion_content(copy, &objectives),
        ));
        let mut used_segments = HashSet::new();
        for (title, content) in pages_to_insert {
            let segment = unique_segment(&mut used_segments, title);
            insert_generated_page(
                &mut tx,
                NewPage {
                    url_path: chapters::page_path(chapter_number, &segment),
                    title: title.to_string(),
                    chapter_id: Some(chapter.id),
                    ..generated_page(course.id, content)
                },
                user_id,
                &spec_fetcher,
                fetch_service_info,
            )
            .await?;
        }
    }

    for (title, content) in [
        (
            copy.how_to_study_title,
            course_content::how_to_study_content(copy, &drafts.course, &design.workload_activities),
        ),
        (
            copy.contributors_title,
            course_content::contributors_content(copy, analysis),
        ),
    ] {
        insert_generated_page(
            &mut tx,
            NewPage {
                url_path: format!("/{}", truncated_slug(title, "page")),
                title: title.to_string(),
                chapter_id: None,
                ..generated_page(course.id, content)
            },
            user_id,
            &spec_fetcher,
            fetch_service_info,
        )
        .await?;
    }

    for (term, definition) in
        course_content::glossary_entries(&design.style_guide.terminology_and_acronyms)
    {
        crate::glossary::insert(&mut tx, &term, &definition, course.id).await?;
    }

    if let Some(chatbot) = drafts
        .course
        .chatbot
        .as_ref()
        .filter(|_| source.has_planned_chatbot())
    {
        let model = default_chatbot_model(&mut tx).await?;
        chatbot_configurations::insert(
            &mut tx,
            PKeyPolicy::Generate,
            NewChatbotConf {
                chatbot_name: chatbot.name.trim().to_string(),
                course_id: Some(course.id),
                model_id: model.id,
                enabled_to_students: false,
                // The course has no content to search yet; the teacher turns search on later.
                use_azure_search: false,
                maintain_azure_search_index: false,
                prompt: chatbot.prompt.trim().to_string(),
                initial_message: chatbot.initial_message.trim().to_string(),
                initial_suggested_messages: Some(chatbot.suggested_messages.clone()),
                ..Default::default()
            },
        )
        .await?;
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
        plan.active_stage,
        json!({ "course_id": course.id, "chapter_count": design.chapters.len() }),
    )
    .await?;
    tx.commit().await?;
    Ok(course)
}

/// A visible page of the course with `content`; the caller sets its place.
fn generated_page(course_id: Uuid, content: Vec<GutenbergBlock>) -> NewPage {
    NewPage {
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content,
        url_path: String::new(),
        title: String::new(),
        course_id: Some(course_id),
        exam_id: None,
        chapter_id: None,
        front_page_of_chapter_id: None,
        content_search_language: None,
        hidden: false,
    }
}

/// Inserts a generated page; empty content gets the page title as its hero section.
async fn insert_generated_page(
    conn: &mut PgConnection,
    page: NewPage,
    user_id: Uuid,
    spec_fetcher: &impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<()> {
    if page.content.is_empty() {
        pages::insert_new_content_page(conn, page, user_id, spec_fetcher, fetch_service_info)
            .await?;
    } else {
        pages::insert_page(conn, page, user_id, spec_fetcher, fetch_service_info).await?;
    }
    Ok(())
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
    /// Automatic tasks count when their check passes on the course.
    pub completed_task_count: i64,
    /// `None` until the plan has a course.
    pub course_status: Option<CourseDesignerCourseStatus>,
    /// Picked from the Analysis form's course language, which is the best hint of the team's language.
    pub language_code: String,
}

/// In-progress plans due a weekly email: today (Helsinki time) is within the plan's schedule, and
/// the last email is older than six days or none was sent. Six so a slightly early run still sends.
pub async fn get_plan_ids_due_for_weekly_digest(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query_scalar!(
        r#"
SELECT p.id
FROM course_designer_plans p
  JOIN course_designer_plan_stages s ON s.course_designer_plan_id = p.id
  AND s.deleted_at IS NULL
WHERE p.status = 'in_progress'
  AND p.deleted_at IS NULL
  AND (
    p.last_weekly_stage_email_sent_at IS NULL
    OR p.last_weekly_stage_email_sent_at < $1::TIMESTAMPTZ - INTERVAL '6 days'
  )
GROUP BY p.id
HAVING ($1::TIMESTAMPTZ AT TIME ZONE 'Europe/Helsinki')::DATE BETWEEN MIN(s.planned_starts_on) AND MAX(s.planned_ends_on)
ORDER BY p.id
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
  COUNT(*) FILTER (
    WHERE t.is_completed
      AND t.automatic_check IS NULL
  )::BIGINT AS "completed_task_count!",
  COALESCE(
    ARRAY_AGG(t.automatic_check) FILTER (WHERE t.automatic_check IS NOT NULL),
    '{}'
  ) AS "automatic_checks!"
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
    let course_status = course_designer_course_status::get_for_plan(&mut *conn, plan_id).await?;
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
        completed_task_count: task_counts.completed_task_count
            + course_designer_course_status::count_passed_checks(
                course_status.as_ref(),
                &task_counts.automatic_checks,
            ),
        course_status,
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
