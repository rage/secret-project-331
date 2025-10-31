use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::exercise::{ExerciseBuilder, ExerciseIds};
use crate::programs::seed::builder::module::{CompletionBuilder, ModuleBuilder};
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

pub async fn seed_graded_course(
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
    // Build the graded module
    let mut module = ModuleBuilder::new()
        .order(0)
        .register_to_open_university(false)
        .automatic_completion(Some(1), Some(1), false);

    // Add graded completions for each seeded example user (0–N)
    for uid in seed_users_result.example_normal_user_ids.iter() {
        module = module.completion(CompletionBuilder::new(*uid).grade(5).passed(true));
    }

    // Build the actual course
    let course = CourseBuilder::new(course_name, course_slug)
        .desc("A sample graded course that pre-seeds module completions for demo users.")
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
            instance_id: Some(cx.v5(b"instance:graded")),
        })
        .role(seed_users_result.teacher_user_id, UserRole::Teacher)
        .module(
            module.chapter(
                ChapterBuilder::new(1, "The Basics")
                    .opens(Utc::now())
                    .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:instance"))
                    .page(
                        PageBuilder::new("/chapter-1/page-1", "Welcome").block(paragraph(
                            "This is the graded example course.",
                            cx.v5(b"page:1:1"),
                        )),
                    ),
            ),
        );

    // Actually insert the course into the DB
    let (_course, _instance, _last_module) = course.seed(&mut conn, &cx).await?;
    Ok(course_id)
}
