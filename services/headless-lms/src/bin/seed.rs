use anyhow::Result;
use chrono::Utc;
use headless_lms_actix::models::chapters::NewChapter;
use headless_lms_actix::models::courses::NewCourse;
use headless_lms_actix::models::exercises::GradingProgress;
use headless_lms_actix::models::gradings;
use headless_lms_actix::models::submissions::GradingResult;
use headless_lms_actix::models::{
    chapters, course_instances, course_instances::VariantStatus, courses, exercise_services,
    exercise_tasks, exercises, organizations, pages, roles, roles::UserRole, submissions,
    user_exercise_states, users,
};
use headless_lms_actix::setup_tracing;
use headless_lms_actix::utils::document_schema_processor::GutenbergBlock;
use serde_json::Value;
use sqlx::migrate::MigrateDatabase;
use sqlx::{Connection, PgConnection, Postgres};
use std::{env, process::Command};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok();
    setup_tracing()?;

    let clean = env::args().any(|a| a == "clean");
    let db_url = env::var("DATABASE_URL")?;

    if clean {
        // hardcoded for now
        let status = Command::new("dropdb")
            .args(["-U", "headless-lms"])
            .args(["-h", "localhost"])
            .args(["-p", "54328"])
            .arg("--force")
            .arg("-e")
            .arg("headless_lms_dev")
            .status()?;
        assert!(status.success());
        Postgres::create_database(&db_url).await?;
    }
    let mut conn = PgConnection::connect(&db_url).await?;
    if clean {
        sqlx::migrate!("./migrations").run(&mut conn).await?;
    }

    // users
    let admin = users::insert_with_id(
        &mut conn,
        "admin@example.com",
        Uuid::parse_str("02c79854-da22-4cfc-95c4-13038af25d2e")?,
    )
    .await?;
    let teacher = users::insert_with_id(
        &mut conn,
        "teacher@example.com",
        Uuid::parse_str("90643204-7656-4570-bdd9-aad5d297f9ce")?,
    )
    .await?;
    let assistant = users::insert_with_id(
        &mut conn,
        "assistant@example.com",
        Uuid::parse_str("24342539-f1ba-453e-ae13-14aa418db921")?,
    )
    .await?;

    let _user = users::insert_with_id(
        &mut conn,
        "user@example.com",
        Uuid::parse_str("849b8d32-d5f8-4994-9d21-5aa6259585b1")?,
    )
    .await?;

    // uh-cs
    let uh_cs = organizations::insert(
        &mut conn,
        "University of Helsinki, Department of Computer Science",
        "uh-cs",
        Uuid::parse_str("8bb12295-53ac-4099-9644-ac0ff5e34d92")?,
    )
    .await?;
    let cs_intro = seed_cs_intro(&mut conn, uh_cs, admin, teacher).await?;
    let _cs_design = seed_cs_course_material(&mut conn, uh_cs).await?;
    let new_course = NewCourse {
        name: "Introduction to Computer Science".to_string(),
        slug: "introduction-to-computer-science".to_string(),
        organization_id: uh_cs,
    };
    let (cs_course, _cs_front_page, _cs_default_course_instance) =
        courses::insert_course(&mut conn, new_course).await?;
    let _cs_course_instance = course_instances::insert(
        &mut conn,
        cs_course.id,
        Some("non-default instance"),
        Some(VariantStatus::Upcoming),
    )
    .await?;

    // uh-mathstat
    let uh_mathstat = organizations::insert(
        &mut conn,
        "University of Helsinki, Department of Mathematics and Statistics",
        "uh-mathstat",
        Uuid::parse_str("269d28b2-a517-4572-9955-3ed5cecc69bd")?,
    )
    .await?;
    let new_course = NewCourse {
        name: "Introduction to Statistics".to_string(),
        slug: "introduction-to-statistics".to_string(),
        organization_id: uh_mathstat,
    };
    let (statistics_course, _statistics_front_page, _statistics_default_course_instance) =
        courses::insert_course(&mut conn, new_course).await?;
    let _statistics_course_instance = course_instances::insert(
        &mut conn,
        statistics_course.id,
        Some("non-default instance"),
        Some(VariantStatus::Active),
    )
    .await?;

    let _example_exercise_exercise_service = exercise_services::insert_exercise_service(
        &mut conn,
        "Example Exercise",
        "example-exercise",
        "http://project-331.local/example-exercise/api/service-info",
        "http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info",
        5,
    )
    .await?;

    // roles
    roles::insert(&mut conn, admin, None, None, UserRole::Admin).await?;
    roles::insert(&mut conn, teacher, Some(uh_cs), None, UserRole::Teacher).await?;
    roles::insert(
        &mut conn,
        assistant,
        Some(uh_cs),
        Some(cs_intro),
        UserRole::Assistant,
    )
    .await?;

    Ok(())
}

