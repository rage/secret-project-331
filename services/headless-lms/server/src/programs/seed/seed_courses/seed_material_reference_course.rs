use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use anyhow::Result;
use headless_lms_models::roles::UserRole;
use headless_lms_utils::{attributes, document_schema_processor::GutenbergBlock};
use tracing::info;
use uuid::Uuid;

pub async fn seed_material_reference_course(
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

    info!("inserting material reference course {}", course_name);

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Minimal course for testing material references.")
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"material-ref-instance-001")),
        })
        .role(teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new().order(0).chapter(
                ChapterBuilder::new(1, "Chapter 1")
                    .fixed_ids(
                        cx.v5(b"material-ref-chapter-001"),
                        cx.v5(b"material-ref-front-page-001"),
                    )
                        .page(
                            PageBuilder::new("/chapter-1/page-1", "Page One")
                                .block(
                                    GutenbergBlock::block_with_name_and_attributes(
                                        "core/heading",
                                        attributes! {
                                            "content": "Page One",
                                            "level": 1,
                                        },
                                    )
                                    .with_id(cx.v5(b"material-ref-heading-001")),
                                )
                                .block(
                                    GutenbergBlock::paragraph("The abacus is one of the oldest known calculating tools, with origins tracing back to ancient Mesopotamia and China. Often consisting of a wooden frame with rows of beads, it has been used for centuries as a reliable aid in performing arithmetic operations. Its simplicity and effectiveness made it a cornerstone of commerce and education across many civilizations.")
                                        .with_id(cx.v5(b"material-ref-abacus-001")),
                                )
                                .block(
                                    GutenbergBlock::paragraph("Throughout history, the abacus has taken on various forms, from the Roman hand abacus to the Chinese suanpan and the Japanese soroban. Each design introduced unique innovations, optimizing calculation methods for their respective regions. Despite the rise of digital calculators, the abacus continues to be used in some educational settings to teach arithmetic concepts and mental math techniques.")
                                        .with_id(cx.v5(b"material-ref-abacus-002")),
                                )
                                .block(
                                    GutenbergBlock::paragraph("Modern interest in the abacus has grown as educators recognize its value in developing number sense and concentration in children. Competitions in mental abacus calculation demonstrate just how powerful this tool can be when mastered. While it may seem outdated, the abacus remains a symbol of timeless ingenuity and practical problem-solving.")
                                        .with_id(cx.v5(b"material-ref-abacus-003")),
                                )
                                .block(
                                    GutenbergBlock::paragraph("In recent years, digital adaptations of the abacus have also emerged, blending traditional methods with modern interfaces. These tools not only preserve the historical legacy of the abacus but also make it more accessible to new generations of learners. Whether used physically or virtually, the abacus continues to bridge the gap between tactile learning and abstract thinking.")
                                        .with_id(cx.v5(b"material-ref-abacus-004")),
                                ),
                        ),
            ),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
