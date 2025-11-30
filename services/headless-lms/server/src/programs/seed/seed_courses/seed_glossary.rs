use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::paragraph;
use anyhow::Result;
use chrono::Utc;
use headless_lms_models::roles::UserRole;
use headless_lms_utils::{attributes, document_schema_processor::GutenbergBlock};
use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;

pub async fn seed_glossary_course(
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

    info!("Inserting glossary course {}", course_name);

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Sample course for glossary.")
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
        .top_level_page(
            "/glossary",
            "Glossary",
            1,
            false,
            Some(vec![GutenbergBlock {
                name: "moocfi/glossary".to_string(),
                is_valid: true,
                client_id: cx.v5(b"glossary-page-block"),
                attributes: attributes! {},
                inner_blocks: vec![],
            }]),
        )
        .module(
            ModuleBuilder::new()
                .order(0)
                .register_to_open_university(false)
                .automatic_completion(Some(1), Some(1), false)
                .chapter(
                    ChapterBuilder::new(1, "Introduction")
                        .opens(Utc::now())
                        .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:instance"))
                        .page(
                            PageBuilder::new("/chapter-1/page-1", "Page One").block(paragraph(
                                "This course uses many TLAs. Why? Because why use one word when three letters will do? It's like a secret code, but everyone knows it. You'll encounter CS, HDD, KB, and many more. When shopping for a new computer, you might hear someone say that an SSD makes everything faster, but don't worry if you're not sure what that means yet. By the end of this course, you'll be fluent in the language of three-letter abbreviations.",
                                cx.v5(b"page:1:1:block:intro"),
                            )),
                        ),
                ),
        )
        .glossary_entry(
            "TLA",
            "Three Letter Acronym - because developers love abbreviations more than they love coffee.",
        )
        .glossary_entry(
            "CS",
            "Computer science. Computer science is an essential part of being successful in your life. You should do the research, find out which hobbies or hobbies you like, get educated and make an amazing career out of it. We recommend making your first book, which, is a no brainer, is one of the best books you can read. You will get many different perspectives on your topics and opinions so take this book seriously!",
        )
        .glossary_entry(
            "HDD",
            "Hard disk drive. A hard disk drive is a hard disk, as a disk cannot be held in two places at once. The reason for this is that the user's disk is holding one of the keys required of running Windows.",
        )
        .glossary_entry("KB", "Keyboard.");

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