async fn seed_cs_intro(
    conn: &mut PgConnection,
    org: Uuid,
    admin: Uuid,
    teacher: Uuid,
) -> Result<Uuid> {
    let new_course = NewCourse {
        name: "Introduction to Everything".to_string(),
        organization_id: org,
        slug: "introduction-to-everything".to_string(),
    };
    let (course, _front_page, _default_instance) = courses::insert_course(conn, new_course).await?;
    let course_instance =
        course_instances::insert(conn, course.id, Some("non-default instance"), None).await?;

    // pages and chapters
    let _page = pages::insert(
        conn,
        course.id,
        "/welcome",
        "Welcome to Introduction to Everything",
        1,
    )
    .await?;
    let page_ch1_1 = pages::insert(conn, course.id, "/chapter-1/page-1", "Page One", 1).await?;
    let page_ch1_2 = pages::insert(conn, course.id, "/chapter-1/page-2", "page 2", 2).await?;
    let page_ch2 = pages::insert(
        conn,
        course.id,
        "/chapter-2/intro",
        "In the second chapter...",
        1,
    )
    .await?;

    let new_chapter = NewChapter {
        chapter_number: 1,
        course_id: course.id,
        front_front_page_id: None,
        name: "The Basics".to_string(),
    };
    let (chapter_1, _front_page_1) = chapters::insert_chapter(conn, new_chapter).await?;
    chapters::set_opens_at(conn, chapter_1.id, Utc::now()).await?;
    let new_chapter = NewChapter {
        chapter_number: 2,
        course_id: course.id,
        front_front_page_id: None,
        name: "The intermediaries".to_string(),
    };
    let (chapter_2, _front_page_2) = chapters::insert_chapter(conn, new_chapter).await?;
    chapters::set_opens_at(
        conn,
        chapter_2.id,
        Utc::now() + chrono::Duration::minutes(10),
    )
    .await?;
    let new_chapter = NewChapter {
        chapter_number: 3,
        course_id: course.id,
        front_front_page_id: None,
        name: "Advanced studies".to_string(),
    };
    let (chapter_3, _front_page_3) = chapters::insert_chapter(conn, new_chapter).await?;
    chapters::set_opens_at(
        conn,
        chapter_3.id,
        Utc::now() + chrono::Duration::minutes(20),
    )
    .await?;
    let new_chapter = NewChapter {
        chapter_number: 4,
        course_id: course.id,
        front_front_page_id: None,
        name: "Forbidden magicks".to_string(),
    };
    let (chapter_4, _front_page_4) = chapters::insert_chapter(conn, new_chapter).await?;
    chapters::set_opens_at(
        conn,
        chapter_4.id,
        Utc::now() + (chrono::Duration::days(365) * 100),
    )
    .await?;
    pages::set_chapter(conn, page_ch1_1, chapter_1.id).await?;
    pages::set_chapter(conn, page_ch1_2, chapter_1.id).await?;
    pages::set_chapter(conn, page_ch2, chapter_2.id).await?;

    // exercises
    let exercise_c1p1_1 = exercises::insert(
        conn,
        course.id,
        "Best exercise",
        page_ch1_1,
        chapter_1.id,
        1,
    )
    .await?;
    let exercise_c1p2_1 = exercises::insert(
        conn,
        course.id,
        "Second page, first exercise",
        page_ch1_2,
        chapter_1.id,
        1,
    )
    .await?;
    let exercise_c1p2_2 = exercises::insert(
        conn,
        course.id,
        "Second page, second exercise",
        page_ch1_2,
        chapter_1.id,
        2,
    )
    .await?;
    let exercise_c1p2_3 = exercises::insert(
        conn,
        course.id,
        "Second page, third exercise",
        page_ch1_2,
        chapter_1.id,
        3,
    )
    .await?;
    let exercise_c2p1_1 = exercises::insert(
        conn,
        course.id,
        "First exercise of chapter two",
        page_ch2,
        chapter_2.id,
        3,
    )
    .await?;
    pages::update_content(
        conn,
        page_ch1_1,
        &[
            GutenbergBlock {
                name: "core/paragraph".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({
                    "content": "Everything is a big topic",
                    "dropCap": false,
                }),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({
                    "id": exercise_c1p1_1.to_string(),
                }),
                inner_blocks: vec![],
            },
        ],
    )
    .await?;
    pages::update_content(
        conn,
        page_ch1_2,
        &[
            GutenbergBlock {
                name: "core/paragraph".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({
                    "content": "First chapters second page.",
                    "dropCap": false,
                }),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({"id": exercise_c1p2_1.to_string()}),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({"id": exercise_c1p2_2.to_string()}),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({"id": exercise_c1p2_3.to_string()}),
                inner_blocks: vec![],
            },
        ],
    )
    .await?;
    pages::update_content(
        conn,
        page_ch2,
        &[
            GutenbergBlock {
                name: "core/paragraph".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({
                    "content": "Everything is a big topic.",
                    "dropCap": false,
                }),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({ "id": exercise_c2p1_1 }),
                inner_blocks: vec![],
            },
        ],
    )
    .await?;

    // exercise tasks
    let spec_c1p1e1t1_1 = Uuid::new_v4().to_string();
    let spec_c1p1e1t1_2 = Uuid::new_v4().to_string();
    let spec_c1p1e1t1_3 = Uuid::new_v4().to_string();
    let exercise_task_c1p1e1_1 = exercise_tasks::insert(
        conn,
        exercise_c1p1_1,
        "example-exercise",
        vec![GutenbergBlock {
            name: "core/paragraph".to_string(),
            is_valid: true,
            client_id: Uuid::new_v4().to_string(),
            attributes: serde_json::json!({
                "content": "Answer this question.",
                "dropCap": false,
            }),
            inner_blocks: vec![],
        }],
        serde_json::json!([{
            "id": spec_c1p1e1t1_1,
            "name": "a",
            "correct": false,
        },
        {
            "id": spec_c1p1e1t1_2,
            "name": "b",
            "correct": true,
        },
        {
            "id": spec_c1p1e1t1_3,
            "name": "c",
            "correct": true,
        }]),
        serde_json::json!([{
            "id": spec_c1p1e1t1_1,
            "name": "a",

        },{
            "id": spec_c1p1e1t1_2,
            "name": "b",

        },{
            "id": spec_c1p1e1t1_3,
            "name": "c",

        }]),
        serde_json::json!([spec_c1p1e1t1_2, spec_c1p1e1t1_3]),
    )
    .await?;
    let spec_c1p2e1t1_1 = Uuid::new_v4().to_string();
    let spec_c1p2e1t1_2 = Uuid::new_v4().to_string();
    let spec_c1p2e1t1_3 = Uuid::new_v4().to_string();
    let exercise_task_c1p2e1_1 = exercise_tasks::insert(
        conn,
        exercise_c1p2_1,
        "example-exercise",
        vec![GutenbergBlock {
            name: "core/paragraph".to_string(),
            is_valid: true,
            client_id: Uuid::new_v4().to_string(),
            attributes: serde_json::json!({
                "content": "Answer this question.",
                "dropCap": false,
            }),
            inner_blocks: vec![],
        }],
        serde_json::json!([{
            "id": spec_c1p2e1t1_1,
            "name": "a",
            "correct": false,
        }, {
            "id": spec_c1p2e1t1_2,
            "name": "b",
            "correct": true,
        }, {
            "id": spec_c1p2e1t1_3,
            "name": "c",
            "correct": false,
        }]),
        serde_json::json!([{
            "id": spec_c1p2e1t1_1,
            "name": "a",
        }, {
            "id": spec_c1p2e1t1_2,
            "name": "b",
        }, {
            "id": spec_c1p2e1t1_3,
            "name": "c",
        }]),
        serde_json::json!([spec_c1p2e1t1_2]),
    )
    .await?;
    let spec_c1p2e2t1_1 = Uuid::new_v4().to_string();
    let spec_c1p2e2t1_2 = Uuid::new_v4().to_string();
    let spec_c1p2e2t1_3 = Uuid::new_v4().to_string();
    let exercise_task_c1p2e2_1 = exercise_tasks::insert(
        conn,
        exercise_c1p2_2,
        "example-exercise",
        vec![GutenbergBlock {
            name: "core/paragraph".to_string(),
            is_valid: true,
            client_id: Uuid::new_v4().to_string(),
            attributes: serde_json::json!({
                "content": "Answer this question.",
                "dropCap": false,
            }),
            inner_blocks: vec![],
        }],
        serde_json::json!([{
            "id": spec_c1p2e2t1_1,
            "name": "a",
            "correct": false,
        },{
            "id": spec_c1p2e2t1_2,
            "name": "b",
            "correct": true,
        },{
            "id": spec_c1p2e2t1_3,
            "name": "c",
            "correct": false,
        }]),
        serde_json::json!([{
            "id": spec_c1p2e2t1_1,
            "name": "a",
        },{
            "id": spec_c1p2e2t1_2,
            "name": "b",
        },{
            "id": spec_c1p2e2t1_3,
            "name": "c",
        }]),
        serde_json::json!([spec_c1p2e2t1_2]),
    )
    .await?;
    let spec_c2p1e1t1_1 = Uuid::new_v4().to_string();
    let spec_c2p1e1t1_2 = Uuid::new_v4().to_string();
    let spec_c2p1e1t1_3 = Uuid::new_v4().to_string();
    let exercise_task_c2p1e1_1 = exercise_tasks::insert(
        conn,
        exercise_c2p1_1,
        "example-exercise",
        vec![GutenbergBlock {
            name: "core/paragraph".to_string(),
            is_valid: true,
            client_id: Uuid::new_v4().to_string(),
            attributes: serde_json::json!({
                "content": "Answer this question.",
                "dropCap": false,
            }),
            inner_blocks: vec![],
        }],
        serde_json::json!([{
            "id": spec_c2p1e1t1_1,
            "name": "a",
            "correct": false,
        },{
            "id": spec_c2p1e1t1_2,
            "name": "b",
            "correct": true,
        },{
            "id": spec_c2p1e1t1_3,
            "name": "c",
            "correct": true
        }]),
        serde_json::json!([{
            "id": spec_c2p1e1t1_1,
            "name": "a",
        },{
            "id": spec_c2p1e1t1_2,
            "name": "b",
        },{
            "id": spec_c2p1e1t1_3,
            "name": "c",
        }]),
        serde_json::json!([spec_c2p1e1t1_2, spec_c2p1e1t1_3]),
    )
    .await?;

    // submissions
    let submission_admin_c1p1e1t1_1 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course.id,
        exercise_task_c1p1e1_1,
        admin,
        course_instance.id,
        Value::String(spec_c1p1e1t1_1.to_string()),
    )
    .await?;
    let submission_admin_c1p1e1t1_2 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course.id,
        exercise_task_c1p1e1_1,
        admin,
        course_instance.id,
        Value::String(spec_c1p1e1t1_2.to_string()),
    )
    .await?;
    let submission_admin_c1p1e1t1_3 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course.id,
        exercise_task_c1p1e1_1,
        admin,
        course_instance.id,
        Value::String(spec_c1p1e1t1_3.to_string()),
    )
    .await?;
    let _submission_admin_c1p1e1t1_4 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course.id,
        exercise_task_c1p1e1_1,
        admin,
        course_instance.id,
        Value::String(spec_c1p1e1t1_1.to_string()),
    )
    .await?;
    let submission_admin_c1p2e1t1 = submissions::insert(
        conn,
        exercise_c1p2_1,
        course.id,
        exercise_task_c1p2e1_1,
        admin,
        course_instance.id,
        Value::String(spec_c1p2e1t1_1.to_string()),
    )
    .await?;
    let submission_admin_c1p2e2t1 = submissions::insert(
        conn,
        exercise_c1p2_2,
        course.id,
        exercise_task_c1p2e2_1,
        admin,
        course_instance.id,
        Value::String(spec_c1p2e2t1_1.to_string()),
    )
    .await?;
    let submission_admin_c2p1e1t1 = submissions::insert(
        conn,
        exercise_c2p1_1,
        course.id,
        exercise_task_c2p1e1_1,
        admin,
        course_instance.id,
        Value::String(spec_c2p1e1t1_1.to_string()),
    )
    .await?;
    let submission_teacher_c1p1e1t1 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course.id,
        exercise_task_c1p1e1_1,
        teacher,
        course_instance.id,
        Value::String(spec_c1p1e1t1_1.to_string()),
    )
    .await?;

    // intro gradings
    grade(
        conn,
        submission_admin_c1p1e1t1_1,
        exercise_c1p1_1,
        GradingProgress::FullyGraded,
        100.0,
        100,
    )
    .await?;
    // this grading is for the same exercise, but no points are removed due to the update strategy
    grade(
        conn,
        submission_admin_c1p1e1t1_2,
        exercise_c1p1_1,
        GradingProgress::Failed,
        1.0,
        100,
    )
    .await?;
    // this grading is for the same exercise, but no points are removed due to the update strategy
    grade(
        conn,
        submission_admin_c1p1e1t1_3,
        exercise_c1p1_1,
        GradingProgress::Pending,
        0.0,
        100,
    )
    .await?;
    grade(
        conn,
        submission_admin_c1p2e1t1,
        exercise_c1p2_1,
        GradingProgress::FullyGraded,
        60.0,
        100,
    )
    .await?;
    grade(
        conn,
        submission_admin_c1p2e2t1,
        exercise_c1p2_2,
        GradingProgress::FullyGraded,
        70.0,
        100,
    )
    .await?;
    grade(
        conn,
        submission_admin_c2p1e1t1,
        exercise_c2p1_1,
        GradingProgress::FullyGraded,
        80.0,
        100,
    )
    .await?;
    grade(
        conn,
        submission_teacher_c1p1e1t1,
        exercise_c1p1_1,
        GradingProgress::FullyGraded,
        90.0,
        100,
    )
    .await?;

    Ok(course.id)
}

