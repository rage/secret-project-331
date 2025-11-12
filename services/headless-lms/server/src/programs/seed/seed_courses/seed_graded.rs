use crate::programs::seed::builder::certificate::CertificateBuilder;
use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::{
    CompletionBuilder, CompletionRegisteredBuilder, ModuleBuilder,
};
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::paragraph;
use anyhow::Result;
use chrono::Utc;
use headless_lms_models::course_instance_enrollments;
use headless_lms_models::roles::UserRole;
use sqlx::{Row, postgres::PgRow};
use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;
use anyhow::Context;
use headless_lms_models::certificate_configurations;

async fn get_or_attach_certificate_config_for_module(
    conn: &mut sqlx::PgConnection,
    module_id: Uuid,
) -> anyhow::Result<Uuid> {
    // 1) If module already has a default config, return it
    if let Ok(conf) =
        certificate_configurations::get_default_configuration_by_course_module(conn, module_id)
            .await
    {
        return Ok(conf.id);
    }

    // 2) Pick any existing certificate configuration (latest)
    let config_id: Uuid = sqlx::query(
        r#"
        SELECT id
        FROM certificate_configurations
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .map(|row: PgRow| row.get::<Uuid, _>("id"))
    .fetch_one(&mut *conn)
    .await;

    // 3) Attach it to this module as a requirement (idempotent)
    sqlx::query(
        r#"
        INSERT INTO certificate_configuration_to_requirements
            (certificate_configuration_id, course_module_id)
        SELECT $1, $2
        WHERE NOT EXISTS (
            SELECT 1
            FROM certificate_configuration_to_requirements
            WHERE certificate_configuration_id = $1
              AND course_module_id = $2
              AND deleted_at IS NULL
        )
        "#,
    )
    .bind(config_id)
    .bind(module_id)
    .execute(&mut *conn)
    .await
    .context("attach certificate configuration to module")?;

    Ok(config_id)
}

async fn get_or_create_default_registrar(conn: &mut sqlx::PgConnection) -> anyhow::Result<Uuid> {
    if let Some(id) =
        sqlx::query(r#"SELECT id FROM study_registry_registrars ORDER BY created_at LIMIT 1"#)
            .map(|row: PgRow| row.get::<Uuid, _>("id"))
            .fetch_optional(&mut *conn)
            .await?
    {
        return Ok(id);
    }

    let id = sqlx::query(
        r#"
        INSERT INTO study_registry_registrars (id, created_at, updated_at, name, secret_key)
        VALUES (gen_random_uuid(), now(), now(), 'Default Registrar', encode(gen_random_bytes(32), 'hex'))
        RETURNING id
        "#,
    )
    .map(|row: PgRow| row.get::<Uuid, _>("id"))
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
    let registrar_id: Uuid = if let Some(id) =
        sqlx::query(r#"SELECT id FROM study_registry_registrars ORDER BY created_at LIMIT 1"#)
            .map(|row: PgRow| row.get::<Uuid, _>("id"))
            .fetch_optional(&mut *conn)
            .await?
    {
        id
    } else {
        sqlx::query(
            r#"
            INSERT INTO study_registry_registrars (id, created_at, updated_at, name, secret_key)
            VALUES (gen_random_uuid(), now(), now(), 'Default Registrar', encode(gen_random_bytes(32), 'hex'))
            RETURNING id
            "#,
        )
        .map(|row: PgRow| row.get::<Uuid, _>("id"))
        .fetch_one(&mut *conn)
        .await?
    };


    for (i, uid) in example_normal_user_ids.iter().enumerate() {
        module = module.completion(
            CompletionBuilder::new(*uid)
                .grade(5)
                .passed(true)
                .registered(
                    CompletionRegisteredBuilder::new().real_student_number(format!("52-{:03}", i)),
                ),
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
            module.chapter(ChapterBuilder::new(1, "The Basics").opens(Utc::now()).page(
                PageBuilder::new("/chapter-1/page-1", "Welcome").block(paragraph(
                    "This is the graded example course.",
                    cx.v5(b"page:1:1"),
                )),
            )),
        );

    // Insert course
    let (course, default_instance, last_module) = course_builder.seed(&mut conn, &cx).await?;

    // Enroll users to default instance
    for uid in example_normal_user_ids.iter() {
        course_instance_enrollments::insert(&mut conn, *uid, course.id, default_instance.id)
            .await?;
    }

    // Attach or reuse certificate configuration for this module
    let config_id = get_or_attach_certificate_config_for_module(&mut conn, last_module.id).await?;

    // Generate certificates for seeded users
    for uid in example_normal_user_ids.iter() {
        let _ = CertificateBuilder::new(*uid)
            .configuration_id(config_id)
            .name_on_certificate("Example User")
            .ensure_requirements(false)
            .seed(&mut conn)
            .await?;
    }

    Ok(course_id)
}
