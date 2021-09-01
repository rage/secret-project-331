use anyhow::Result;
use chrono::{TimeZone, Utc};
use headless_lms_actix::models::chapters::NewChapter;
use headless_lms_actix::models::courses::NewCourse;
use headless_lms_actix::models::exercises::GradingProgress;
use headless_lms_actix::models::feedback::{FeedbackBlock, NewFeedback};
use headless_lms_actix::models::gradings;
use headless_lms_actix::models::pages::{NewPage, PageUpdate};
use headless_lms_actix::models::playground_examples::PlaygroundExampleData;
use headless_lms_actix::models::submissions::GradingResult;
use headless_lms_actix::models::{
    chapters, course_instances, course_instances::VariantStatus, courses, exercise_services,
    exercises, organizations, pages, roles, roles::UserRole, submissions, user_exercise_states,
    users,
};
use headless_lms_actix::models::{feedback, playground_examples};
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

    // exercise services
    let _example_exercise_exercise_service = exercise_services::insert_exercise_service(
        &mut conn,
        "Example Exercise",
        "example-exercise",
        "http://project-331.local/example-exercise/api/service-info",
        "http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info",
        5,
    )
    .await?;

    exercise_services::insert_exercise_service(
        &mut conn,
        "Quizzes",
        "quizzes",
        "http://project-331.local/quizzes/api/service-info",
        "http://quizzes.default.svc.cluster.local:3004/quizzes/api/service-info",
        5,
    )
    .await?;

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

    let student = users::insert_with_id(
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
        "Organization for Computer Science students and the rest of the world who wish to learn the basics in Computer Science, programming and software development.",
        Uuid::parse_str("8bb12295-53ac-4099-9644-ac0ff5e34d92")?,
    )
    .await?;

    let cs_intro = seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5")?,
        "Introduction to everything",
        "introduction-to-everything",
        admin,
        teacher,
        student,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("d18b3780-563d-4326-b311-8d0e132901cd")?,
        "Introduction to feedback",
        "introduction-to-feedback",
        admin,
        teacher,
        student,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("0ab2c4c5-3aad-4daa-a8fe-c26e956fde35")?,
        "Introduction to history",
        "introduction-to-history",
        admin,
        teacher,
        student,
    )
    .await?;

    let _cs_design = seed_cs_course_material(&mut conn, uh_cs, admin).await?;
    let new_course = NewCourse {
        name: "Introduction to Computer Science".to_string(),
        slug: "introduction-to-computer-science".to_string(),
        organization_id: uh_cs,
        language_code: "en-US".to_string(),
    };
    let (cs_course, _cs_front_page, _cs_default_course_instance) = courses::insert_course(
        &mut conn,
        Uuid::parse_str("06a7ccbd-8958-4834-918f-ad7b24e583fd")?,
        new_course,
        admin,
    )
    .await?;
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
        "Organization for Mathematics and Statistics courses. This organization creates courses that do require prior experience in mathematics, such as integration and induction.",
        Uuid::parse_str("269d28b2-a517-4572-9955-3ed5cecc69bd")?,
    )
    .await?;
    let new_course = NewCourse {
        name: "Introduction to Statistics".to_string(),
        slug: "introduction-to-statistics".to_string(),
        organization_id: uh_mathstat,
        language_code: "en-US".to_string(),
    };
    let (statistics_course, _statistics_front_page, _statistics_default_course_instance) =
        courses::insert_course(
            &mut conn,
            Uuid::parse_str("f307d05f-be34-4148-bb0c-21d6f7a35cdb")?,
            new_course,
            admin,
        )
        .await?;
    let _statistics_course_instance = course_instances::insert(
        &mut conn,
        statistics_course.id,
        Some("non-default instance"),
        Some(VariantStatus::Active),
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

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Example exercise".to_string(),
            url: "http://project-331.local/example-exercise/exercise".to_string(),
            width: 500,
            data: serde_json::json!([
              {
                "id": "cbf2f43c-dc89-4de5-9b23-688a76b838cd",
                "name": "a"
              },
              {
                "id": "f6386ed9-9bfa-46cf-82b9-77646a9721c6",
                "name": "b"
              },
              {
                "id": "c988be91-caf7-4196-8cf6-18e1ae113a69",
                "name": "c"
              }
            ]),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice".to_string(),
            url: "http://project-331.local/quizzes/exercise".to_string(),
            width: 500,
            data: serde_json::json!([
              {
                "id": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
                "body": "quiz.body",
                //"2021-09-01T10:59:13.946Z"
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "quiz.title",
                "tries": 1,
                "triesLimited": false,
                "items": [
                    {
                        "id": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                        "body": "item.body",
                        "direction": "row",
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": true,
                        "order": 1,
                        "quizId": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                        "title": "item.title",
                        "type": "multiple-choice",
                        "options": [
                            {
                                "id": "8d17a216-9655-4558-adfb-cf66fb3e08ba",
                                "body": "option1.body",
                                "order": 1,
                                "title": "option1.title",
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "11e0f3ac-fe21-4524-93e6-27efd4a92595",
                                "body": "option2.body",
                                "order": 2,
                                "title": "option2.title",
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "e0033168-9f92-4d71-9c23-7698de9ea3b0",
                                "body": "option3.body",
                                "order": 3,
                                "title": "option3.title",
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            }
                        ]
                    }
                ]
              }
            ]),
        },
    )
    .await?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn seed_sample_course(
    conn: &mut PgConnection,
    org: Uuid,
    course_id: Uuid,
    course_name: &str,
    course_slug: &str,
    admin: Uuid,
    teacher: Uuid,
    student: Uuid,
) -> Result<Uuid> {
    let new_course = NewCourse {
        name: course_name.to_string(),
        organization_id: org,
        slug: course_slug.to_string(),
        language_code: "en-US".to_string(),
    };
    let (course, _front_page, _default_instance) =
        courses::insert_course(conn, course_id, new_course, admin).await?;
    let course_instance =
        course_instances::insert(conn, course.id, Some("non-default instance"), None).await?;

    // chapters and pages

    let new_chapter = NewChapter {
        chapter_number: 1,
        course_id: course.id,
        front_front_page_id: None,
        name: "The Basics".to_string(),
    };
    let (chapter_1, _front_page_1) = chapters::insert_chapter(conn, new_chapter, admin).await?;
    chapters::set_opens_at(conn, chapter_1.id, Utc::now()).await?;
    let new_chapter = NewChapter {
        chapter_number: 2,
        course_id: course.id,
        front_front_page_id: None,
        name: "The intermediaries".to_string(),
    };
    let (chapter_2, _front_page_2) = chapters::insert_chapter(conn, new_chapter, admin).await?;
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
    let (chapter_3, _front_page_3) = chapters::insert_chapter(conn, new_chapter, admin).await?;
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
    let (chapter_4, _front_page_4) = chapters::insert_chapter(conn, new_chapter, admin).await?;
    chapters::set_opens_at(
        conn,
        chapter_4.id,
        Utc::now() + (chrono::Duration::days(365) * 100),
    )
    .await?;

    let (_page, _) = pages::insert(
        conn,
        course.id,
        "/welcome",
        "Welcome to Introduction to Everything",
        1,
        admin,
    )
    .await?;

    let block_id_1 = Uuid::new_v5(&course_id, b"af3b467a-f5db-42ad-9b21-f42ca316b3c6");
    let block_id_2 = Uuid::new_v5(&course_id, b"465f1f95-22a1-43e1-b4a3-7d18e525dc12");
    let block_id_3 = Uuid::new_v5(&course_id, b"46aad5a8-71bd-49cd-8d86-3368ee8bb7ac");
    let block_id_4 = Uuid::new_v5(&course_id, b"09b327a8-8e65-437e-9678-554fc4d98dd4");
    let block_id_5 = Uuid::new_v5(&course_id, b"834648cc-72d9-42d1-bed7-cc6a2e186ae6");
    let block_id_6 = Uuid::new_v5(&course_id, b"223a4718-5287-49ff-853e-a67f4612c629");
    let exercise_c1p1_1 = Uuid::new_v5(&course_id, b"cfb950a7-db4e-49e4-8ec4-d7a32b691b08");
    let exercise_task_c1p1e1_1 = Uuid::new_v5(&course_id, b"f73dab3b-3549-422d-8377-ece1972e5576");
    let spec_c1p1e1t1_1 = Uuid::new_v5(&course_id, b"5f6b7850-5034-4cef-9dcf-e3fd4831067f");
    let spec_c1p1e1t1_2 = Uuid::new_v5(&course_id, b"c713bbfc-86bf-4877-bd39-53afaf4444b5");
    let spec_c1p1e1t1_3 = Uuid::new_v5(&course_id, b"4027d508-4fad-422e-bb7f-15c613a02cc6");
    create_page(
        conn,
        course.id,
        "/chapter-1/page-1",
        "Page One",
        admin,
        chapter_1.id,
        &[
            paragraph("Everything is a big topic.", block_id_1),
            example_exercise(
                exercise_c1p1_1,
                exercise_task_c1p1e1_1,
                block_id_2,
                block_id_3,
                Uuid::new_v5(&course_id, b"4e314af8-6857-4405-9ffe-4b8ce88e7376"),
                spec_c1p1e1t1_1,
                spec_c1p1e1t1_2,
                spec_c1p1e1t1_3,
            ),
            paragraph("So big, that we need many paragraphs.", block_id_4),
            paragraph("Like this.", block_id_5),
            paragraph(&"At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. ".repeat(16), block_id_6),
        ],
    )
    .await?;

    let exercise_c1p2_1 = Uuid::new_v5(&course_id, b"36e7f0c2-e663-4382-a503-081866cfe7d0");
    let exercise_task_c1p2e1_1 = Uuid::new_v5(&course_id, b"e7fca192-2161-4ab8-8533-8c41dbaa2d69");
    let spec_c1p2e1t1_1 = Uuid::new_v5(&course_id, b"5898293f-2d41-43b1-9e44-92d487196ade");
    let spec_c1p2e1t1_2 = Uuid::new_v5(&course_id, b"93d27d79-f9a1-44ab-839f-484accc67e32");
    let spec_c1p2e1t1_3 = Uuid::new_v5(&course_id, b"81ec2df2-a5fd-4d7d-b85f-0c304e8d2030");
    let exercise_c1p2_2 = Uuid::new_v5(&course_id, b"64d273eb-628f-4d43-a11a-e69ebe244942");
    let exercise_task_c1p2e2_1 = Uuid::new_v5(&course_id, b"114caac5-006a-4afb-9806-785154263c11");
    let spec_c1p2e2t1_1 = Uuid::new_v5(&course_id, b"28ea3062-bd6a-45f5-9844-03174e00a0a8");
    let spec_c1p2e2t1_2 = Uuid::new_v5(&course_id, b"1982f566-2d6a-485d-acb0-65d8b8864c7e");
    let spec_c1p2e2t1_3 = Uuid::new_v5(&course_id, b"01ec5329-2cf6-4d0f-92b2-d388360fb402");
    let exercise_c1p2_3 = Uuid::new_v5(&course_id, b"029688ec-c7be-4cb3-8928-85cfd6551083");
    let exercise_task_c1p2e3_1 = Uuid::new_v5(&course_id, b"382fffce-f177-47d0-a5c0-cc8906d34c49");
    let spec_c1p2e3t1_1 = Uuid::new_v5(&course_id, b"4bae54a3-d67c-428b-8996-290f70ae08fa");
    let spec_c1p2e3t1_2 = Uuid::new_v5(&course_id, b"c3f257c0-bdc2-4d81-99ff-a71c76fe670a");
    let spec_c1p2e3t1_3 = Uuid::new_v5(&course_id, b"fca5a8ba-50e0-4375-8d4b-9d02762d908c");
    create_page(
        conn,
        course.id,
        "/chapter-1/page-2",
        "page 2",
        admin,
        chapter_1.id,
        &[
            paragraph(
                "First chapters second page.",
                Uuid::new_v5(&course_id, b"9faf5a2d-f60d-4a70-af3d-0e7e3d6fe273"),
            ),
            example_exercise(
                exercise_c1p2_1,
                exercise_task_c1p2e1_1,
                Uuid::new_v5(&course_id, b"9fd9ac7d-7d41-4695-bedd-996c88606652"),
                Uuid::new_v5(&course_id, b"2dbb4649-bcac-47ab-a817-ca17dcd70378"),
                Uuid::new_v5(&course_id, b"c0986981-c8ae-4c0b-b558-1163a16760ec"),
                spec_c1p2e1t1_1,
                spec_c1p2e1t1_2,
                spec_c1p2e1t1_3,
            ),
            example_exercise(
                exercise_c1p2_2,
                exercise_task_c1p2e2_1,
                Uuid::new_v5(&course_id, b"c27c38ab-60aa-4a13-bb1a-a5d684802158"),
                Uuid::new_v5(&course_id, b"fb26489d-ca49-4f76-a1c2-f759ed3146c0"),
                Uuid::new_v5(&course_id, b"49b19886-0d1d-4a36-81ba-88a332d87b5b"),
                spec_c1p2e2t1_1,
                spec_c1p2e2t1_2,
                spec_c1p2e2t1_3,
            ),
            example_exercise(
                exercise_c1p2_3,
                exercise_task_c1p2e3_1,
                Uuid::new_v5(&course_id, b"5f800e49-7bd9-495f-9c78-19044be8c26d"),
                Uuid::new_v5(&course_id, b"334593ad-8ba5-4589-b1f7-b159e754bdc5"),
                Uuid::new_v5(&course_id, b"389e80bd-5f91-40c7-94ff-7dda1eeb96fb"),
                spec_c1p2e3t1_1,
                spec_c1p2e3t1_2,
                spec_c1p2e3t1_3,
            ),
        ],
    )
    .await?;

    let exercise_c2p1_1 = Uuid::new_v5(&course_id, b"8bb4faf4-9a34-4df7-a166-89ade530d0f6");
    let exercise_task_c2p1e1_1 = Uuid::new_v5(&course_id, b"a6508b8a-f58e-43ac-9f02-785575e716f5");
    let spec_c2p1e1t1_1 = Uuid::new_v5(&course_id, b"fe464d17-2365-4e65-8b33-e0ebb5a67836");
    let spec_c2p1e1t1_2 = Uuid::new_v5(&course_id, b"6633ffc7-c76e-4049-840e-90eefa6b49e8");
    let spec_c2p1e1t1_3 = Uuid::new_v5(&course_id, b"d77fb97d-322c-4c5f-a405-8978a8cfb0a9");
    create_page(
        conn,
        course.id,
        "/chapter-2/intro",
        "In the second chapter...",
        admin,
        chapter_2.id,
        &[example_exercise(
            exercise_c2p1_1,
            exercise_task_c2p1e1_1,
            Uuid::new_v5(&course_id, b"6ba193d7-6af4-4e39-9334-8aec6e35ea07"),
            Uuid::new_v5(&course_id, b"3270cf8b-4fec-4d93-b794-1468508a8909"),
            Uuid::new_v5(&course_id, b"e869c471-b1b7-42a0-af05-dffd1d86a7bb"),
            spec_c2p1e1t1_1,
            spec_c2p1e1t1_2,
            spec_c2p1e1t1_3,
        )],
    )
    .await?;

    // submissions
    let submission_admin_c1p1e1t1_1 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"8c447aeb-1791-4236-8471-204d8bc27507"),
            exercise_id: exercise_c1p1_1,
            course_id: course.id,
            exercise_task_id: exercise_task_c1p1e1_1,
            user_id: admin,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c1p1e1t1_1.to_string()),
        },
    )
    .await?;
    let submission_admin_c1p1e1t1_2 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"a719fe25-5721-412d-adea-4696ccb3d883"),
            exercise_id: exercise_c1p1_1,
            course_id: course.id,
            exercise_task_id: exercise_task_c1p1e1_1,
            user_id: admin,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c1p1e1t1_2.to_string()),
        },
    )
    .await?;
    let submission_admin_c1p1e1t1_3 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"bbc16d4b-1f91-4bd0-a47f-047665a32196"),
            exercise_id: exercise_c1p1_1,
            course_id: course.id,
            exercise_task_id: exercise_task_c1p1e1_1,
            user_id: admin,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c1p1e1t1_3.to_string()),
        },
    )
    .await?;
    let _submission_admin_c1p1e1t1_4 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"c60bf5e5-9b67-4f62-9df7-16d268c1b5f5"),
            exercise_id: exercise_c1p1_1,
            course_id: course.id,
            exercise_task_id: exercise_task_c1p1e1_1,
            user_id: admin,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c1p1e1t1_1.to_string()),
        },
    )
    .await?;
    let submission_admin_c1p2e1t1 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"e0ec1386-72aa-4eed-8b91-72bba420c23b"),
            exercise_id: exercise_c1p2_1,
            course_id: course.id,
            exercise_task_id: exercise_task_c1p2e1_1,
            user_id: admin,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c1p2e1t1_1.to_string()),
        },
    )
    .await?;
    let submission_admin_c1p2e2t1 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"4c6b8f4f-40c9-4970-947d-077e25c67e24"),
            exercise_id: exercise_c1p2_2,
            course_id: course.id,
            exercise_task_id: exercise_task_c1p2e2_1,
            user_id: admin,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c1p2e2t1_1.to_string()),
        },
    )
    .await?;
    let submission_admin_c2p1e1t1 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"02c9e1ad-6e4c-4473-a3e9-dbfab018a055"),
            exercise_id: exercise_c2p1_1,
            course_id: course.id,
            exercise_task_id: exercise_task_c2p1e1_1,
            user_id: admin,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c2p1e1t1_1.to_string()),
        },
    )
    .await?;
    let submission_teacher_c1p1e1t1 = submissions::insert_with_id(
        conn,
        &submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, b"75df4600-d337-4083-99d1-e8e3b6bf6192"),
            exercise_id: exercise_c1p1_1,
            course_id: course.id,
            exercise_task_id: exercise_task_c1p1e1_1,
            user_id: teacher,
            course_instance_id: course_instance.id,
            data_json: Value::String(spec_c1p1e1t1_1.to_string()),
        },
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

    // feedback
    let new_feedback = NewFeedback {
        feedback_given: "this part was unclear to me".to_string(),
        related_blocks: vec![FeedbackBlock {
            id: block_id_4,
            text: Some(
                "blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas"
                    .to_string(),
            ),
        }],
    };
    let feedback = feedback::insert(conn, Some(student), course.id, new_feedback).await?;
    feedback::mark_as_read(conn, feedback, true).await?;
    let new_feedback = NewFeedback {
        feedback_given: "I dont think we need these paragraphs".to_string(),
        related_blocks: vec![
            FeedbackBlock {
                id: block_id_1,
                text: Some("verything is a big topic.".to_string()),
            },
            FeedbackBlock {
                id: block_id_2,
                text: Some("So big, that we need many paragraphs.".to_string()),
            },
            FeedbackBlock {
                id: block_id_3,
                text: Some("Like th".to_string()),
            },
        ],
    };
    feedback::insert(conn, Some(student), course.id, new_feedback).await?;
    feedback::insert(
        conn,
        None,
        course.id,
        NewFeedback {
            feedback_given: "Anonymous feedback".to_string(),
            related_blocks: vec![FeedbackBlock {
                id: block_id_1,
                text: None,
            }],
        },
    )
    .await?;
    feedback::insert(
        conn,
        None,
        course.id,
        NewFeedback {
            feedback_given: "Anonymous unrelated feedback".to_string(),
            related_blocks: vec![],
        },
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

async fn seed_cs_course_material(conn: &mut PgConnection, org: Uuid, admin: Uuid) -> Result<Uuid> {
    // Create new course
    let new_course = NewCourse {
        name: "Introduction to Course Material".to_string(),
        organization_id: org,
        slug: "introduction-to-course-material".to_string(),
        language_code: "en-US".to_string(),
    };
    let (course, front_page, _default_instance) = courses::insert_course(
        conn,
        Uuid::parse_str("d6b52ddc-6c34-4a59-9a59-7e8594441007")?,
        new_course,
        admin,
    )
    .await?;

    pages::update_page(
        conn,
        front_page.id,
        PageUpdate {
            title: "Introduction to Course Material".to_string(),
            url_path: "/".to_string(),
            chapter_id: None,
            content: serde_json::to_value(&[
                GutenbergBlock::landing_page_hero_section("Welcome to Introduction to Course Material", "In this course you'll learn the basics of UI/UX design. At the end of course you should be able to create your own design system.")
                .with_id(Uuid::parse_str("6ad81525-0010-451f-85e5-4832e3e364a8")?),
            GutenbergBlock::course_objective_section()
                .with_id(Uuid::parse_str("2eec7ad7-a95f-406f-acfe-f3a332b86e26")?),
            GutenbergBlock::empty_block_from_name("moocfi/course-chapter-grid".to_string())
                .with_id(Uuid::parse_str("bb51d61b-fd19-44a0-8417-7ffc6058b247")?),
            GutenbergBlock::empty_block_from_name("moocfi/course-progress".to_string())
                .with_id(Uuid::parse_str("1d7c28ca-86ab-4318-8b10-3e5b7cd6e465")?),
            ])
            .unwrap(),
        },
        admin,
        true,
    )
    .await?;
    // FAQ, we should add card/accordion block to visualize here.
    let (_page, _history) = pages::insert(conn, course.id, "/faq", "FAQ", 1, admin).await?;

    // Chapter-1
    let new_chapter = NewChapter {
        chapter_number: 1,
        course_id: course.id,
        front_front_page_id: None,
        name: "User Interface".to_string(),
    };
    let (chapter_1, front_page_ch_1) = chapters::insert_chapter(conn, new_chapter, admin).await?;
    chapters::set_opens_at(conn, chapter_1.id, Utc::now()).await?;

    pages::update_page(
        conn,
        front_page_ch_1.id,
        PageUpdate {
            title: "User Interface".to_string(),
            url_path: "/chapter-1".to_string(),
            chapter_id: Some(chapter_1.id),
            content: serde_json::to_value(&[
                GutenbergBlock::hero_section("User Interface", "In the industrial design field of human–computer interaction, a user interface is the space where interactions between humans and machines occur.")
                .with_id(Uuid::parse_str("848ac898-81c0-4ebc-881f-6f84e9eaf472")?),
            GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string())
                .with_id(Uuid::parse_str("c8b36f58-5366-4d6b-b4ec-9fc0bd65950e")?),
            GutenbergBlock::empty_block_from_name("moocfi/chapter-progress".to_string())
                .with_id(Uuid::parse_str("cdb9e4b9-ba68-4933-b037-4648e3df7a6c")?),
            GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string())
                .with_id(Uuid::parse_str("457431b0-55db-46ac-90ae-03965f48b27e")?),
            ])
            .unwrap(),
        },
        admin,
        true,
    )
    .await?;

    // /chapter-1/design
    create_page(conn, course.id, "/chapter-1/design", "Design",  admin, chapter_1.id,
        &[
            GutenbergBlock::hero_section("Design", "A design is a plan or specification for the construction of an object or system or for the implementation of an activity or process, or the result of that plan or specification in the form of a prototype, product or process.")
                .with_id(Uuid::parse_str("98729704-9dd8-4309-aa08-402f9b2a6071")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur bibendum felis nisi, vitae commodo mi venenatis in. Mauris hendrerit lacinia augue ut hendrerit. Vestibulum non tellus mattis, convallis magna vel, semper mauris. Maecenas porta, arcu eget porttitor sagittis, nulla magna auctor dolor, sed tempus sem lacus eu tortor. Ut id diam quam. Etiam quis sagittis justo. Quisque sagittis dolor vitae felis facilisis, ut suscipit ipsum malesuada. Nulla tempor ultricies erat ut venenatis. Ut pulvinar lectus non mollis efficitur.",
                  "dropCap": false
                }),
            )
                .with_id(Uuid::parse_str("9ebddb78-23f6-4440-8d8f-5e4b33abb16f")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!( {
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                }),
            )
                .with_id(Uuid::parse_str("029ae4b5-08b0-49f7-8baf-d916b5f879a2")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                }),
            )
            .with_id(Uuid::parse_str("3693e92b-9cf0-485a-b026-2851de58e9cf")?),
        ]).await?;

    // /chapter-1/human-machine-interface
    create_page(
        conn,
        course.id,
        "/chapter-1/human-machine-interface",
        "Human-machine interface",
        admin,
        chapter_1.id,
        &[
            GutenbergBlock::hero_section("Human-machine interface", "In the industrial design field of human–computer interaction, a user interface is the space where interactions between humans and machines occur.")
                .with_id(Uuid::parse_str("ae22ae64-c0e5-42e1-895a-4a49411a72e8")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Sed venenatis, magna in ornare suscipit, orci ipsum consequat nulla, ut pulvinar libero metus et metus. Maecenas nec bibendum est. Donec quis ante elit. Nam in eros vitae urna aliquet vestibulum. Donec posuere laoreet facilisis. Aliquam auctor a tellus a tempus. Sed molestie leo eget commodo pellentesque. Curabitur lacinia odio nisl, eu sodales nunc placerat sit amet. Vivamus venenatis, risus vitae lobortis eleifend, odio nisi faucibus tortor, sed aliquet leo arcu et tellus. Donec ultrices consectetur nunc, non rhoncus sapien malesuada et. Nulla tempus ipsum vitae justo scelerisque, sed pretium neque fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur accumsan et ex pellentesque dignissim. Integer viverra libero quis tortor dignissim elementum.",
                  "dropCap": false
                }),
            )
                .with_id(Uuid::parse_str("b05a62ad-e5f7-432c-8c88-2976d971e7e1")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!( {
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices banana justo tellus non arcu. Cras euismod, cat lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                }),
            )
                .with_id(Uuid::parse_str("db20e302-d4e2-4f56-a0b9-e48a4fbd5fa8")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                }),
            )
            .with_id(Uuid::parse_str("c96f56d5-ea35-4aae-918a-72a36847a49c")?),
        ]
    )
    .await?;

    // Chapter-2
    let new_chapter_2 = NewChapter {
        chapter_number: 2,
        course_id: course.id,
        front_front_page_id: None,
        name: "User Experience".to_string(),
    };
    let (chapter_2, front_page_ch_2) = chapters::insert_chapter(conn, new_chapter_2, admin).await?;
    chapters::set_opens_at(conn, chapter_2.id, Utc::now()).await?;

    pages::update_page(
        conn,
        front_page_ch_2.id,
        PageUpdate {
            url_path: "/chapter-2".to_string(),
            title: "User Experience".to_string(),
            chapter_id: Some(chapter_2.id),
            content: serde_json::to_value(&[
                GutenbergBlock::hero_section("User Experience", "The user experience is how a user interacts with and experiences a product, system or service. It includes a person's perceptions of utility, ease of use, and efficiency.")
                    .with_id(Uuid::parse_str("c5c623f9-c7ca-4f8e-b04b-e91cecef217a")?),
                GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string())
                    .with_id(Uuid::parse_str("37bbc4e9-2e96-45ea-a6f8-bbc7dc7f6be3")?),
                GutenbergBlock::empty_block_from_name("moocfi/chapter-progress".to_string())
                    .with_id(Uuid::parse_str("2e91c140-fd17-486b-8dc1-0a9589a18e3a")?),
                GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string())
                    .with_id(Uuid::parse_str("1bf7e311-75e8-48ec-bd55-e8f1185d76d0")?),
            ])
            .unwrap(),
        },
        admin,
        true,
    )
    .await?;
    // /chapter-2/user-research
    create_page(
        conn,
        course.id,
        "/chapter-2/user-research",
        "User research",
        admin,
        chapter_2.id,
        &[
            GutenbergBlock::hero_section("User research", "User research focuses on understanding user behaviors, needs, and motivations through observation techniques, task analysis, and other feedback methodologies.")
                .with_id(Uuid::parse_str("a43f5460-b588-44ac-84a3-5fdcabd5d3f7")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Sed venenatis, magna in ornare suscipit, orci ipsum consequat nulla, ut pulvinar libero metus et metus. Maecenas nec bibendum est. Donec quis ante elit. Nam in eros vitae urna aliquet vestibulum. Donec posuere laoreet facilisis. Aliquam auctor a tellus a tempus. Sed molestie leo eget commodo pellentesque. Curabitur lacinia odio nisl, eu sodales nunc placerat sit amet. Vivamus venenatis, risus vitae lobortis eleifend, odio nisi faucibus tortor, sed aliquet leo arcu et tellus. Donec ultrices consectetur nunc, non rhoncus sapien malesuada et. Nulla tempus ipsum vitae justo scelerisque, sed pretium neque fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur accumsan et ex pellentesque dignissim. Integer viverra libero quis tortor dignissim elementum.",
                  "dropCap": false
                }),
            )
                .with_id(Uuid::parse_str("816310e3-bbd7-44ae-87cb-3f40633a4b08")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!( {
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                }),
            )
                .with_id(Uuid::parse_str("37aa6421-768e-49b9-b447-5f457e5192bc")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                serde_json::json!({
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut banana cat enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                }),
            )
            .with_id(Uuid::parse_str("cf11a0fb-f56e-4e0d-bc12-51d920dbc278")?),
        ]
    )
    .await?;

    Ok(course.id)
}

