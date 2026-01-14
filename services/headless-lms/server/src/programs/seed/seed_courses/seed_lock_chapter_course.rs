use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::exercise::{ExerciseBuilder, ExerciseIds};
use crate::programs::seed::builder::json_source::JsonSource;
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use anyhow::Result;
use headless_lms_models::roles::UserRole;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::json;
use tracing::info;
use uuid::Uuid;

pub async fn seed_lock_chapter_course(
    course_id: Uuid,
    course_name: &str,
    course_slug: &str,
    common_course_data: CommonCourseData,
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

    info!("inserting lock chapter course {}", course_name);

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Course for testing chapter locking feature.")
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"a1b2c3d4-e5f6-7890-abcd-ef1234567890")),
        })
        .role(teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new()
                .order(0)
                .chapter(
                    ChapterBuilder::new(1, "Chapter 1 - Lockable")
                        .fixed_ids(
                            cx.v5(b"b2c3d4e5-f6a7-8901-bcde-f12345678901"),
                            cx.v5(b"c3d4e5f6-a7b8-9012-cdef-123456789012"),
                        )
                        .page(
                            PageBuilder::new("/chapter-1/lock-page", "Lock Chapter Page")
                                .block(
                                    GutenbergBlock::empty_block_from_name("moocfi/lock-chapter".to_string())
                                        .with_id(cx.v5(b"d4e5f6a7-b8c9-0123-def4-234567890123")),
                                )
                                .block(
                                    GutenbergBlock::paragraph("This is Chapter 1. You can lock this chapter when you're done.")
                                        .with_id(cx.v5(b"e5f6a7b8-c9d0-1234-ef45-345678901234")),
                                ),
                        )
                        .page(
                            PageBuilder::new("/chapter-1/exercise-page", "Exercise in Chapter 1")
                                .exercise(ExerciseBuilder::quizzes(
                                    "Chapter 1 Exercise",
                                    ExerciseIds {
                                        exercise_id: cx.v5(b"f6a7b8c9-d0e1-2345-f456-456789012345"),
                                        slide_id: cx.v5(b"a7b8c9d0-e1f2-3456-5678-567890123456"),
                                        task_id: cx.v5(b"b8c9d0e1-f2a3-4567-6789-678901234567"),
                                        block_id: cx.v5(b"c9d0e1f2-a3b4-5678-7890-789012345678"),
                                    },
                                    false,
                                    None,
                                    JsonSource::Inline(json!({
                                      "version": "2",
                                      "title": "Chapter 1 Exercise",
                                      "body": "Select the correct answer.",
                                      "awardPointsEvenIfWrong": false,
                                      "grantPointsPolicy": "grant_whenever_possible",
                                      "quizItemDisplayDirection": "vertical",
                                      "submitMessage": "",
                                      "items": [
                                        {
                                          "type": "multiple-choice",
                                          "id": "d0e1f2a3-b4c5-6789-8901-890123456789",
                                          "failureMessage": "",
                                          "options": [
                                            {
                                              "order": 1,
                                              "additionalCorrectnessExplanationOnModelSolution": "",
                                              "body": "",
                                              "correct": true,
                                              "id": "e1f2a3b4-c5d6-7890-9012-901234567890",
                                              "messageAfterSubmissionWhenSelected": "",
                                              "title": "Correct answer"
                                            },
                                            {
                                              "order": 2,
                                              "additionalCorrectnessExplanationOnModelSolution": "",
                                              "body": "",
                                              "correct": false,
                                              "id": "f2a3b4c5-d6e7-8901-0123-012345678901",
                                              "messageAfterSubmissionWhenSelected": "",
                                              "title": "Wrong answer"
                                            }
                                          ],
                                          "order": 0,
                                          "successMessage": "",
                                          "title": "What is the correct answer?",
                                          "body": ""
                                        }
                                      ]
                                    })),
                                    vec![],
                                )),
                        ),
                )
                .chapter(
                    ChapterBuilder::new(2, "Chapter 2 - Add Lock Later")
                        .fixed_ids(
                            cx.v5(b"a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
                            cx.v5(b"b2c3d4e5-f6a7-8901-bcde-f12345678901"),
                        )
                        .page(
                            PageBuilder::new("/chapter-2/exercise-page", "Exercise in Chapter 2")
                                .block(
                                    GutenbergBlock::paragraph("This is Chapter 2. A lock block will be added later.")
                                        .with_id(cx.v5(b"c3d4e5f6-a7b8-9012-cdef-123456789012")),
                                )
                                .exercise(ExerciseBuilder::quizzes(
                                    "Chapter 2 Exercise",
                                    ExerciseIds {
                                        exercise_id: cx.v5(b"d4e5f6a7-b8c9-0123-def4-234567890123"),
                                        slide_id: cx.v5(b"e5f6a7b8-c9d0-1234-ef45-345678901234"),
                                        task_id: cx.v5(b"f6a7b8c9-d0e1-2345-f456-456789012345"),
                                        block_id: cx.v5(b"a7b8c9d0-e1f2-3456-5678-567890123456"),
                                    },
                                    false,
                                    None,
                                    JsonSource::Inline(json!({
                                      "version": "2",
                                      "title": "Chapter 2 Exercise",
                                      "body": "Select the correct answer.",
                                      "awardPointsEvenIfWrong": false,
                                      "grantPointsPolicy": "grant_whenever_possible",
                                      "quizItemDisplayDirection": "vertical",
                                      "submitMessage": "",
                                      "items": [
                                        {
                                          "type": "multiple-choice",
                                          "id": "b8c9d0e1-f2a3-4567-6789-678901234567",
                                          "failureMessage": "",
                                          "options": [
                                            {
                                              "order": 1,
                                              "additionalCorrectnessExplanationOnModelSolution": "",
                                              "body": "",
                                              "correct": true,
                                              "id": "c9d0e1f2-a3b4-5678-7890-789012345678",
                                              "messageAfterSubmissionWhenSelected": "",
                                              "title": "Correct answer"
                                            },
                                            {
                                              "order": 2,
                                              "additionalCorrectnessExplanationOnModelSolution": "",
                                              "body": "",
                                              "correct": false,
                                              "id": "d0e1f2a3-b4c5-6789-8901-890123456789",
                                              "messageAfterSubmissionWhenSelected": "",
                                              "title": "Wrong answer"
                                            }
                                          ],
                                          "order": 0,
                                          "successMessage": "",
                                          "title": "What is the correct answer?",
                                          "body": ""
                                        }
                                      ]
                                    })),
                                    vec![],
                                )),
                        ),
                ),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
