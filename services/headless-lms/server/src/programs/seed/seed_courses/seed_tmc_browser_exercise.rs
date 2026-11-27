use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::exercise::{ExerciseBuilder, ExerciseIds};
use crate::programs::seed::builder::json_source::JsonSource;
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_file_storage::TMC_BROWSER_EXERCISE_URL;
use crate::programs::seed::seed_helpers::paragraph;
use anyhow::Result;
use chrono::Utc;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::roles::UserRole;
use serde_json::json;
use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;

/// Seeds the course `tmc-browser-exercise.spec.ts` uses: a Python exercise solved in the tmc
/// service's browser editor. The exercise is in no exercise repository, so the service downloads
/// the template from the spec's `download_url`, which the seed stores in the file store.
pub async fn seed_tmc_browser_exercise_course(
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
        ..
    } = common_course_data;

    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };

    info!("Inserting tmc browser exercise course {}", course_name);

    let private_spec = json!({
        "type": "browser",
        "repository_exercise": {
            "id": cx.v5(b"repository-exercise"),
            "repository_id": cx.v5(b"repository"),
            "part": "part01",
            "name": "hello_name",
            "repository_url": "https://github.com/rage/secret-project-331",
            "checksum": [0],
            "download_url": TMC_BROWSER_EXERCISE_URL,
        },
    });
    let exercise = ExerciseBuilder::tmc(
        "Hello name",
        ExerciseIds {
            exercise_id: cx.v5(b"exercise"),
            slide_id: cx.v5(b"exercise:slide"),
            task_id: cx.v5(b"exercise:task"),
            block_id: cx.v5(b"exercise:block"),
        },
        None,
        JsonSource::Inline(private_spec),
        vec![paragraph(
            "Write a program that asks for the user's name and greets them.",
            cx.v5(b"exercise:assignment"),
        )],
    );

    let (course, _default_instance, _last_module) = CourseBuilder::new(course_name, course_slug)
        .desc("A programming exercise solved in the browser.")
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
                ChapterBuilder::new(1, "Programming in the browser")
                    .opens(Utc::now())
                    .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:front-page"))
                    .page(
                        PageBuilder::new("/chapter-1/hello-name", "Hello name")
                            .block(paragraph(
                                "Solve this exercise in the editor below.",
                                cx.v5(b"page:intro"),
                            ))
                            .exercise(exercise),
                    ),
            ),
        )
        .seed(&mut conn, &app_config, &cx)
        .await?;

    Ok(course.id)
}
