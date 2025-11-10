use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::{CompletionBuilder, ModuleBuilder};
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::paragraph;
use anyhow::Result;
use chrono::Utc;
use headless_lms_models::course_instance_enrollments;
use headless_lms_models::roles::UserRole;
use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;

async fn get_or_create_default_registrar(conn: &mut sqlx::PgConnection) -> anyhow::Result<Uuid> {
    if let Some(id) = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT id FROM study_registry_registrars ORDER BY created_at LIMIT 1"#,
    )
    .fetch_optional(&mut *conn)
    .await?
    {
        return Ok(id);
    }

    let id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO study_registry_registrars (id, created_at, updated_at, name, secret_key)
        VALUES (gen_random_uuid(), now(), now(), 'Default Registrar', encode(gen_random_bytes(32), 'hex'))
        RETURNING id
        "#,
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(id)
}

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
        example_normal_user_ids,
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
    let registrar_id = get_or_create_default_registrar(&mut conn).await?;

    let mut module = ModuleBuilder::new()
        .order(0)
        .register_to_open_university(false)
        .automatic_completion(Some(1), Some(1), false)
        .default_registrar(registrar_id);

    for (i, uid) in example_normal_user_ids.iter().enumerate() {
        module = module.completion(
            CompletionBuilder::new(*uid)
                .grade(5)
                .passed(true)
                .completion_registered(format!("52-{:03}", i)),
        );
    }

    // Build the actual course
    let course_builder = CourseBuilder::new(course_name, course_slug)
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

    // Insert course
    let (course, default_instance, _last_module) = course_builder.seed(&mut conn, &cx).await?;

    // Enroll users to default instance
    for uid in example_normal_user_ids.iter() {
        course_instance_enrollments::insert(&mut conn, *uid, course.id, default_instance.id)
            .await?;
    }

    Ok(course_id)
}
