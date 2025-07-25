use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use headless_lms_models::{
    PKeyPolicy, SpecFetcher, course_exams,
    exams::{self, NewExam},
    exercise_slide_submissions,
    exercise_task_gradings::{self, ExerciseTaskGradingResult, UserPointsUpdateStrategy},
    exercise_task_submissions,
    exercises::{self, GradingProgress},
    page_history::HistoryChangeReason,
    pages::{
        self, CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, CmsPageUpdate, NewPage,
        PageUpdateArgs,
    },
    peer_or_self_review_configs::{self, CmsPeerOrSelfReviewConfig},
    peer_or_self_review_questions::{self, CmsPeerOrSelfReviewQuestion},
    user_exercise_slide_states, user_exercise_states,
};
use headless_lms_utils::{attributes, document_schema_processor::GutenbergBlock};
use once_cell::sync::OnceCell;
use serde_json::Value;
use sqlx::PgConnection;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::models_requests::{self, JwtKey};

// Static holder for our cached spec fetcher
static SEED_SPEC_FETCHER: OnceCell<Box<dyn SpecFetcher + Send + Sync>> = OnceCell::new();

/// Initialize the global spec fetcher for seeding. Must be called once before any seeding operations.
pub fn init_seed_spec_fetcher(base_url: String, jwt_key: Arc<JwtKey>) -> Result<()> {
    let fetcher = Box::new(models_requests::make_seed_spec_fetcher_with_cache(
        base_url,
        Uuid::new_v4(),
        jwt_key,
    ));

    SEED_SPEC_FETCHER
        .set(fetcher)
        .map_err(|_| anyhow!("Seed spec fetcher already initialized"))?;
    Ok(())
}

/// Get the global spec fetcher for seeding. Panics if not initialized.
pub fn get_seed_spec_fetcher() -> &'static (dyn SpecFetcher + Send + Sync) {
    // We can use unwrap here since this is a fatal error during seeding
    SEED_SPEC_FETCHER
        .get()
        .unwrap_or_else(|| panic!("Seed spec fetcher not initialized"))
}

pub async fn create_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    author: Uuid,
    chapter_id: Option<Uuid>,
    page_data: CmsPageUpdate,
) -> Result<Uuid> {
    let new_page = NewPage {
        content: Value::Array(vec![]),
        url_path: page_data.url_path.to_string(),
        title: format!("{} WIP", page_data.title),
        course_id: Some(course_id),
        exam_id: None,
        chapter_id,
        front_page_of_chapter_id: None,
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content_search_language: None,
    };
    let page = pages::insert_page(
        conn,
        new_page,
        author,
        get_seed_spec_fetcher(),
        models_requests::fetch_service_info,
    )
    .await?;
    pages::update_page(
        conn,
        PageUpdateArgs {
            page_id: page.id,
            author,
            cms_page_update: CmsPageUpdate {
                content: page_data.content,
                exercises: page_data.exercises,
                exercise_slides: page_data.exercise_slides,
                exercise_tasks: page_data.exercise_tasks,
                url_path: page_data.url_path,
                title: page_data.title,
                chapter_id,
            },
            retain_ids: true,
            history_change_reason: HistoryChangeReason::PageSaved,
            is_exam_page: false,
        },
        get_seed_spec_fetcher(),
        models_requests::fetch_service_info,
    )
    .await?;
    Ok(page.id)
}

pub fn paragraph(content: &str, block: Uuid) -> GutenbergBlock {
    GutenbergBlock {
        name: "core/paragraph".to_string(),
        is_valid: true,
        client_id: block,
        attributes: attributes! {
            "content": content,
            "dropCap": false,
        },
        inner_blocks: vec![],
    }
}
pub fn heading(content: &str, client_id: Uuid, level: i32) -> GutenbergBlock {
    GutenbergBlock {
        name: "core/heading".to_string(),
        is_valid: true,
        client_id,
        attributes: attributes! {
            "content": content,
            "level": level,
        },
        inner_blocks: vec![],
    }
}

#[derive(Clone, Copy)]
pub struct CommonExerciseData {
    pub exercise_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub block_id: Uuid,
}