#[allow(clippy::too_many_arguments)]
async fn create_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    url_path: &str,
    title: &str,
    author: Uuid,
    chapter_id: Uuid,
    content: &[GutenbergBlock],
) -> Result<Uuid> {
    let new_page = NewPage {
        content: Value::Array(vec![]),
        url_path: url_path.to_string(),
        title: format!("{} WIP", title),
        course_id,
        chapter_id: Some(chapter_id),
        front_page_of_chapter_id: None,
    };
    let page = pages::insert_page(conn, new_page, author).await?;
    let page = pages::update_page(
        conn,
        page.id,
        PageUpdate {
            chapter_id: Some(chapter_id),
            url_path: url_path.to_string(),
            title: title.to_string(),
            content: serde_json::to_value(content).unwrap(),
        },
        author,
        true,
    )
    .await?;
    Ok(page.id)
}

fn paragraph(content: &str, block: Uuid) -> GutenbergBlock {
    GutenbergBlock {
        name: "core/paragraph".to_string(),
        is_valid: true,
        client_id: block.to_string(),
        attributes: serde_json::json!({
            "content": content,
            "dropCap": false,
        }),
        inner_blocks: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
fn example_exercise(
    ex: Uuid,
    task: Uuid,
    block_1: Uuid,
    block_2: Uuid,
    block_3: Uuid,
    spec_1: Uuid,
    spec_2: Uuid,
    spec_3: Uuid,
) -> GutenbergBlock {
    GutenbergBlock {
        name: "moocfi/exercise".to_string(),
        is_valid: true,
        client_id: block_1.to_string(),
        attributes: serde_json::json!({
            "id": ex,
            "name": "Best exercise",
            "dropCap": false,
        }),
        inner_blocks: vec![GutenbergBlock {
            name: "moocfi/exercise-task".to_string(),
            is_valid: true,
            client_id: block_2.to_string(),
            attributes: serde_json::json!({
                "id": task,
                "exercise_type": "example-exercise",
                "private_spec": serde_json::json!([
                    {
                        "name": "a",
                        "correct": false,
                        "id": spec_1,
                    },
                    {
                        "name": "b",
                        "correct": true,
                        "id": spec_2,
                    },
                    {
                        "name": "c",
                        "correct": true,
                        "id": spec_3,
                    },
                ]).to_string(),
            }),
            inner_blocks: vec![paragraph("Answer this question.", block_3)],
        }],
    }
}
