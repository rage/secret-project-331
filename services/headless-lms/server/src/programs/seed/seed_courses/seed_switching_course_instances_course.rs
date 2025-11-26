use crate::{
    prelude::*,
    programs::seed::{
        builder::{
            chapter::ChapterBuilder,
            context::SeedContext,
            course::{CourseBuilder, CourseInstanceConfig},
            exercise::{ExerciseBuilder, ExerciseIds},
            module::ModuleBuilder,
            page::PageBuilder,
        },
        seed_courses::CommonCourseData,
        seed_helpers::paragraph,
        seed_users::SeedUsersResult,
    },
};
use anyhow::Result;
use chrono::{TimeZone, Utc};
use headless_lms_models::roles::UserRole;
use serde_json::json;

pub async fn seed_switching_course_instances_course(
    course_id: Uuid,
    course_name: &str,
    course_slug: &str,
    common_course_data: CommonCourseData,
    can_add_chatbot: bool,
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
        "Inserting switching course instances course {}",
        course_name
    );

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Sample course.")
        .chatbot(can_add_chatbot)
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
        .instance(CourseInstanceConfig {
            name: Some("Non-default instance".to_string()),
            description: Some("This is a non-default instance".to_string()),
            support_email: Some("contact@example.com".to_string()),
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"instance:non-default")),
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
                        .deadline(Utc.with_ymd_and_hms(2225, 1, 1, 23, 59, 59).unwrap())
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
                                    false,
                                    None,
                                    None,
                                )),
                        ),
                ),
        )
        .module(
            ModuleBuilder::new()
                .order(1)
                .name("Another module")
                .automatic_completion(Some(1), Some(1), false)
                .ects(5.0)
                .chapter(
                    ChapterBuilder::new(2, "Another chapter")
                        .fixed_ids(cx.v5(b"chapter:2"), cx.v5(b"chapter:2:instance"))
                        .page(
                            PageBuilder::new("/chapter-2/page-1", "Simple Page")
                                .block(paragraph(
                                    "This is another simple page with basic content.",
                                    cx.v5(b"page:2:1:block:intro"),
                                ))
                                .exercise(ExerciseBuilder::example_exercise(
                                    "Simple question",
                                    ExerciseIds {
                                        exercise_id: cx.v5(b"exercise:2:1:e"),
                                        slide_id: cx.v5(b"exercise:2:1:s"),
                                        task_id: cx.v5(b"exercise:2:1:t"),
                                        block_id: cx.v5(b"exercise:2:1:b"),
                                    },
                                    vec![paragraph(
                                        "What color is the sky?",
                                        cx.v5(b"exercise:2:1:prompt"),
                                    )],
                                    json!([
                                        {
                                            "name": "Red",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:2:1:option:1")
                                        },
                                        {
                                            "name": "Blue",
                                            "correct": true,
                                            "id": cx.v5(b"exercise:2:1:option:2")
                                        },
                                        {
                                            "name": "Green",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:2:1:option:3")
                                        }
                                    ]),
                                    false,
                                    None,
                                    None,
                                )),
                        ),
                ),
        )
        .module(
            ModuleBuilder::new()
                .order(2)
                .name("Bonus module")
                .register_to_open_university(true)
                .automatic_completion(None, Some(1), false)
                .chapter(
                    ChapterBuilder::new(3, "Bonus chapter")
                        .fixed_ids(cx.v5(b"chapter:3"), cx.v5(b"chapter:3:instance"))
                        .page(
                            PageBuilder::new("/chapter-3/page-1", "Bonus Page")
                                .block(paragraph(
                                    "This is a bonus page with simple content.",
                                    cx.v5(b"page:3:1:block:intro"),
                                ))
                                .exercise(ExerciseBuilder::example_exercise(
                                    "Bonus question",
                                    ExerciseIds {
                                        exercise_id: cx.v5(b"exercise:3:1:e"),
                                        slide_id: cx.v5(b"exercise:3:1:s"),
                                        task_id: cx.v5(b"exercise:3:1:t"),
                                        block_id: cx.v5(b"exercise:3:1:b"),
                                    },
                                    vec![paragraph(
                                        "What is the capital of France?",
                                        cx.v5(b"exercise:3:1:assignment"),
                                    )],
                                    json!([
                                        {
                                            "name": "London",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:3:1:option:1")
                                        },
                                        {
                                            "name": "Paris",
                                            "correct": true,
                                            "id": cx.v5(b"exercise:3:1:option:2")
                                        },
                                        {
                                            "name": "Berlin",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:3:1:option:3")
                                        }
                                    ]),
                                    false,
                                    None,
                                    None,
                                )),
                        ),
                ),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