pub fn create_best_exercise(
    paragraph_id: Uuid,
    spec_1: Uuid,
    spec_2: Uuid,
    spec_3: Uuid,
    exercise_name: Option<String>,
    exercise_data: CommonExerciseData,
) -> (
    GutenbergBlock,
    CmsPageExercise,
    CmsPageExerciseSlide,
    CmsPageExerciseTask,
) {
    let CommonExerciseData {
        exercise_id,
        exercise_slide_id,
        exercise_task_id,
        block_id,
    } = exercise_data;
    let (exercise_block, exercise, mut slides, mut tasks) = example_exercise_flexible(
        exercise_id,
        exercise_name.unwrap_or_else(|| "Best exercise".to_string()),
        vec![(
            exercise_slide_id,
            vec![(
                exercise_task_id,
                "example-exercise".to_string(),
                serde_json::json!([paragraph("Answer this question.", paragraph_id)]),
                serde_json::json!([
                    {
                        "name": "a",
                        "correct": false,
                        "id": spec_1,
                    },
                    {
                        "name": "b",
                        "correct": true,
                        "id": spec_2,
                    },
                    {
                        "name": "c",
                        "correct": true,
                        "id": spec_3,
                    },
                ]),
            )],
        )],
        block_id,
    );
    (
        exercise_block,
        exercise,
        slides.swap_remove(0),
        tasks.swap_remove(0),
    )
}

#[allow(clippy::type_complexity)]
pub fn example_exercise_flexible(
    exercise_id: Uuid,
    exercise_name: String,
    exercise_slides: Vec<(Uuid, Vec<(Uuid, String, Value, Value)>)>,
    client_id: Uuid,
) -> (
    GutenbergBlock,
    CmsPageExercise,
    Vec<CmsPageExerciseSlide>,
    Vec<CmsPageExerciseTask>,
) {
    let block = GutenbergBlock {
        client_id,
        name: "moocfi/exercise".to_string(),
        is_valid: true,
        attributes: attributes! {
            "id": exercise_id,
            "name": exercise_name,
            "dropCap": false,
        },
        inner_blocks: vec![],
    };
    let slides: Vec<CmsPageExerciseSlide> = exercise_slides
        .iter()
        .map(|(slide_id, _)| CmsPageExerciseSlide {
            id: *slide_id,
            exercise_id,
            order_number: 1,
        })
        .collect();
    let tasks: Vec<CmsPageExerciseTask> = exercise_slides
        .into_iter()
        .flat_map(|(slide_id, tasks)| {
            tasks.into_iter().enumerate().map(
                move |(order_number, (task_id, task_type, assignment, spec))| {
                    (
                        slide_id,
                        task_id,
                        task_type,
                        assignment,
                        spec,
                        order_number as i32,
                    )
                },
            )
        })
        .map(
            |(slide_id, task_id, exercise_type, assignment, spec, order_number)| {
                CmsPageExerciseTask {
                    id: task_id,
                    exercise_slide_id: slide_id,
                    assignment,
                    exercise_type,
                    private_spec: Some(spec),
                    order_number,
                }
            },
        )
        .collect();

    let exercise = CmsPageExercise {
        id: exercise_id,
        name: exercise_name,
        order_number: 0,
        score_maximum: tasks.len() as i32,
        max_tries_per_slide: None,
        limit_number_of_tries: false,
        deadline: None,
        needs_peer_review: false,
        needs_self_review: false,
        use_course_default_peer_or_self_review_config: false,
        peer_or_self_review_config: None,
        peer_or_self_review_questions: None,
    };
    (block, exercise, slides, tasks)
}

