use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use anyhow::Result;
use headless_lms_models::roles::UserRole;
use tracing::info;
use uuid::Uuid;

pub async fn seed_introduction_to_codes(
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

    info!("inserting introdution to codes course {}", course_name);

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Course for testing description suggestion with uh course codes")
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"687a2c17-7cca-4d4e-8ad5-bec24415e754")),
        })
        .role(teacher_user_id, UserRole::Teacher)
        .module(ModuleBuilder::new().order(0).chapter(
            ChapterBuilder::new(1, "Chapter 1").fixed_ids(
                cx.v5(b"eb7ecf0d-24eb-485c-89de-0a961097741f"),
                cx.v5(b"bdbe05b8-59cf-496a-a55b-ec3b4b6241ea"),
            ),
        ))
        .module(
            ModuleBuilder::new()
                .order(1)
                .name("Another module")
                .uh_course_code("TEST002".to_string())
                .chapter(ChapterBuilder::new(2, "Chapter 2").fixed_ids(
                    cx.v5(b"57c85452-d8bd-44e5-a3d0-bc09a4492028"),
                    cx.v5(b"48977307-c0a0-46f5-b74d-5b6b3c3eeb7c"),
                )),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
