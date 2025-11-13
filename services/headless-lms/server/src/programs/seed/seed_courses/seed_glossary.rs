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
                                "This course uses many TLAs. Why? Because why use one word when three letters will do? It's like a secret code, but everyone knows it. ABCD.",
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
        .glossary_entry(
            "SSD",
            "Solid-state drive. A solid-state drive is a hard drive that's a few gigabytes in size, but a solid-state drive is one where data loads are big enough and fast enough that you can comfortably write to it over long distances. This is what drives do. You need to remember that a good solid-state drive has a lot of data: it stores files on disks and has a few data centers. A good solid-state drive makes for a nice little library: its metadata includes information about everything it stores, including any data it can access, but does not store anything that does not exist outside of those files. It also stores large amounts of data from one location, which can cause problems since the data might be different in different places, or in different ways, than what you would expect to see when driving big data applications. The drives that make up a solid-state drive are called drives that use a variety of storage technologies. These drive technology technologies are called \"super drives,\" and they store some of that data in a solid-state drive. Super drives are designed to be fast but very big: they aren't built to store everything, but to store many kinds of data: including data about the data they contain, and more, like the data they are supposed to hold in them. The super drives that make up a solid-state drive can have capacities of up to 50,000 hard disks. These can be used to store files if",
        )
        .glossary_entry("KB", "Keyboard.");

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