pub fn quizzes_exercise(
    name: String,
    paragraph_id: Uuid,
    needs_peer_review: bool,
    private_spec: serde_json::Value,
    deadline: Option<DateTime<Utc>>,
    exercise_data: CommonExerciseData,
) -> (
    GutenbergBlock,
    CmsPageExercise,
    CmsPageExerciseSlide,
    CmsPageExerciseTask,
) {
    let CommonExerciseData {
        exercise_id,
        exercise_slide_id,
        exercise_task_id,
        block_id,
    } = exercise_data;
    let block = GutenbergBlock {
        client_id: block_id,
        name: "moocfi/exercise".to_string(),
        is_valid: true,
        attributes: attributes! {
            "id": exercise_id,
            "name": name,
            "dropCap": false,
        },
        inner_blocks: vec![],
    };
    let exercise = CmsPageExercise {
        id: exercise_id,
        name,
        order_number: 1,
        score_maximum: 1,
        max_tries_per_slide: None,
        limit_number_of_tries: false,
        deadline,
        needs_peer_review,
        needs_self_review: false,
        use_course_default_peer_or_self_review_config: true,
        peer_or_self_review_config: None,
        peer_or_self_review_questions: None,
    };
    let exercise_slide = CmsPageExerciseSlide {
        id: exercise_slide_id,
        exercise_id,
        order_number: 1,
    };
    let exercise_task = CmsPageExerciseTask {
        id: exercise_task_id,
        exercise_slide_id,
        assignment: serde_json::json!([paragraph("Answer this question.", paragraph_id)]),
        exercise_type: "quizzes".to_string(),
        private_spec: Some(serde_json::json!(private_spec)),
        order_number: 0,
    };
    (block, exercise, exercise_slide, exercise_task)
}

#[allow(clippy::too_many_arguments)]
pub fn tmc_exercise(
    name: String,
    exercise_id: Uuid,
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    block_id: Uuid,
    paragraph_id: Uuid,
    needs_peer_review: bool,
    private_spec: serde_json::Value,
    deadline: Option<DateTime<Utc>>,
) -> (
    GutenbergBlock,
    CmsPageExercise,
    CmsPageExerciseSlide,
    CmsPageExerciseTask,
) {
    let block = GutenbergBlock {
        client_id: block_id,
        name: "moocfi/exercise".to_string(),
        is_valid: true,
        attributes: attributes! {
            "id": exercise_id,
            "name": name,
            "dropCap": false,
        },
        inner_blocks: vec![],
    };
    let exercise = CmsPageExercise {
        id: exercise_id,
        name,
        order_number: 1,
        score_maximum: 1,
        max_tries_per_slide: None,
        limit_number_of_tries: false,
        deadline,
        needs_peer_review,
        needs_self_review: false,
        use_course_default_peer_or_self_review_config: true,
        peer_or_self_review_config: None,
        peer_or_self_review_questions: None,
    };
    let exercise_slide = CmsPageExerciseSlide {
        id: exercise_slide_id,
        exercise_id,
        order_number: 1,
    };
    let exercise_task = CmsPageExerciseTask {
        id: exercise_task_id,
        exercise_slide_id,
        assignment: serde_json::json!([paragraph("Write an `add` function.", paragraph_id)]),
        exercise_type: "tmc".to_string(),
        private_spec: Some(serde_json::json!(private_spec)),
        order_number: 0,
    };
    (block, exercise, exercise_slide, exercise_task)
}

