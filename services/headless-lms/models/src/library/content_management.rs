use headless_lms_utils::document_schema_processor::GutenbergBlock;

use crate::{
    chapters::{self, DatabaseChapter, NewChapter},
    course_instances::{CourseInstance, NewCourseInstance},
    course_language_groups,
    course_modules::CourseModule,
    courses::{self, Course, NewCourse},
    pages::{self, NewPage, Page},
    peer_review_questions::CmsPeerReviewQuestion,
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
    let page = crate::pages::insert_page(&mut tx, course_front_page, user).await?;

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
    let default_module =
        crate::course_modules::insert(&mut tx, PKeyPolicy::Generate, course.id, None, 0).await?;

    // Create course default peer review config
    let peer_review_config_id =
        crate::peer_review_configs::insert(&mut tx, PKeyPolicy::Generate, course.id, None).await?;

    // Create peer review questions for default peer review config
    crate::peer_review_questions::upsert_multiple_peer_review_questions(
        &mut tx,
        &[
            CmsPeerReviewQuestion {
                id: Uuid::new_v4(),
                peer_review_config_id,
                order_number: 0,
                question: "General comments".to_string(),
                question_type: crate::peer_review_questions::PeerReviewQuestionType::Essay,
                answer_required: false,
            },
            CmsPeerReviewQuestion {
                id: Uuid::new_v4(),
                peer_review_config_id,
                order_number: 1,
                question: "The answer was correct".to_string(),
                question_type: crate::peer_review_questions::PeerReviewQuestionType::Scale,
                answer_required: true,
            },
            CmsPeerReviewQuestion {
                id: Uuid::new_v4(),
                peer_review_config_id,
                order_number: 2,
                question: "The answer was easy to read".to_string(),
                question_type: crate::peer_review_questions::PeerReviewQuestionType::Scale,
                answer_required: true,
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
) -> ModelResult<(DatabaseChapter, Page)> {
    let mut tx = conn.begin().await?;
    let chapter_id = chapters::insert(&mut tx, pkey_policy.map_ref(|x| x.0), new_chapter).await?;
    let chapter = chapters::get_chapter(&mut tx, chapter_id).await?;
    let chapter_frontpage_content = serde_json::to_value(vec![
        GutenbergBlock::hero_section(&chapter.name, ""),
        GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/chapter-progress".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string()),
    ])?;
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
    let page = pages::insert_page(&mut tx, chapter_frontpage, user).await?;
    tx.commit().await?;
    Ok((chapter, page))
}
