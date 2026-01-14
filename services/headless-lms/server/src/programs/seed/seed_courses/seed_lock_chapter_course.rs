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
                                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                                        "moocfi/lock-chapter",
                                        attributes! {},
                                        vec![
                                            GutenbergBlock::block_with_name_and_attributes(
                                                "core/heading",
                                                attributes! {
                                                    "content": "Model Solution",
                                                    "level": 2,
                                                    "anchor": "model-solution-title"
                                                },
                                            )
                                            .with_id(cx.v5(b"f1a2b3c4-d5e6-7890-abcd-ef1234567890")),
                                            GutenbergBlock::paragraph("Congratulations on completing Chapter 1! Here's a model solution for the Customer Behavior Analysis Project.")
                                                .with_id(cx.v5(b"f2a3b4c5-d6e7-8901-bcde-f1234567891")),
                                            GutenbergBlock::paragraph("The project involved analyzing customer purchase data to identify patterns and segment customers. The first step was data cleaning, which included handling missing values using appropriate imputation methods and removing outliers using the IQR method.")
                                                .with_id(cx.v5(b"f3a4b5c6-d7e8-9012-cdef-1234567892")),
                                            GutenbergBlock::block_with_name_and_attributes(
                                                "core/heading",
                                                attributes! {
                                                    "content": "Data Cleaning",
                                                    "level": 3,
                                                    "anchor": "data-cleaning"
                                                },
                                            )
                                            .with_id(cx.v5(b"f3b4c5d6-e7f8-9012-def3-3456789012")),
                                            GutenbergBlock::block_with_name_and_attributes(
                                                "core/code",
                                                attributes! {
                                                    "content": "import pandas as pd
import numpy as np
from sklearn.cluster import KMeans

# Load and clean data
df = pd.read_csv('customer_data.csv')
df['age'].fillna(df['age'].median(), inplace=True)
df['income'].fillna(df['income'].mean(), inplace=True)

# Remove outliers
Q1 = df['purchase_amount'].quantile(0.25)
Q3 = df['purchase_amount'].quantile(0.75)
IQR = Q3 - Q1
df = df[(df['purchase_amount'] >= Q1 - 1.5*IQR) &
        (df['purchase_amount'] <= Q3 + 1.5*IQR)]"
                                                },
                                            )
                                            .with_id(cx.v5(b"f4a5b6c7-d8e9-0123-def4-2345678903")),
                                            GutenbergBlock::block_with_name_and_attributes(
                                                "core/heading",
                                                attributes! {
                                                    "content": "Key Findings",
                                                    "level": 3,
                                                    "anchor": "key-findings"
                                                },
                                            )
                                            .with_id(cx.v5(b"f4b5c6d7-e8f9-0123-ef45-4567890123")),
                                            GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                                                "core/list",
                                                attributes! {
                                                    "ordered": false
                                                },
                                                vec![
                                                    GutenbergBlock::block_with_name_and_attributes(
                                                        "core/list-item",
                                                        attributes! {
                                                            "content": "Strong positive correlation (r=0.72) between income and purchase amount"
                                                        },
                                                    )
                                                    .with_id(cx.v5(b"f5a6b7c8-d9e0-1234-ef45-3456789014")),
                                                    GutenbergBlock::block_with_name_and_attributes(
                                                        "core/list-item",
                                                        attributes! {
                                                            "content": "Electronics category generates 35% more revenue than other categories"
                                                        },
                                                    )
                                                    .with_id(cx.v5(b"f6a7b8c9-d0e1-2345-f456-4567890125")),
                                                    GutenbergBlock::block_with_name_and_attributes(
                                                        "core/list-item",
                                                        attributes! {
                                                            "content": "High-value customers represent 18% of customers but 42% of total revenue"
                                                        },
                                                    )
                                                    .with_id(cx.v5(b"f7a8b9c0-d1e2-3456-5678-5678901236")),
                                                ],
                                            )
                                            .with_id(cx.v5(b"f8a9b0c1-d2e3-4567-6789-6789012347")),
                                            GutenbergBlock::block_with_name_and_attributes(
                                                "core/quote",
                                                attributes! {
                                                    "value": "The key insight from this analysis is that customer segmentation reveals distinct purchasing behaviors that can inform targeted marketing strategies."
                                                },
                                            )
                                            .with_id(cx.v5(b"f0a1b2c3-d4e5-6789-8901-8901234569")),
                                            GutenbergBlock::block_with_name_and_attributes(
                                                "core/heading",
                                                attributes! {
                                                    "content": "Recommendations",
                                                    "level": 3,
                                                    "anchor": "recommendations"
                                                },
                                            )
                                            .with_id(cx.v5(b"f1b2c3d4-e5f6-7890-f012-0123456789")),
                                            GutenbergBlock::paragraph("Based on the analysis, recommendations include developing a VIP program for high-value customers and increasing marketing focus on the Electronics category during peak seasons. The methodology demonstrated here provides a solid framework for data-driven decision making.")
                                                .with_id(cx.v5(b"f1a2b3c4-d5e6-7890-9012-9012345670")),
                                        ],
                                    )
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
                            cx.v5(b"z1y2x3w4-v5u6-7890-tsrq-pq9876543210"),
                            cx.v5(b"y2x3w4v5-u6t7-8901-srqp-op8765432109"),
                        )
                        .page(
                            PageBuilder::new("/chapter-2/exercise-page", "Exercise in Chapter 2")
                                .block(
                                    GutenbergBlock::paragraph("This is Chapter 2. A lock block will be added later.")
                                        .with_id(cx.v5(b"x3w4v5u6-t7s8-9012-rqpo-no7654321098")),
                                )
                                .exercise(ExerciseBuilder::quizzes(
                                    "Chapter 2 Exercise",
                                    ExerciseIds {
                                        exercise_id: cx.v5(b"w4v5u6t7-s8r9-0123-qpon-mn6543210987"),
                                        slide_id: cx.v5(b"v5u6t7s8-r9q0-1234-ponm-lm5432109876"),
                                        task_id: cx.v5(b"u6t7s8r9-q0p1-2345-onml-kl4321098765"),
                                        block_id: cx.v5(b"t7s8r9q0-p1o2-3456-nmlk-jk3210987654"),
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
