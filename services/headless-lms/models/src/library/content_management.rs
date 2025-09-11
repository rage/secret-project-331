use futures::future::BoxFuture;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use url::Url;

use crate::{
    SpecFetcher,
    chapters::{self, DatabaseChapter, NewChapter},
    course_instances::{CourseInstance, NewCourseInstance},
    course_language_groups,
    course_modules::{CourseModule, NewCourseModule},
    courses::{self, Course, NewCourse},
    exercise_service_info::ExerciseServiceInfoApi,
    pages::{self, NewPage, Page},
    peer_or_self_review_questions::CmsPeerOrSelfReviewQuestion,
    prelude::*,
};

#[derive(Debug, Clone)]
pub struct CreateNewCourseFixedIds {
    pub course_id: Uuid,
    pub default_course_instance_id: Uuid,
}

/// Creates a new course with a front page and default instances.
pub async fn create_new_course(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<CreateNewCourseFixedIds>,
    new_course: NewCourse,
    user: Uuid,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<(Course, Page, CourseInstance, CourseModule)> {
    let mut tx = conn.begin().await?;

    let course_language_group_id =
        course_language_groups::insert(&mut tx, PKeyPolicy::Generate).await?;

    let course_id = courses::insert(
        &mut tx,
        pkey_policy.map_ref(|x| x.course_id),
        course_language_group_id,
        &new_course,
    )
    .await?;
    let course = courses::get_course(&mut tx, course_id).await?;

    // Create front page for course
    let course_front_page_content = serde_json::to_value(vec![
        GutenbergBlock::landing_page_hero_section("Welcome to...", "Subheading"),
        GutenbergBlock::landing_page_copy_text("About this course", "This course teaches you xxx."),
        GutenbergBlock::course_objective_section(),
        GutenbergBlock::empty_block_from_name("moocfi/course-chapter-grid".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/top-level-pages".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/congratulations".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/course-progress".to_string()),
    ])?;

    let course_front_page = NewPage {
        chapter_id: None,
        content: course_front_page_content,
        course_id: Some(course.id),
        exam_id: None,
        front_page_of_chapter_id: None,
        title: course.name.clone(),
        url_path: String::from("/"),
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content_search_language: None,
    };
    let page = crate::pages::insert_page(
        &mut tx,
        course_front_page,
        user,
        spec_fetcher,
        fetch_service_info,
    )
    .await?;

    // Create default course instance
    let default_course_instance = crate::course_instances::insert(
        &mut tx,
        pkey_policy.map_ref(|x| x.default_course_instance_id),
        NewCourseInstance {
            course_id: course.id,
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

    // Create default course module
    let default_module = crate::course_modules::insert(
        &mut tx,
        PKeyPolicy::Generate,
        &NewCourseModule::new_course_default(course.id).set_ects_credits(Some(5.0)),
    )
    .await?;

    // Create course default peer review config
    let peer_or_self_review_config_id =
        crate::peer_or_self_review_configs::insert(&mut tx, PKeyPolicy::Generate, course.id, None)
            .await?;

    // Create peer review questions for default peer review config
    crate::peer_or_self_review_questions::upsert_multiple_peer_or_self_review_questions(
        &mut tx,
        &[
            CmsPeerOrSelfReviewQuestion {
                id: Uuid::new_v4(),
                peer_or_self_review_config_id,
                order_number: 0,
                question: "General comments".to_string(),
                question_type:
                    crate::peer_or_self_review_questions::PeerOrSelfReviewQuestionType::Essay,
                answer_required: false,
                weight: 0.0,
            },
            CmsPeerOrSelfReviewQuestion {
                id: Uuid::new_v4(),
                peer_or_self_review_config_id,
                order_number: 1,
                question: "The answer was correct".to_string(),
                question_type:
                    crate::peer_or_self_review_questions::PeerOrSelfReviewQuestionType::Scale,
                answer_required: true,
                weight: 0.0,
            },
            CmsPeerOrSelfReviewQuestion {
                id: Uuid::new_v4(),
                peer_or_self_review_config_id,
                order_number: 2,
                question: "The answer was easy to read".to_string(),
                question_type:
                    crate::peer_or_self_review_questions::PeerOrSelfReviewQuestionType::Scale,
                answer_required: true,
                weight: 0.0,
            },
        ],
    )
    .await?;

    tx.commit().await?;
    Ok((course, page, default_course_instance, default_module))
}

/// Creates a new chapter with a front page.
pub async fn create_new_chapter(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<(Uuid, Uuid)>,
    new_chapter: &NewChapter,
    user: Uuid,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<(DatabaseChapter, Page)> {
    create_new_chapter_with_content(
        conn,
        pkey_policy,
        new_chapter,
        user,
        spec_fetcher,
        fetch_service_info,
        None,
    )
    .await
}

/// Creates a new chapter with a front page and optional custom content.
pub async fn create_new_chapter_with_content(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<(Uuid, Uuid)>,
    new_chapter: &NewChapter,
    user: Uuid,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
    custom_front_page_content: Option<Vec<GutenbergBlock>>,
) -> ModelResult<(DatabaseChapter, Page)> {
    let mut tx = conn.begin().await?;
    let chapter_id = chapters::insert(&mut tx, pkey_policy.map_ref(|x| x.0), new_chapter).await?;
    let chapter = chapters::get_chapter(&mut tx, chapter_id).await?;

    let default_front_page_content = vec![
        GutenbergBlock::hero_section(&chapter.name, ""),
        GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string()),
    ];

    let front_page_blocks = custom_front_page_content.unwrap_or(default_front_page_content);
    let chapter_frontpage_content = serde_json::to_value(front_page_blocks)?;
    let chapter_frontpage = NewPage {
        chapter_id: Some(chapter.id),
        content: chapter_frontpage_content,
        course_id: Some(chapter.course_id),
        exam_id: None,
        front_page_of_chapter_id: Some(chapter.id),
        title: chapter.name.clone(),
        url_path: format!("/chapter-{}", chapter.chapter_number),
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content_search_language: None,
    };

    let page = match pkey_policy {
        PKeyPolicy::Fixed((_, front_page_id)) => {
            // Create page with fixed ID
            let page_language_group_id = if let Some(course_id) = chapter_frontpage.course_id {
                let course = crate::courses::get_course(&mut tx, course_id).await?;
                let new_language_group_id = crate::page_language_groups::insert(
                    &mut tx,
                    crate::PKeyPolicy::Generate,
                    course.course_language_group_id,
                )
                .await?;
                Some(new_language_group_id)
            } else {
                None
            };

            let content_search_language = chapter_frontpage
                .content_search_language
                .unwrap_or_else(|| "simple".to_string());

            let page = sqlx::query_as!(
                Page,
                r#"
INSERT INTO pages(
    id,
    course_id,
    exam_id,
    content,
    url_path,
    title,
    order_number,
    chapter_id,
    content_search_language,
    page_language_group_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from,
  hidden,
  page_language_group_id
"#,
                front_page_id,
                chapter_frontpage.course_id,
                chapter_frontpage.exam_id,
                chapter_frontpage.content,
                chapter_frontpage.url_path.trim(),
                chapter_frontpage.title.trim(),
                0i32,
                chapter_frontpage.chapter_id,
                content_search_language as _,
                page_language_group_id
            )
            .fetch_one(&mut *tx)
            .await?;

            // Create page history
            let _history_id = crate::page_history::insert(
                &mut tx,
                PKeyPolicy::Generate,
                page.id,
                page.title.as_str(),
                &crate::page_history::PageHistoryContent {
                    content: page.content.clone(),
                    exercises: chapter_frontpage.exercises,
                    exercise_slides: chapter_frontpage.exercise_slides,
                    exercise_tasks: chapter_frontpage.exercise_tasks,
                    peer_or_self_review_configs: vec![],
                    peer_or_self_review_questions: vec![],
                },
                crate::page_history::HistoryChangeReason::PageSaved,
                user,
                None,
            )
            .await?;

            page
        }
        PKeyPolicy::Generate => {
            pages::insert_page(
                &mut tx,
                chapter_frontpage,
                user,
                spec_fetcher,
                fetch_service_info,
            )
            .await?
        }
    };

    sqlx::query!(
        "UPDATE chapters SET front_page_id = $1 WHERE id = $2",
        page.id,
        chapter.id
    )
    .execute(&mut *tx)
    .await?;

    let updated_chapter = chapters::get_chapter(&mut tx, chapter.id).await?;

    tx.commit().await?;
    Ok((updated_chapter, page))
}
