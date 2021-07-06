use anyhow::Result;
use chrono::Utc;
use headless_lms_actix::models::{
    chapters, course_instances, course_instances::VariantStatus, courses, exercise_services,
    exercise_tasks, exercises, organizations, pages, roles, roles::UserRole, submissions, users,
};
use headless_lms_actix::setup_tracing;
use headless_lms_actix::utils::document_schema_processor::GutenbergBlock;
use sqlx::migrate::MigrateDatabase;
use sqlx::{Connection, PgConnection, Postgres};
use std::{env, fs::File, process::Command};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok();
    setup_tracing()?;

    let clean = env::args().any(|a| a == "clean");
    let db_url = env::var("DATABASE_URL")?;
    let seed_path = "./db/seed";

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
    let cs_intro = seed_cs_intro(&mut conn, uh_cs, admin).await?;
    let cs_course = courses::insert(
        &mut conn,
        "Introduction to Computer Science",
        uh_cs,
        "Introduction to Computer Science",
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

    let _example_exercise_exercise_service = exercise_services::insert_exercise_service(
        &mut conn,
        "Example Exercise",
        "example-exercise",
        "http://project-331.local/example-exercise/api/service-info",
        "http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info",
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

async fn seed_cs_intro(conn: &mut PgConnection, org: Uuid, admin: Uuid) -> Result<Uuid> {
    let course = courses::insert(
        conn,
        "Introduction to everything",
        org,
        "introduction-to-everything",
    )
    .await?;
    let course_instance = course_instances::insert(conn, course, None).await?;

    // pages and chapters
    let _page = pages::insert(
        conn,
        course,
        "/",
        "Welcome to Introduction to Everything",
        1,
    )
    .await?;
    let page_ch1_1 = pages::insert(conn, course, "/chapter-1", "Chapter One", 1).await?;
    let page_ch1_2 = pages::insert(conn, course, "/chapter-1/page-2", "page 2", 2).await?;
    let page_ch2 = pages::insert(conn, course, "/chapter-2", "In the second chapter...", 1).await?;
    let chapter_1 = chapters::insert(conn, "The Basics", course, 1).await?;
    chapters::set_opens_at(conn, chapter_1, Utc::now()).await?;
    let chapter_2 = chapters::insert(conn, "The intermediaries", course, 2).await?;
    chapters::set_opens_at(conn, chapter_2, Utc::now() + chrono::Duration::minutes(10)).await?;
    let chapter_3 = chapters::insert(conn, "Advanced studies", course, 3).await?;
    chapters::set_opens_at(conn, chapter_3, Utc::now() + chrono::Duration::minutes(20)).await?;
    let chapter_4 = chapters::insert(conn, "Forbidden magicks", course, 4).await?;
    chapters::set_opens_at(
        conn,
        chapter_4,
        Utc::now() + (chrono::Duration::days(365) * 100),
    )
    .await?;
    chapters::set_front_page(conn, chapter_1, page_ch1_1).await?;
    chapters::set_front_page(conn, chapter_2, page_ch2).await?;
    pages::set_chapter(conn, page_ch1_1, chapter_1).await?;
    pages::set_chapter(conn, page_ch1_2, chapter_1).await?;
    pages::set_chapter(conn, page_ch2, chapter_2).await?;

    // exercises
    let exercise_c1p1_1 = exercises::insert(conn, course, "Best exercise", page_ch1_1, 1).await?;
    let exercise_c1p2_1 =
        exercises::insert(conn, course, "Second page, first exercise", page_ch1_2, 1).await?;
    let exercise_c1p2_2 =
        exercises::insert(conn, course, "second page, second exercise", page_ch1_2, 2).await?;
    let exercise_c1p2_3 =
        exercises::insert(conn, course, "second page, third exercise", page_ch1_2, 3).await?;
    let exercise_c2p1_1 =
        exercises::insert(conn, course, "first exercise of chapter two", page_ch2, 3).await?;
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
                    "contet": "First chapters second page.",
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
    let id_1 = Uuid::new_v4().to_string();
    let id_2 = Uuid::new_v4().to_string();
    let id_3 = Uuid::new_v4().to_string();
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
    let _exercise_task_c2p1e1_1 = exercise_tasks::insert(
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
    let _exercise_task_c1p2e2_1 = exercise_tasks::insert(
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
    let _exercise_task_c2p1e1_1 = exercise_tasks::insert(
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
        conn,
        exercise_c1p1_1,
        course,
        exercise_task_c1p1e1_1,
        admin,
        course_instance,
    )
    .await?;
    let _submission_2 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course,
        exercise_task_c1p1e1_1,
        admin,
        course_instance,
    )
    .await?;
    let _submission_3 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course,
        exercise_task_c1p1e1_1,
        admin,
        course_instance,
    )
    .await?;
    let _submission_4 = submissions::insert(
        conn,
        exercise_c1p1_1,
        course,
        exercise_task_c1p1e1_1,
        admin,
        course_instance,
    )
    .await?;

    Ok(course)
}
