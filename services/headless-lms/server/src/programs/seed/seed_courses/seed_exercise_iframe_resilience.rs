use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::exercise::{ExerciseBuilder, ExerciseIds};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::{
    ExampleExerciseFlexibleParams, create_page, example_exercise_flexible, paragraph,
};
use anyhow::Result;
use chrono::Utc;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::pages::CmsPageUpdate;
use headless_lms_models::roles::UserRole;
use serde_json::{Value, json};
use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;

const MANY_EXERCISES_COUNT: usize = 16;
const MULTI_TASK_EXERCISE_TASK_COUNT: usize = 3;

/// Seeds the course `exercise-iframe-resilience.spec.ts` uses: its tests replace the
/// example-exercise iframe with simulated plugins, so only the page layout matters here. No other
/// test may submit on these pages, or the exercises open in the submission view.
pub async fn seed_exercise_iframe_resilience_course(
    app_config: ApplicationConfiguration,
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

    info!(
        "Inserting exercise iframe resilience course {}",
        course_name
    );

    let chapter_id = cx.v5(b"chapter:1");
    let many_exercises = (1..=MANY_EXERCISES_COUNT).map(|n| {
        let key = |part: &str| cx.v5(format!("many-exercises:{n}:{part}").as_bytes());
        ExerciseBuilder::example_exercise(
            format!("Exercise {n}"),
            ExerciseIds {
                exercise_id: key("exercise"),
                slide_id: key("slide"),
                task_id: key("task"),
                block_id: key("block"),
            },
            vec![paragraph(&format!("Question {n}."), key("assignment"))],
            options(&cx, &format!("many-exercises:{n}")),
            false,
            None,
            None,
        )
    });

    let (course, _default_instance, _last_module) = CourseBuilder::new(course_name, course_slug)
        .desc("Pages for testing how exercise iframes load.")
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
            ModuleBuilder::new().order(0).chapter(
                ChapterBuilder::new(1, "Exercise iframes")
                    .opens(Utc::now())
                    .fixed_ids(chapter_id, cx.v5(b"chapter:1:instance"))
                    .page(
                        PageBuilder::new("/chapter-1/many-exercises", "Many exercises")
                            .block(paragraph(
                                "This page has many exercises.",
                                cx.v5(b"many-exercises:intro"),
                            ))
                            .exercises(many_exercises),
                    ),
            ),
        )
        .seed(&mut conn, &app_config, &cx)
        .await?;

    let tasks = (1..=MULTI_TASK_EXERCISE_TASK_COUNT)
        .map(|n| {
            let prefix = format!("multi-task:task:{n}");
            (
                cx.v5(prefix.as_bytes()),
                "example-exercise".to_string(),
                json!([paragraph(
                    &format!("Task {n}."),
                    cx.v5(format!("{prefix}:assignment").as_bytes())
                )]),
                options(&cx, &prefix),
            )
        })
        .collect();
    let (multi_task_block, multi_task_exercise, multi_task_slides, multi_task_tasks) =
        example_exercise_flexible(ExampleExerciseFlexibleParams {
            exercise_id: cx.v5(b"multi-task:exercise"),
            exercise_name: "Multi-task exercise".to_string(),
            exercise_slides: vec![(cx.v5(b"multi-task:slide"), tasks)],
            client_id: cx.v5(b"multi-task:block"),
            needs_peer_review: Some(false),
            peer_or_self_review_config: None,
            peer_or_self_review_questions: None,
            teacher_reviews_answer_after_locking: true,
        });
    create_page(
        &mut conn,
        course.id,
        teacher_user_id,
        Some(chapter_id),
        CmsPageUpdate {
            url_path: "/chapter-1/multi-task-exercise".to_string(),
            title: "Multi-task exercise".to_string(),
            chapter_id: Some(chapter_id),
            exercises: vec![multi_task_exercise],
            exercise_slides: multi_task_slides,
            exercise_tasks: multi_task_tasks,
            content: vec![
                paragraph(
                    "This page has an exercise with several tasks.",
                    cx.v5(b"multi-task:intro"),
                ),
                multi_task_block,
            ],
            hidden: false,
        },
    )
    .await?;

    Ok(course.id)
}

fn options(cx: &SeedContext, prefix: &str) -> Value {
    json!([
        {
            "name": "Correct",
            "correct": true,
            "id": cx.v5(format!("{prefix}:correct").as_bytes()),
        },
        {
            "name": "Incorrect",
            "correct": false,
            "id": cx.v5(format!("{prefix}:incorrect").as_bytes()),
        },
    ])
}
