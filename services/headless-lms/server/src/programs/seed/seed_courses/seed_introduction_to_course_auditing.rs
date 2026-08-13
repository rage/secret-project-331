use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use anyhow::Result;
use headless_lms_models::roles::UserRole;
use tracing::info;
use uuid::Uuid;

pub async fn seed_introduction_to_course_auditing(
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

    info!(
        "inserting introduction to course auditing course {}",
        course_name
    );

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Course for viewing and editing course data within course auditing page")
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"071e2dcf-1e3d-4f58-8b1e-c9962420e317")),
        })
        .role(teacher_user_id, UserRole::Teacher)
        .module(ModuleBuilder::new().order(0).chapter(
            ChapterBuilder::new(1, "Chapter 1").fixed_ids(
                cx.v5(b"cd4bf055-f5a6-4338-973a-88dad559bdcd"),
                cx.v5(b"9bef81f2-c95f-4ff8-aebc-6e0fcd4ef42c"),
            ),
        ))
        .module(
            ModuleBuilder::new()
                .order(1)
                .name("Another module")
                .uh_course_code("TEST002".to_string())
                .chapter(ChapterBuilder::new(2, "Chapter 2").fixed_ids(
                    cx.v5(b"d22c47f0-c442-4032-ad2d-3544a0463a02"),
                    cx.v5(b"c11d8d2e-3e53-4ed3-9b96-4092a2fec2da"),
                )),
        )
        .module(
            ModuleBuilder::new()
                .order(2)
                .name("Bonus module")
                .uh_course_code("TES03".to_string())
                .chapter(ChapterBuilder::new(3, "Chapter 3").fixed_ids(
                    cx.v5(b"5602b4f4-f07e-4a6d-82b0-c26fc0ed94c8"),
                    cx.v5(b"eb4d622c-24b4-4d18-b4da-a99ed24ca7ff"),
                )),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
