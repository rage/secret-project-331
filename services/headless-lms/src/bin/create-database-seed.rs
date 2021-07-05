use anyhow::Result;
use headless_lms_actix::models::roles::UserRole;
use headless_lms_actix::models::{
    chapters, course_instances, courses, exercise_services, exercise_tasks, exercises,
    organizations, pages, roles, submissions, users,
};
use headless_lms_actix::utils::document_schema_processor::GutenbergBlock;
use headless_lms_actix::{models::course_instances::VariantStatus, setup_tracing};
use sqlx::{Connection, PgConnection};
use std::env;
use std::fs::File;
use std::process::Command;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok();
    setup_tracing()?;

    let db_url = env::var("DATABASE_URL").unwrap();
    let seed_path = "./db/seed";
    let mut conn = PgConnection::connect(&db_url).await?;

    // users
    let admin = users::insert(&mut conn).await?;
    let teacher = users::insert(&mut conn).await?;
    let assistant = users::insert(&mut conn).await?;

    // uh-cs
    let uh_cs = organizations::insert(
        &mut conn,
        "University of Helsinki, Department of Computer Science",
        "uh-cs",
    )
    .await?;

    let _example_exercise_exercise_service = exercise_services::insert_exercise_service(
        &mut conn,
        "Example Exercise",
        "example-exercise",
        "http://project-331.local/example-exercise/api/service-info",
        "http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info",
    )
    .await?;

    // uh-cs intro
    let intro_course = courses::insert(
        &mut conn,
        "Introduction to everything",
        uh_cs,
        "introduction-to-everything",
    )
    .await?;
    let intro_course_instance = course_instances::insert(&mut conn, intro_course, None).await?;
    // uh-cs intro pages and chapters
    let intro_page_1 = pages::insert(
        &mut conn,
        intro_course,
        "/",
        "Welcome to Introduction to Everything",
        1,
    )
    .await?;
    let intro_page_2 =
        pages::insert(&mut conn, intro_course, "/chapter-1/page-2", "page 2", 2).await?;
    let intro_page_3 =
        pages::insert(&mut conn, intro_course, "/", "In the second chapter...", 1).await?;
    let intro_chapter_1 = chapters::insert(&mut conn, "The Basics", intro_course, 1).await?;
    let intro_chapter_2 =
        chapters::insert(&mut conn, "The intermediaries", intro_course, 2).await?;
    chapters::set_front_page(&mut conn, intro_chapter_1, intro_page_1).await?;
    chapters::set_front_page(&mut conn, intro_chapter_2, intro_page_3).await?;
    pages::set_chapter(&mut conn, intro_page_1, intro_chapter_1).await?;
    pages::set_chapter(&mut conn, intro_page_2, intro_chapter_1).await?;
    pages::set_chapter(&mut conn, intro_page_3, intro_chapter_2).await?;
    // uh-cs intro exercises
    let intro_exercise_page1_1 =
        exercises::insert(&mut conn, intro_course, "Best exercise", intro_page_1, 1).await?;
    let intro_exercise_page2_1 = exercises::insert(
        &mut conn,
        intro_course,
        "Second page, first exercise",
        intro_page_2,
        1,
    )
    .await?;
    let intro_exercise_page2_2 = exercises::insert(
        &mut conn,
        intro_course,
        "second page, second exercise",
        intro_page_2,
        2,
    )
    .await?;
    let intro_exercise_page2_3 = exercises::insert(
        &mut conn,
        intro_course,
        "second page, third exercise",
        intro_page_2,
        3,
    )
    .await?;
    pages::update_content(
        &mut conn,
        intro_page_1,
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
                    "id": intro_exercise_page1_1.to_string(),
                }),
                inner_blocks: vec![],
            },
        ],
    )
    .await?;
    pages::update_content(
        &mut conn,
        intro_page_2,
        &[
            GutenbergBlock {
                name: "core/paragraph".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({
                    "contet": "First chapters second page.",
                    "dropCap": false,
                }),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({"id": intro_exercise_page2_1.to_string()}),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({"id": intro_exercise_page2_2.to_string()}),
                inner_blocks: vec![],
            },
            GutenbergBlock {
                name: "moocfi/exercise".to_string(),
                is_valid: true,
                client_id: Uuid::new_v4().to_string(),
                attributes: serde_json::json!({"id": intro_exercise_page2_3.to_string()}),
                inner_blocks: vec![],
            },
        ],
    )
    .await?;
    pages::update_content(
        &mut conn,
        intro_page_3,
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
                attributes: serde_json::json!({"id": Uuid::new_v4().to_string()}),
                inner_blocks: vec![],
            },
        ],
    )
    .await?;
    // uh-cs intro exercise tasks
    let id_1 = Uuid::new_v4().to_string();
    let id_2 = Uuid::new_v4().to_string();
    let id_3 = Uuid::new_v4().to_string();
    let intro_exercise_task_1_1 = exercise_tasks::insert(
        &mut conn,
        intro_exercise_page1_1,
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
            "id": id_1,
            "name": "a",
            "correct": false,
        },
        {
            "id": id_2,
            "name": "b",
            "correct": true,
        },
        {
            "id": id_3,
            "name": "c",
            "correct": true,
        }]),
        serde_json::json!([{
            "id": id_1,
            "name": "a",

        },{
            "id": id_2,
            "name": "b",

        },{
            "id": id_3,
            "name": "c",

        }]),
    )
    .await?;
    let id_1 = Uuid::new_v4().to_string();
    let id_2 = Uuid::new_v4().to_string();
    let id_3 = Uuid::new_v4().to_string();
    let _intro_exercise_task_2_1 = exercise_tasks::insert(
        &mut conn,
        intro_exercise_page2_1,
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
            "id": id_1,
            "name": "a",
            "correct": false,
        }, {
            "id": id_2,
            "name": "b",
            "correct": true,
        }, {
            "id": id_3,
            "name": "c",
            "correct": false,
        }]),
        serde_json::json!([{
            "id": id_1,
            "name": "a",
        }, {
            "id": id_2,
            "name": "b",
        }, {
            "id": id_3,
            "name": "c",
        }]),
    )
    .await?;
    let id_1 = Uuid::new_v4().to_string();
    let id_2 = Uuid::new_v4().to_string();
    let id_3 = Uuid::new_v4().to_string();
    let _intro_exercise_task_2_2 = exercise_tasks::insert(
        &mut conn,
        intro_exercise_page2_2,
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
            "id": id_1,
            "name": "a",
            "correct": false,
        },{
            "id": id_2,
            "name": "b",
            "correct": true,
        },{
            "id": id_3,
            "name": "c",
            "correct": false,
        }]),
        serde_json::json!([{
            "id": id_1,
            "name": "a",
        },{
            "id": id_2,
            "name": "b",
        },{
            "id": id_3,
            "name": "c",
        }]),
    )
    .await?;
    let id_1 = Uuid::new_v4().to_string();
    let id_2 = Uuid::new_v4().to_string();
    let id_3 = Uuid::new_v4().to_string();
    let _intro_exercise_task_2_3 = exercise_tasks::insert(
        &mut conn,
        intro_exercise_page2_3,
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
            "id": id_1,
            "name": "a",
            "correct": false,
        },{
            "id": id_2,
            "name": "b",
            "correct": true,
        },{
            "id": id_3,
            "name": "c",
            "correct": true
        }]),
        serde_json::json!([{
            "id": id_1,
            "name": "a",
        },{
            "id": id_2,
            "name": "b",
        },{
            "id": id_3,
            "name": "c",
        }]),
    )
    .await?;
    // uh-cs intro submissions
    let _submission_1 = submissions::insert(
        &mut conn,
        intro_exercise_page1_1,
        intro_course,
        intro_exercise_task_1_1,
        admin,
        intro_course_instance,
    )
    .await?;
    let _submission_2 = submissions::insert(
        &mut conn,
        intro_exercise_page1_1,
        intro_course,
        intro_exercise_task_1_1,
        admin,
        intro_course_instance,
    )
    .await?;
    let _submission_3 = submissions::insert(
        &mut conn,
        intro_exercise_page1_1,
        intro_course,
        intro_exercise_task_1_1,
        admin,
        intro_course_instance,
    )
    .await?;
    let _submission_4 = submissions::insert(
        &mut conn,
        intro_exercise_page1_1,
        intro_course,
        intro_exercise_task_1_1,
        admin,
        intro_course_instance,
    )
    .await?;

    // uh-cs cs
    let cs_course = courses::insert(
        &mut conn,
        "Introduction to Computer Science",
        uh_cs,
        "introduction-to-computer-science",
    )
    .await?;
    let _cs_course_instance =
        course_instances::insert(&mut conn, cs_course, Some(VariantStatus::Upcoming)).await?;

    // uh-mathstat
    let uh_mathstat = organizations::insert(
        &mut conn,
        "University of Helsinki, Department of Mathematics and Statistics",
        "uh-mathstat",
    )
    .await?;
    let statistics_course = courses::insert(
        &mut conn,
        "Introduction to Statistics",
        uh_mathstat,
        "introduction-to-statistics",
    )
    .await?;
    let _statistics_course_instance =
        course_instances::insert(&mut conn, statistics_course, Some(VariantStatus::Active)).await?;

    // roles
    roles::insert(&mut conn, admin, None, None, UserRole::Admin).await?;
    roles::insert(&mut conn, teacher, Some(uh_cs), None, UserRole::Teacher).await?;
    roles::insert(
        &mut conn,
        assistant,
        Some(uh_cs),
        Some(intro_course),
        UserRole::Assistant,
    )
    .await?;

    // dump database
    let output = tokio::task::spawn_blocking(move || {
        let file = File::create(seed_path).unwrap();
        Command::new("pg_dump")
            .arg("--data-only")
            .arg("--format=custom")
            .arg("--exclude-table=_sqlx_migrations")
            .arg(db_url)
            .stdout(file)
            .status()
    })
    .await??;
    assert!(output.success());

    Ok(())
}
