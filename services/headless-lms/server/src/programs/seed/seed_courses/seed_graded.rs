// services/.../seed_graded.rs

use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{
    CompletionBuilder, CourseBuilder, CourseInstanceConfig,
};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::paragraph;
use anyhow::Result;
use chrono::Utc;
use headless_lms_models::roles::UserRole;
use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;

pub async fn seed_graded_course(
    course_id: Uuid,
    course_name: &str, // keep external naming params
    course_slug: &str,
    common_course_data: CommonCourseData,
    seed_users_result: SeedUsersResult,
) -> Result<Uuid> {
    let CommonCourseData {
        db_pool,
        organization_id: org,
        teacher_user_id,
        student_user_id,
        langs_user_id,
        example_normal_user_ids,
        ..
    } = common_course_data;

    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };

    info!("Inserting graded sample course {}", course_name);

    // --- Build a clean, minimal graded course ---
    let mut course = CourseBuilder::new(course_name, course_slug)
        .desc("Sample course for graded module completions.")
        .course_id(course_id)
        .role(seed_users_result.teacher_user_id, UserRole::Teacher)
        .instance(CourseInstanceConfig {
            name: Some("Default Instance".to_string()),
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"instance:graded:default")),
        })
        // --- Module 0 ---
        .module(
            ModuleBuilder::new().order(0).name("Module 1").chapter(
                ChapterBuilder::new(1, "Module 1 — Basics")
                    .opens(Utc::now())
                    .fixed_ids(
                        cx.v5(b"graded:chapter:1"),
                        cx.v5(b"graded:chapter:1:instance"),
                    )
                    .page(
                        PageBuilder::new("/m1/p1", "Welcome to Module 1")
                            .block(paragraph("Short intro.", cx.v5(b"graded:m1:p1:intro"))),
                    ),
            ),
        )
        // --- Module 1 ---
        .module(
            ModuleBuilder::new().order(1).name("Module 2").chapter(
                ChapterBuilder::new(2, "Module 2 — Intermediate")
                    .opens(Utc::now())
                    .fixed_ids(
                        cx.v5(b"graded:chapter:2"),
                        cx.v5(b"graded:chapter:2:instance"),
                    )
                    .page(
                        PageBuilder::new("/m2/p1", "Welcome to Module 2")
                            .block(paragraph("Short intro.", cx.v5(b"graded:m2:p1:intro"))),
                    ),
            ),
        )
        // --- Module 2 ---
        .module(
            ModuleBuilder::new().order(2).name("Module 3").chapter(
                ChapterBuilder::new(3, "Module 3 — Advanced")
                    .opens(Utc::now())
                    .fixed_ids(
                        cx.v5(b"graded:chapter:3"),
                        cx.v5(b"graded:chapter:3:instance"),
                    )
                    .page(
                        PageBuilder::new("/m3/p1", "Welcome to Module 3")
                            .block(paragraph("Short intro.", cx.v5(b"graded:m3:p1:intro"))),
                    ),
            ),
        );

    // --- Select 5 students (prefer example normals, then fall back) ---
    let mut candidates: Vec<Uuid> = example_normal_user_ids.as_ref().clone();
    if !candidates.contains(&student_user_id) {
        candidates.push(student_user_id);
    }
    if !candidates.contains(&langs_user_id) {
        candidates.push(langs_user_id);
    }
    // (deliberately not adding teacher as a student)
    candidates.truncate(5);
    while candidates.len() < 5 {
        // If your seed sometimes has too few users, duplicate safely.
        // (DB has unique constraint per (module,user), but duplicates across modules are fine.)
        let fallback = candidates.first().copied().unwrap_or(student_user_id);
        candidates.push(fallback);
    }

    // Helper to build deterministic seed emails
    let seed_email = |idx: usize| format!("seed_student_{}@example.com", idx + 1);

    // --- Attach per-module grades for 5 students ---
    // Feel free to tweak these matrices.
    let grades_mod0 = [5, 4, 3, 2, 1];
    let grades_mod1 = [1, 3, 5, 0, 2];
    let grades_mod2 = [2, 0, 4, 5, 3];

    for (i, user) in candidates.iter().enumerate().take(5) {
        course = course
            .completion(
                CompletionBuilder::new()
                    .module_order(0)
                    .user_id(*user)
                    .grade(grades_mod0[i])
                    .email(seed_email(i))
                    .completion_language("en")
                    .eligible_for_ects(true)
                    .prerequisites_completed(false), // default in schema; change if you enforce deps
            )
            .completion(
                CompletionBuilder::new()
                    .module_order(1)
                    .user_id(*user)
                    .grade(grades_mod1[i])
                    .email(seed_email(i))
                    .completion_language("en")
                    .eligible_for_ects(true),
            )
            .completion(
                CompletionBuilder::new()
                    .module_order(2)
                    .user_id(*user)
                    .grade(grades_mod2[i])
                    .email(seed_email(i))
                    .completion_language("en")
                    .eligible_for_ects(true),
            );
    }

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;
    Ok(course.id)
}