#[allow(clippy::too_many_arguments)]
pub async fn submit_and_grade(
    conn: &mut PgConnection,
    id: &[u8],
    exercise_id: Uuid,
    exercise_slide_id: Uuid,
    course_id: Uuid,
    exercise_task_id: Uuid,
    user_id: Uuid,
    course_instance_id: Uuid,
    spec: String,
    out_of_100: f32,
) -> Result<()> {
    // combine the id with the user id to ensure it's unique
    let id: Vec<u8> = [id, &user_id.as_bytes()[..]].concat();
    let slide_submission = exercise_slide_submissions::insert_exercise_slide_submission_with_id(
        conn,
        Uuid::new_v4(),
        &exercise_slide_submissions::NewExerciseSlideSubmission {
            exercise_slide_id,
            course_id: Some(course_id),
            course_instance_id: Some(course_instance_id),
            exam_id: None,
            exercise_id,
            user_id,
            user_points_update_strategy: UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
        },
    )
    .await?;
    let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
        conn,
        user_id,
        exercise_id,
        Some(course_instance_id),
        None,
    )
    .await?;
    // Set selected exercise slide
    user_exercise_states::upsert_selected_exercise_slide_id(
        conn,
        user_id,
        exercise_id,
        Some(course_instance_id),
        None,
        Some(exercise_slide_id),
    )
    .await?;
    let user_exercise_slide_state = user_exercise_slide_states::get_or_insert_by_unique_index(
        conn,
        user_exercise_state.id,
        exercise_slide_id,
    )
    .await?;
    let task_submission_id = exercise_task_submissions::insert_with_id(
        conn,
        &exercise_task_submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, &id),
            exercise_id,
            course_id,
            exercise_task_id,
            exercise_slide_submission_id: slide_submission.id,
            exercise_slide_id,
            user_id,
            course_instance_id,
            data_json: Value::String(spec),
        },
    )
    .await?;

    let task_submission = exercise_task_submissions::get_by_id(conn, task_submission_id).await?;
    let exercise = exercises::get_by_id(conn, exercise_id).await?;
    let grading = exercise_task_gradings::new_grading(conn, &exercise, &task_submission).await?;
    let grading_result = ExerciseTaskGradingResult {
        feedback_json: Some(serde_json::json!([{"SelectedOptioIsCorrect": true}])),
        feedback_text: Some("Good job!".to_string()),
        grading_progress: GradingProgress::FullyGraded,
        score_given: out_of_100,
        score_maximum: 100,
        set_user_variables: Some(HashMap::new()),
    };
    headless_lms_models::library::grading::propagate_user_exercise_state_update_from_exercise_task_grading_result(
        conn,
        &exercise,
        &grading,
        &grading_result,
        user_exercise_slide_state,
        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
    )
    .await
    .unwrap();
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub async fn create_exam(
    conn: &mut PgConnection,
    name: String,
    starts_at: Option<DateTime<Utc>>,
    ends_at: Option<DateTime<Utc>>,
    time_minutes: i32,
    organization_id: Uuid,
    course_id: Uuid,
    exam_id: Uuid,
    teacher: Uuid,
    minimum_points_treshold: i32,
    grade_manually: bool,
) -> Result<Uuid> {
    let new_exam_id = exams::insert(
        conn,
        PKeyPolicy::Fixed(exam_id),
        &NewExam {
            name,
            starts_at,
            ends_at,
            time_minutes,
            organization_id,
            minimum_points_treshold,
            grade_manually,
        },
    )
    .await?;

    let (exam_exercise_block_1, exam_exercise_1, exam_exercise_slide_1, exam_exercise_task_1) =
        quizzes_exercise(
            "Multiple choice with feedback".to_string(),
            Uuid::new_v5(&course_id, b"eced4875-ece9-4c3d-ad0a-2443e61b3e78"),
            false,
            serde_json::from_str(include_str!(
                "../../assets/quizzes-multiple-choice-feedback.json"
            ))?,
            None,
            CommonExerciseData {
                exercise_id: Uuid::new_v5(&course_id, b"b1b16970-60bc-426e-9537-b29bd2185db3"),
                exercise_slide_id: Uuid::new_v5(
                    &course_id,
                    b"ea461a21-e0b4-4e09-a811-231f583b3dcb",
                ),
                exercise_task_id: Uuid::new_v5(&course_id, b"9d8ccf47-3e83-4459-8f2f-8e546a75f372"),
                block_id: Uuid::new_v5(&course_id, b"a4edb4e5-507d-43f1-8058-9d95941dbf09"),
            },
        );
    let (exam_exercise_block_2, exam_exercise_2, exam_exercise_slide_2, exam_exercise_task_2) =
        create_best_exercise(
            Uuid::new_v5(&course_id, b"fe5bb5a9-d0ab-4072-abe1-119c9c1e4f4a"),
            Uuid::new_v5(&course_id, b"22959aad-26fc-4212-8259-c128cdab8b08"),
            Uuid::new_v5(&course_id, b"d8ba9e92-4530-4a74-9b11-eb708fa54d40"),
            Uuid::new_v5(&course_id, b"846f4895-f573-41e2-9926-cd700723ac18"),
            Some("Best exercise".to_string()),
            CommonExerciseData {
                exercise_id: Uuid::new_v5(&course_id, b"44f472e5-b726-4c50-89a1-93f4170673f5"),
                exercise_slide_id: Uuid::new_v5(
                    &course_id,
                    b"23182b3d-fbf4-4c0d-93fa-e9ddc199cc52",
                ),
                exercise_task_id: Uuid::new_v5(&course_id, b"ca105826-5007-439f-87be-c25f9c79506e"),
                block_id: Uuid::new_v5(&course_id, b"96a9e586-cf88-4cb2-b7c9-efc2bc47e90b"),
            },
        );
    pages::insert_page(
        conn,
        NewPage {
            exercises: vec![exam_exercise_1, exam_exercise_2],
            exercise_slides: vec![exam_exercise_slide_1, exam_exercise_slide_2],
            exercise_tasks: vec![exam_exercise_task_1, exam_exercise_task_2],
            content: serde_json::json!([
                heading(
                    "The exam",
                    Uuid::parse_str("d6cf16ce-fe78-4e57-8399-e8b63d7fddac").unwrap(),
                    1
                ),
                paragraph(
                    "In this exam you're supposed to answer to two easy questions. Good luck!",
                    Uuid::parse_str("474d4f21-798b-4ba0-b39f-120b134e7fa0").unwrap(),
                ),
                exam_exercise_block_1,
                exam_exercise_block_2,
            ]),
            url_path: "".to_string(),
            title: "".to_string(),
            course_id: None,
            exam_id: Some(new_exam_id),
            chapter_id: None,
            front_page_of_chapter_id: None,
            content_search_language: None,
        },
        teacher,
        get_seed_spec_fetcher(),
        models_requests::fetch_service_info,
    )
    .await?;
    course_exams::upsert(conn, new_exam_id, course_id).await?;
    Ok(new_exam_id)
}

