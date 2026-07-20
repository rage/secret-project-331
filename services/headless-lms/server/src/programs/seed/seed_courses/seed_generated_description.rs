use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use anyhow::Result;
use headless_lms_models::roles::UserRole;
use tracing::info;
use uuid::Uuid;

pub async fn seed_generated_description(
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

    info!("inserting description generation course {}", course_name);

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Course for testing description generation with LLM.")
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
            ModuleBuilder::new()
                .order(0)
                .uh_course_code("TEST001".to_string())
                .chapter(ChapterBuilder::new(1, "Chapter 1").fixed_ids(
                    cx.v5(b"71f85e9a-bf0e-4062-9212-6b05a425a018"),
                    cx.v5(b"f808c4a7-0bde-4347-b8c3-0f2e32ffe85a"),
                )),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