async fn grade(
    conn: &mut PgConnection,
    sub_id: Uuid,
    ex_id: Uuid,
    grading_progress: GradingProgress,
    score_given: f32,
    score_maximum: i32,
) -> Result<()> {
    let submission = submissions::get_by_id(conn, sub_id).await?;
    let grading = gradings::new_grading(conn, &submission).await?;
    let grading_result = GradingResult {
        feedback_json: None,
        feedback_text: None,
        grading_progress,
        score_given,
        score_maximum,
    };
    let exercise = exercises::get_by_id(conn, ex_id).await?;
    let grading = gradings::update_grading(conn, &grading, &grading_result, &exercise).await?;
    submissions::set_grading_id(conn, grading.id, submission.id).await?;
    user_exercise_states::update_user_exercise_state(conn, &grading, &submission).await?;
    Ok(())
}

async fn seed_cs_course_material(conn: &mut PgConnection, org: Uuid) -> Result<Uuid> {
    // Create new course
    let new_course = NewCourse {
        name: "Introduction to Course Material".to_string(),
        organization_id: org,
        slug: "introduction-to-course-material".to_string(),
    };
    let (course, front_page, _default_instance) = courses::insert_course(conn, new_course).await?;

    // Set / page data
    pages::update_content(
        conn,
        front_page.id,
        &[
            GutenbergBlock::block_with_name_and_attributes("core/heading", serde_json::json!({
                "textAlign": "center",
                "content": "Course Material Main Front Page",
                "level": 1
            })),
            GutenbergBlock::block_with_name_and_attributes("core/paragraph", serde_json::json!({
                "align": "center",
                "content": "The Introduction to Course Material is a free online course created by the University of Helsinki. The course is for anyone who is interested in design systems – we want to encourage people to learn some frontend development, what can and can’t be done in a sustainable way, and how to start thinking about design from an user point of view.",
                "dropCap": false
            })),
            GutenbergBlock {
                name: "core/columns".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({
                    "isStackedOnMobile": true
                }),
                inner_blocks: vec![
                    GutenbergBlock {
                        name: "core/column".to_string(),
                        is_valid: true,
                        client_id: Uuid::new_v4().to_string(),
                        attributes: serde_json::json!({
                            "width": "100%",
                            "backgroundColor": "cyan-bluish-gray"
                        }),
                        inner_blocks: vec![
                            GutenbergBlock::block_with_name_and_attributes("core/heading", serde_json::json!({
                                "content": "In this course you'll...",
                                "level": 2,
                                "textAlign": "center"
                            })),
                            GutenbergBlock {
                                name: "core/columns".to_string(),
                                is_valid: true,
                                client_id: Uuid::new_v4().to_string(),
                                attributes: serde_json::json!({
                                    "isStackedOnMobile": true
                                }),
                                inner_blocks: vec![
                                    GutenbergBlock {
                                        name: "core/column".to_string(),
                                        is_valid: true,
                                        client_id: Uuid::new_v4().to_string(),
                                        attributes: serde_json::json!({}),
                                        inner_blocks: vec![
                                            GutenbergBlock::block_with_name_and_attributes("core/paragraph", serde_json::json!({
                                                "content": "Discover why user interface matters.",
                                                "dropCap": false
                                              }))
                                        ]
                                    },
                                    GutenbergBlock {
                                        name: "core/column".to_string(),
                                        is_valid: true,
                                        client_id: Uuid::new_v4().to_string(),
                                        attributes: serde_json::json!({}),
                                        inner_blocks: vec![
                                            GutenbergBlock::block_with_name_and_attributes("core/paragraph", serde_json::json!({
                                                "content": "Become familiar with keywords, such as UX / UI.",
                                                "dropCap": false
                                              }))
                                        ]
                                    },
                                    GutenbergBlock {
                                        name: "core/column".to_string(),
                                        is_valid: true,
                                        client_id: Uuid::new_v4().to_string(),
                                        attributes: serde_json::json!({}),
                                        inner_blocks: vec![
                                            GutenbergBlock::block_with_name_and_attributes("core/paragraph", serde_json::json!({
                                                "content": "Learn how to think out of the box.",
                                                "dropCap": false
                                              }))
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ],
            },
            GutenbergBlock::empty_block_from_name("moocfi/course-chapter-grid".to_string()),
            GutenbergBlock::empty_block_from_name("moocfi/course-progress".to_string())
        ],
    )
    .await?;

    // FAQ, we should add card/accordion block to visualize here.
    let _page = pages::insert(conn, course.id, "/faq", "FAQ", 1).await?;

    // Chapter-1
    let new_chapter = NewChapter {
        chapter_number: 1,
        course_id: course.id,
        front_front_page_id: None,
        name: "User Interface".to_string(),
    };
    let (chapter_1, front_page_ch_1) = chapters::insert_chapter(conn, new_chapter).await?;
    chapters::set_opens_at(conn, chapter_1.id, Utc::now()).await?;

    pages::update_content(
        conn,
        front_page_ch_1.id,
        &[
            GutenbergBlock::block_with_name_and_attributes("core/heading", serde_json::json!({
                "textAlign": "center",
                "content": "User Interface",
                "level": 2
              })),
            GutenbergBlock::block_with_name_and_attributes("core/paragraph", serde_json::json!({
                "content": "In the industrial design field of human–computer interaction, a user interface is the space where interactions between humans and machines occur.",
                "dropCap": false,
                "align": "center"
              })),
            GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
            GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string()),
            GutenbergBlock::empty_block_from_name("moocfi/chapter-progress".to_string()),
        ],
    )
    .await?;
    // /chapter-1/design
    let page_ch1_1 = pages::insert(conn, course.id, "/chapter-1/design", "Design", 1).await?;
    pages::set_chapter(conn, page_ch1_1, chapter_1.id).await?;
    pages::update_content(
        conn,
        page_ch1_1,
        &[
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur bibendum felis nisi, vitae commodo mi venenatis in. Mauris hendrerit lacinia augue ut hendrerit. Vestibulum non tellus mattis, convallis magna vel, semper mauris. Maecenas porta, arcu eget porttitor sagittis, nulla magna auctor dolor, sed tempus sem lacus eu tortor. Ut id diam quam. Etiam quis sagittis justo. Quisque sagittis dolor vitae felis facilisis, ut suscipit ipsum malesuada. Nulla tempor ultricies erat ut venenatis. Ut pulvinar lectus non mollis efficitur.",
                  "dropCap": false
                }),
            ),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!( {
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                }),
            ),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                }),
            ),
        ],
    ).await?;

    // /chapter-1/human-machine-interface
    let page_ch1_2 = pages::insert(
        conn,
        course.id,
        "/chapter-1/human-machine-interface",
        "Human-machine interface",
        2,
    )
    .await?;
    pages::set_chapter(conn, page_ch1_2, chapter_1.id).await?;
    pages::update_content(
        conn,
        page_ch1_2,
        &[
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Sed venenatis, magna in ornare suscipit, orci ipsum consequat nulla, ut pulvinar libero metus et metus. Maecenas nec bibendum est. Donec quis ante elit. Nam in eros vitae urna aliquet vestibulum. Donec posuere laoreet facilisis. Aliquam auctor a tellus a tempus. Sed molestie leo eget commodo pellentesque. Curabitur lacinia odio nisl, eu sodales nunc placerat sit amet. Vivamus venenatis, risus vitae lobortis eleifend, odio nisi faucibus tortor, sed aliquet leo arcu et tellus. Donec ultrices consectetur nunc, non rhoncus sapien malesuada et. Nulla tempus ipsum vitae justo scelerisque, sed pretium neque fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur accumsan et ex pellentesque dignissim. Integer viverra libero quis tortor dignissim elementum.",
                  "dropCap": false
                }),
            ),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!( {
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                }),
            ),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                }),
            ),
        ],
    ).await?;

    // Chapter-2
    let new_chapter_2 = NewChapter {
        chapter_number: 2,
        course_id: course.id,
        front_front_page_id: None,
        name: "User Experience".to_string(),
    };
    let (chapter_2, front_page_ch_2) = chapters::insert_chapter(conn, new_chapter_2).await?;
    chapters::set_opens_at(conn, chapter_2.id, Utc::now()).await?;

    pages::update_content(
        conn,
        front_page_ch_2.id,
        &[
            GutenbergBlock::block_with_name_and_attributes("core/heading", serde_json::json!({
                "textAlign": "center",
                "content": "User Experience",
                "level": 2
              })),
            GutenbergBlock::block_with_name_and_attributes("core/paragraph", serde_json::json!({
                "content": "The user experience is how a user interacts with and experiences a product, system or service. It includes a person's perceptions of utility, ease of use, and efficiency.",
                "dropCap": false,
                "align": "center"
              })),
            GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
            GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string()),
            GutenbergBlock::empty_block_from_name("moocfi/chapter-progress".to_string()),
        ],
    )
    .await?;

    // /chapter-2/user-research
    let page_ch2_1 = pages::insert(
        conn,
        course.id,
        "/chapter-2/user-research",
        "User research",
        1,
    )
    .await?;
    pages::set_chapter(conn, page_ch2_1, chapter_2.id).await?;
    pages::update_content(
        conn,
        page_ch2_1,
        &[
            GutenbergBlock::block_with_name_and_attributes("core/heading", serde_json::json!({
                "content": "User Research",
                "level": 2
              })),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Sed venenatis, magna in ornare suscipit, orci ipsum consequat nulla, ut pulvinar libero metus et metus. Maecenas nec bibendum est. Donec quis ante elit. Nam in eros vitae urna aliquet vestibulum. Donec posuere laoreet facilisis. Aliquam auctor a tellus a tempus. Sed molestie leo eget commodo pellentesque. Curabitur lacinia odio nisl, eu sodales nunc placerat sit amet. Vivamus venenatis, risus vitae lobortis eleifend, odio nisi faucibus tortor, sed aliquet leo arcu et tellus. Donec ultrices consectetur nunc, non rhoncus sapien malesuada et. Nulla tempus ipsum vitae justo scelerisque, sed pretium neque fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur accumsan et ex pellentesque dignissim. Integer viverra libero quis tortor dignissim elementum.",
                  "dropCap": false
                }),
            ),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!( {
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                }),
            ),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                }),
            ),
        ],
    ).await?;

    Ok(course.id)
}