#[allow(clippy::too_many_arguments)]
pub async fn create_best_peer_review(
    conn: &mut PgConnection,
    course_id: Uuid,
    exercise_id: Uuid,
    processing_strategy: peer_or_self_review_configs::PeerReviewProcessingStrategy,
    accepting_threshold: f32,
    points_are_all_or_nothing: bool,
    peer_reviews_to_give: i32,
    peer_reviews_to_receive: i32,
) -> Result<()> {
    let prc = peer_or_self_review_configs::upsert_with_id(
        conn,
        PKeyPolicy::Generate,
        &CmsPeerOrSelfReviewConfig {
            id: Uuid::new_v4(),
            course_id,
            exercise_id: Some(exercise_id),
            peer_reviews_to_give,
            peer_reviews_to_receive,
            accepting_threshold,
            processing_strategy,
            points_are_all_or_nothing,
            review_instructions: None,
        },
    )
    .await?;

    peer_or_self_review_questions::insert(
        conn,
        PKeyPolicy::Generate,
        &CmsPeerOrSelfReviewQuestion {
            id: Uuid::new_v4(),
            peer_or_self_review_config_id: prc.id,
            order_number: 0,
            question: "What are your thoughts on the answer".to_string(),
            question_type: peer_or_self_review_questions::PeerOrSelfReviewQuestionType::Essay,
            answer_required: true,
            weight: 0.0,
        },
    )
    .await?;

    peer_or_self_review_questions::insert(
        conn,
        PKeyPolicy::Generate,
        &CmsPeerOrSelfReviewQuestion {
            id: Uuid::new_v4(),
            peer_or_self_review_config_id: prc.id,
            order_number: 1,
            question: "Was the answer correct?".to_string(),
            question_type: peer_or_self_review_questions::PeerOrSelfReviewQuestionType::Scale,
            answer_required: true,
            weight: 0.0,
        },
    )
    .await?;

    peer_or_self_review_questions::insert(
        conn,
        PKeyPolicy::Generate,
        &CmsPeerOrSelfReviewQuestion {
            id: Uuid::new_v4(),
            peer_or_self_review_config_id: prc.id,
            order_number: 2,
            question: "Was the answer good?".to_string(),
            question_type: peer_or_self_review_questions::PeerOrSelfReviewQuestionType::Scale,
            answer_required: true,
            weight: 0.0,
        },
    )
    .await?;

    exercises::set_exercise_to_use_exercise_specific_peer_or_self_review_config(
        conn,
        exercise_id,
        true,
        false,
        false,
    )
    .await?;
    Ok(())
}
