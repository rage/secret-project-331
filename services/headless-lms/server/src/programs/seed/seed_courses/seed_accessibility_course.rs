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
use headless_lms_utils::{attributes, document_schema_processor::GutenbergBlock};
use serde_json::json;
use tracing::info;
use uuid::Uuid;

pub async fn seed_accessibility_course(
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

    info!("inserting accessibility course {}", course_name);

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Course for testing accessibility features.")
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"7344f1c8-b7ce-4c7d-ade2-5f39997bd454")),
        })
        .role(teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new().order(0).chapter(
                ChapterBuilder::new(1, "Chapter 1")
                    .fixed_ids(
                        cx.v5(b"a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
                        cx.v5(b"b2c3d4e5-f6a7-8901-bcde-f12345678901"),
                    )
                    .page(
                        PageBuilder::new("/chapter-1/choose-n-exercise", "Choose N Exercise")
                            .exercise(ExerciseBuilder::quizzes(
                                "Choose N exercise",
                                ExerciseIds {
                                    exercise_id: cx.v5(b"b8c9d0e1-f2a3-4567-6789-678901234567"),
                                    slide_id: cx.v5(b"c9d0e1f2-a3b4-5678-7890-789012345678"),
                                    task_id: cx.v5(b"d0e1f2a3-b4c5-6789-8901-890123456789"),
                                    block_id: cx.v5(b"e1f2a3b4-c5d6-7890-9012-901234567890"),
                                },
                                false,
                                None,
                                JsonSource::Inline(json!({
                                  "version": "2",
                                  "title": "Choose N Exercise",
                                  "body": "Select 2 options from the list below.",
                                  "awardPointsEvenIfWrong": false,
                                  "grantPointsPolicy": "grant_whenever_possible",
                                  "quizItemDisplayDirection": "vertical",
                                  "submitMessage": "",
                                  "items": [
                                    {
                                      "type": "choose-n",
                                      "id": "d4e5f6a7-b8c9-0123-def4-234567890123",
                                      "failureMessage": "",
                                      "options": [
                                        {
                                          "order": 1,
                                          "additionalCorrectnessExplanationOnModelSolution": "",
                                          "body": "",
                                          "correct": true,
                                          "id": "e5f6a7b8-c9d0-1234-ef45-345678901234",
                                          "messageAfterSubmissionWhenSelected": "",
                                          "title": "Option 1"
                                        },
                                        {
                                          "order": 2,
                                          "additionalCorrectnessExplanationOnModelSolution": "",
                                          "body": "",
                                          "correct": true,
                                          "id": "f6a7b8c9-d0e1-2345-f456-456789012345",
                                          "messageAfterSubmissionWhenSelected": "",
                                          "title": "Option 2"
                                        },
                                        {
                                          "order": 3,
                                          "additionalCorrectnessExplanationOnModelSolution": "",
                                          "body": "",
                                          "correct": false,
                                          "id": "a7b8c9d0-e1f2-3456-5678-567890123456",
                                          "messageAfterSubmissionWhenSelected": "",
                                          "title": "Option 3"
                                        }
                                      ],
                                      "order": 0,
                                      "successMessage": "",
                                      "title": "Choose 2 options",
                                      "body": "",
                                      "n": 2
                                    }
                                  ]
                                })),
                                vec![],
                                true,
                            )),
                    )
                    .page(
                        PageBuilder::new("/chapter-1/flip-card", "Flip Card").block(
                            GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                                "moocfi/flip-card",
                                attributes! {
                                    "size": "m"
                                },
                                vec![
                                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                                        "moocfi/front-card",
                                        attributes! {},
                                        vec![GutenbergBlock::paragraph("Front side content")],
                                    )
                                    .with_id(cx.v5(b"f1a2b3c4-d5e6-7890-1234-567890abcdef")),
                                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                                        "moocfi/back-card",
                                        attributes! {},
                                        vec![GutenbergBlock::paragraph("Back side content")],
                                    )
                                    .with_id(cx.v5(b"a1b2c3d4-e5f6-7890-abcd-ef1234567890")),
                                ],
                            )
                            .with_id(cx.v5(b"12345678-1234-5678-9012-123456789abc")),
                        ),
                    ),
            ),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
