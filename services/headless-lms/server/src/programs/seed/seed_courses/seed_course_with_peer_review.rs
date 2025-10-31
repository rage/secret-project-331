use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::exercise::{ExerciseBuilder, ExerciseIds};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::paragraph;
use anyhow::Result;
use chrono::Utc;

use headless_lms_models::peer_or_self_review_configs::{
    CmsPeerOrSelfReviewConfig, PeerReviewProcessingStrategy,
};
use headless_lms_models::peer_or_self_review_questions::CmsPeerOrSelfReviewQuestion;
use headless_lms_models::roles::UserRole;
use serde_json::json;
use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;

pub async fn seed_peer_review_course(
    course_id: Uuid,
    course_name: &str,
    course_slug: &str,
    common_course_data: CommonCourseData,
    seed_users_result: SeedUsersResult,
) -> Result<Uuid> {
    let CommonCourseData {
        db_pool,
        organization_id: org,
        teacher_user_id,
        student_user_id: _student,
        langs_user_id: _langs_user_id,
        example_normal_user_ids: _users,
        jwt_key: _jwt_key,
        base_url: _base_url,
    } = common_course_data;

    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };

    info!("Inserting sample course {}", course_name);
    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Sample course for testing reject and reset-feature in manual review after peer review.")
        .chatbot(false)
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"instance:default")),
        })
        .role(seed_users_result.teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new()
                .order(0)
                .register_to_open_university(false)
                .automatic_completion(Some(1), Some(1), false)
                .chapter(
                    ChapterBuilder::new(1, "The Basics")
                        .opens(Utc::now())
                        .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:instance"))
                        .page(
                            PageBuilder::new("/chapter-1/page-1", "Page One")
                                .block(paragraph(
                                    "This is a simple introduction to the basics.",
                                    cx.v5(b"page:1:1:block:intro"),
                                ))
                                .exercise(ExerciseBuilder::example_exercise(
                                    "Simple multiple choice",
                                    ExerciseIds {
                                        exercise_id: cx.v5(b"exercise:1:1:e"),
                                        slide_id: cx.v5(b"exercise:1:1:s"),
                                        task_id: cx.v5(b"exercise:1:1:t"),
                                        block_id: cx.v5(b"exercise:1:1:b"),
                                    },
                                    vec![paragraph(
                                        "What is 2 + 2?",
                                        cx.v5(b"exercise:1:1:prompt"),
                                    )],
                                    json!([
                                        {
                                            "name": "3",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:1:1:option:1")
                                        },
                                        {
                                            "name": "4",
                                            "correct": true,
                                            "id": cx.v5(b"exercise:1:1:option:2")
                                        },
                                        {
                                            "name": "5",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:1:1:option:3")
                                        }
                                    ]),
                                    true,
                                    Some(CmsPeerOrSelfReviewConfig {
                                        id: cx.v5(b"peer-review:1"),
                                        course_id,
                                        exercise_id: Some(cx.v5(b"exercise:1:1:e")),
                                        peer_reviews_to_give: 2,
                                        peer_reviews_to_receive: 1,
                                        accepting_threshold: 2.1,
                                        processing_strategy:
                                        PeerReviewProcessingStrategy::AutomaticallyGradeOrManualReviewByAverage,
                                        reset_answer_if_zero_points_from_review: false,
                                        points_are_all_or_nothing: true,
                                        review_instructions: None,
                                    }),
                                    Some(vec![CmsPeerOrSelfReviewQuestion {
                                        id: cx.v5(b"peer-review:1:q1"),
                                        peer_or_self_review_config_id: cx.v5(b"peer-review:1"),
                                        order_number: 1,
                                        question: "Good answer?".to_string(),
                                        question_type: headless_lms_models::peer_or_self_review_questions::PeerOrSelfReviewQuestionType::Scale,
                                        answer_required: true,
                                        weight: 0.0,
                                    }]),
                                )),
                        ),
                ),
        );
    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;
    Ok(course.id)
}
