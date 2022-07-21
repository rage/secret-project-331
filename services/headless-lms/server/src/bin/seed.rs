#![allow(clippy::too_many_arguments)]

use std::{env, process::Command};

use anyhow::Result;
use chrono::{DateTime, Duration, TimeZone, Utc};
use headless_lms_actix::setup_tracing;
use headless_lms_models::{
    chapters,
    chapters::NewChapter,
    course_instance_enrollments,
    course_instance_enrollments::NewCourseInstanceEnrollment,
    course_instances::{self, NewCourseInstance},
    course_modules::{self, AutomaticCompletionCriteria, AutomaticCompletionPolicy},
    courses,
    courses::NewCourse,
    exams,
    exams::NewExam,
    exercise_services, exercise_slide_submissions,
    exercise_task_gradings::{self, ExerciseTaskGradingResult, UserPointsUpdateStrategy},
    exercise_task_submissions, exercises,
    exercises::GradingProgress,
    feedback,
    feedback::{FeedbackBlock, NewFeedback},
    glossary, open_university_registration_links, organizations,
    page_history::HistoryChangeReason,
    pages,
    pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, CmsPageUpdate, NewPage},
    peer_review_questions::{self, NewPeerReviewQuestion, PeerReviewQuestionType},
    peer_reviews, playground_examples,
    playground_examples::PlaygroundExampleData,
    proposed_block_edits::NewProposedBlockEdit,
    proposed_page_edits,
    proposed_page_edits::NewProposedPageEdits,
    roles::UserRole,
    roles::{self, RoleDomain},
    url_redirections, user_exercise_slide_states, user_exercise_states, users,
};
use headless_lms_utils::{attributes, document_schema_processor::GutenbergBlock};
use serde_json::Value;
use sqlx::{migrate::MigrateDatabase, Connection, PgConnection, Postgres};
use tracing::info;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,sqlx=warn,headless_lms_models=warn");

    dotenv::dotenv().ok();
    setup_tracing()?;

    let clean = env::args().any(|a| a == "clean");
    let db_url = env::var("DATABASE_URL")?;

    if clean {
        info!("cleaning");
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
        info!("running migrations");
        sqlx::migrate!("../migrations").run(&mut conn).await?;
    }

    // exercise services
    info!("inserting exercise services");
    let _example_exercise_exercise_service = exercise_services::insert_exercise_service(
        &mut conn,
        &exercise_services::ExerciseServiceNewOrUpdate {
            name: "Example Exercise".to_string(),
            slug: "example-exercise".to_string(),
            public_url: "http://project-331.local/example-exercise/api/service-info".to_string(),
            internal_url: Some("http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info".to_string()),
            max_reprocessing_submissions_at_once: 5,
        }
    )
    .await?;

    exercise_services::insert_exercise_service(
        &mut conn,
        &exercise_services::ExerciseServiceNewOrUpdate {
            name: "Quizzes".to_string(),
            slug: "quizzes".to_string(),
            public_url: "http://project-331.local/quizzes/api/service-info".to_string(),
            internal_url: Some(
                "http://quizzes.default.svc.cluster.local:3004/quizzes/api/service-info"
                    .to_string(),
            ),
            max_reprocessing_submissions_at_once: 5,
        },
    )
    .await?;

    // users
    info!("inserting users");
    let admin = users::insert_with_id(
        &mut conn,
        "admin@example.com",
        Some("Admin"),
        Some("Example"),
        Uuid::parse_str("02c79854-da22-4cfc-95c4-13038af25d2e")?,
    )
    .await?;
    let teacher = users::insert_with_id(
        &mut conn,
        "teacher@example.com",
        Some("Teacher"),
        Some("Example"),
        Uuid::parse_str("90643204-7656-4570-bdd9-aad5d297f9ce")?,
    )
    .await?;
    let language_teacher = users::insert_with_id(
        &mut conn,
        "language.teacher@example.com",
        Some("Language"),
        Some("Example"),
        Uuid::parse_str("0fd8bd2d-cb4e-4035-b7db-89e798fe4df0")?,
    )
    .await?;
    let assistant = users::insert_with_id(
        &mut conn,
        "assistant@example.com",
        Some("Assistant"),
        Some("Example"),
        Uuid::parse_str("24342539-f1ba-453e-ae13-14aa418db921")?,
    )
    .await?;
    let course_or_exam_creator = users::insert_with_id(
        &mut conn,
        "creator@example.com",
        Some("Creator"),
        Some("Example"),
        Uuid::parse_str("c9f9f9f9-f9f9-f9f9-f9f9-f9f9f9f9f9f9")?,
    )
    .await?;

    let student = users::insert_with_id(
        &mut conn,
        "user@example.com",
        Some("User"),
        Some("Example"),
        Uuid::parse_str("849b8d32-d5f8-4994-9d21-5aa6259585b1")?,
    )
    .await?;

    let users = vec![
        users::insert_with_id(
            &mut conn,
            "user_1@example.com",
            Some("User1"),
            None,
            Uuid::parse_str("00e249d8-345f-4eff-aedb-7bdc4c44c1d5")?,
        )
        .await?,
        users::insert_with_id(
            &mut conn,
            "user_2@example.com",
            Some("User2"),
            None,
            Uuid::parse_str("8d7d6c8c-4c31-48ae-8e20-c68fa95c25cc")?,
        )
        .await?,
        users::insert_with_id(
            &mut conn,
            "user_3@example.com",
            Some("User3"),
            None,
            Uuid::parse_str("fbeb9286-3dd8-4896-a6b8-3faffa3fabd6")?,
        )
        .await?,
        users::insert_with_id(
            &mut conn,
            "user_4@example.com",
            Some("User4"),
            None,
            Uuid::parse_str("3524d694-7fa8-4e73-aa1a-de9a20fd514b")?,
        )
        .await?,
    ];

    // uh-cs
    info!("uh-cs");
    let uh_cs = organizations::insert(
        &mut conn,
        "University of Helsinki, Department of Computer Science",
        "uh-cs",
        "Organization for Computer Science students and the rest of the world who wish to learn the basics in Computer Science, programming and software development.",
        Uuid::parse_str("8bb12295-53ac-4099-9644-ac0ff5e34d92")?,
    )
    .await?;

    info!("inserting uh-cs courses");
    let cs_intro = seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5")?,
        "Introduction to everything",
        "introduction-to-everything",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("d18b3780-563d-4326-b311-8d0e132901cd")?,
        "Introduction to feedback",
        "introduction-to-feedback",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("0ab2c4c5-3aad-4daa-a8fe-c26e956fde35")?,
        "Introduction to history",
        "introduction-to-history",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("cae7da38-9486-47da-9106-bff9b6a280f2")?,
        "Introduction to edit proposals",
        "introduction-to-edit-proposals",
        admin,
        student,
        &users,
    )
    .await?;
    let introduction_to_localizing = seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("639f4d25-9376-49b5-bcca-7cba18c38565")?,
        "Introduction to localizing",
        "introduction-to-localizing",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("b4cb334c-11d6-4e93-8f3d-849c4abfcd67")?,
        "Point view for teachers",
        "point-view-for-teachers",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4")?,
        "Advanced course instance management",
        "advanced-course-instance-management",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("0cf67777-0edb-480c-bdb6-13f90c136fc3")?,
        "Advanced exercise states",
        "advanced-exercise-states",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("c218ca00-dbde-4b0c-ab98-4f075c49425a")?,
        "Glossary course",
        "glossary-course",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("a2002fc3-2c87-4aae-a5e5-9d14617aad2b")?,
        "Permission management",
        "permission-management",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("f9579c00-d0bb-402b-affd-7db330dcb11f")?,
        "Redirections",
        "redirections",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("9da60c66-9517-46e4-b351-07d0f7aa6cd4")?,
        "Limited tries",
        "limited-tries",
        admin,
        student,
        &users,
    )
    .await?;
    seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("86cbc198-601c-42f4-8e0f-3e6cce49bbfc")?,
        "Course Structure",
        "course-structure",
        admin,
        student,
        &users,
    )
    .await?;
    let automatic_completions_id = seed_sample_course(
        &mut conn,
        uh_cs,
        Uuid::parse_str("b39b64f3-7718-4556-ac2b-333f3ed4096f")?,
        "Automatic Completions",
        "automatic-completions",
        admin,
        student,
        &users,
    )
    .await?;
    let automatic_default_module =
        course_modules::get_default_by_course_id(&mut conn, automatic_completions_id).await?;
    let automatic_default_module = course_modules::update_automatic_completion_status(
        &mut conn,
        automatic_default_module.id,
        &AutomaticCompletionPolicy::AutomaticCompletion(AutomaticCompletionCriteria {
            number_of_exercises_attempted_treshold: Some(1),
            number_of_points_treshold: Some(1),
        }),
    )
    .await?;
    course_modules::update_uh_course_code(
        &mut conn,
        automatic_default_module.id,
        Some("EXAMPLE123".to_string()),
    )
    .await?;
    open_university_registration_links::upsert(&mut conn, "EXAMPLE123", "https://www.example.com")
        .await?;

    roles::insert(
        &mut conn,
        language_teacher,
        UserRole::Teacher,
        RoleDomain::Course(introduction_to_localizing),
    )
    .await?;
    roles::insert(
        &mut conn,
        course_or_exam_creator,
        UserRole::CourseOrExamCreator,
        RoleDomain::Organization(uh_cs),
    )
    .await?;

    info!("inserting sample exams");
    create_exam(
        &mut conn,
        "Ongoing ends soon".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(1)),
        120,
        uh_cs,
        cs_intro,
        Uuid::parse_str("7d6ed843-2a94-445b-8ced-ab3c67290ad0")?,
        teacher,
    )
    .await?;
    create_exam(
        &mut conn,
        "Ongoing short timer".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(120)),
        1,
        uh_cs,
        cs_intro,
        Uuid::parse_str("6959e7af-6b78-4d37-b381-eef5b7aaad6c")?,
        teacher,
    )
    .await?;
    create_exam(
        &mut conn,
        "Ongoing plenty of time".to_string(),
        Some(Utc::now()),
        Some(Utc::now() + Duration::minutes(120)),
        730,
        uh_cs,
        cs_intro,
        Uuid::parse_str("8e202d37-3a26-4181-b9e4-0560b90c0ccb")?,
        teacher,
    )
    .await?;
    create_exam(
        &mut conn,
        "Starting soon".to_string(),
        Some(Utc::now() + Duration::minutes(5)),
        Some(Utc::now() + Duration::days(30)),
        1,
        uh_cs,
        cs_intro,
        Uuid::parse_str("65f5c3f3-b5fd-478d-8858-a45cdcb16b86")?,
        teacher,
    )
    .await?;
    create_exam(
        &mut conn,
        "Over".to_string(),
        Some(Utc::now() - Duration::days(7)),
        Some(Utc::now() - Duration::minutes(30)),
        1,
        uh_cs,
        cs_intro,
        Uuid::parse_str("5c4fca1f-f0d6-471f-a0fd-eac552f5fb84")?,
        teacher,
    )
    .await?;

    info!("cs");
    let _cs_design = seed_cs_course_material(&mut conn, uh_cs, admin).await?;
    let new_course = NewCourse {
        name: "Introduction to Computer Science".to_string(),
        slug: "introduction-to-computer-science".to_string(),
        organization_id: uh_cs,
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "An example course.".to_string(),
        is_draft: false,
        is_test_mode: false,
    };
    let (cs_course, _cs_front_page, _cs_default_course_instance, _cs_default_module) =
        courses::insert_course(
            &mut conn,
            Uuid::parse_str("06a7ccbd-8958-4834-918f-ad7b24e583fd")?,
            Uuid::parse_str("48399008-6523-43c5-8fd6-59ecc731a426")?,
            new_course,
            admin,
        )
        .await?;
    let _cs_course_instance = course_instances::insert(
        &mut conn,
        NewCourseInstance {
            id: Uuid::parse_str("49c618d3-926d-4287-9159-b3af1f86082d")?,
            course_id: cs_course.id,
            name: Some("non-default instance"),
            description: Some("this is another non-default instance"),
            support_email: Some("contact@example.com"),
            teacher_in_charge_name: "admin",
            teacher_in_charge_email: "admin@example.com",
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    // uh-mathstat
    info!("uh-mathstat");
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
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "Introduces you to the wonderful world of statistics!".to_string(),
        is_draft: false,
        is_test_mode: false,
    };
    let (
        statistics_course,
        _statistics_front_page,
        _statistics_default_course_instance,
        _statistics_default_module,
    ) = courses::insert_course(
        &mut conn,
        Uuid::parse_str("f307d05f-be34-4148-bb0c-21d6f7a35cdb")?,
        Uuid::parse_str("8e4aeba5-1958-49bc-9b40-c9f0f0680911")?,
        new_course,
        admin,
    )
    .await?;
    let _statistics_course_instance = course_instances::insert(
        &mut conn,
        NewCourseInstance {
            id: Uuid::parse_str("c4a99a18-fd43-491a-9500-4673cb900be0")?,
            course_id: statistics_course.id,
            name: Some("non-default instance"),
            description: Some("this appears to be a non-default instance"),
            support_email: Some("contact@example.com"),
            teacher_in_charge_name: "admin",
            teacher_in_charge_email: "admin@example.com",
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    let draft_course = NewCourse {
        name: "Introduction to Drafts".to_string(),
        slug: "introduction-to-drafts".to_string(),
        organization_id: uh_mathstat,
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "Just a draft.".to_string(),
        is_draft: true,
        is_test_mode: false,
    };
    courses::insert_course(
        &mut conn,
        Uuid::parse_str("963a9caf-1e2d-4560-8c88-9c6d20794da3")?,
        Uuid::parse_str("5cb4b4d6-4599-4f81-ab7e-79b415f8f584")?,
        draft_course,
        admin,
    )
    .await?;

    // roles
    info!("roles");
    roles::insert(&mut conn, admin, UserRole::Admin, RoleDomain::Global).await?;
    roles::insert(
        &mut conn,
        teacher,
        UserRole::Teacher,
        RoleDomain::Organization(uh_cs),
    )
    .await?;
    roles::insert(
        &mut conn,
        assistant,
        UserRole::Assistant,
        RoleDomain::Organization(uh_cs),
    )
    .await?;
    roles::insert(
        &mut conn,
        assistant,
        UserRole::Assistant,
        RoleDomain::Course(cs_intro),
    )
    .await?;

    info!("playground examples");
    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Example exercise".to_string(),
            url: "http://project-331.local/example-exercise/iframe".to_string(),
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
            name: "Quizzes, example, checkbox".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
                "id": "57f03d8e-e768-485c-b0c3-a3e485a3e18a",
                "title": "Internet safety quizz",
                "body": "Answer the following guestions about staying safe on the internet.",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "items": [
                    {
                        "id": "5f09bd92-6e33-415b-b356-227563a02816",
                        "body": "",
                        "type": "checkbox",
                        "multi": false,
                        "order": 1,
                        "title": "The s in https stands for secure.",
                        "quizId": "57f03d8e-e768-485c-b0c3-a3e485a3e18a",
                        "options": [],
                        "maxValue": null,
                        "maxWords": null,
                        "minValue": null,
                        "minWords": null,
                        "direction": "row"
                    },
                    {
                        "id": "818fc326-ed38-4fe5-95d3-0f9d15032d01",
                        "body": "",
                        "type": "checkbox",
                        "multi": false,
                        "order": 2,
                        "title": "I use a strong, unique password that can't easily be guessed by those who knows me.",
                        "quizId": "57f03d8e-e768-485c-b0c3-a3e485a3e18a",
                        "options": [],
                        "maxValue": null,
                        "maxWords": null,
                        "minValue": null,
                        "minWords": null,
                        "direction": "row"
                    },
                ],
                "tries": 1,
                "courseId": "51ee97a7-684f-4cba-8a01-8c558803c4f7",
                "triesLimited": true,
            }),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, row".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
              {
                "id": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
                "body": "Something about CSS and color codes",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about CSS and color codes",
                "tries": 1,
                "triesLimited": false,
                "items": [
                    {
                        "id": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                        "body": "Which of the color codes represent the color **red**?",
                        "direction": "row",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": false,
                        "order": 1,
                        "quizId": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                        "title": "Hexadecimal color codes",
                        "type": "multiple-choice",
                        "options": [
                            {
                                "id": "8d17a216-9655-4558-adfb-cf66fb3e08ba",
                                "body": "#00ff00",
                                "order": 1,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "11e0f3ac-fe21-4524-93e6-27efd4a92595",
                                "body": "#0000ff",
                                "order": 2,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "e0033168-9f92-4d71-9c23-7698de9ea3b0",
                                "body": "#663300",
                                "order": 3,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "2931180f-827f-468c-a616-a8df6e94f717",
                                "body": "#ff0000",
                                "order": 4,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "9f5a09d7-c03f-44dd-85db-38065600c2c3",
                                "body": "#ffffff",
                                "order": 5,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                        ]
                    }
                ]
              }
            ),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, column".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
              {
                "id": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
                "body": "Something about CSS and color codes",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about CSS and color codes",
                "tries": 1,
                "triesLimited": false,
                "items": [
                    {
                        "id": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                        "body": "Which of the color codes represent the color **red**?",
                        "direction": "column",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": false,
                        "order": 1,
                        "quizId": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                        "title": "Hexadecimal color codes",
                        "type": "multiple-choice",
                        "options": [
                            {
                                "id": "8d17a216-9655-4558-adfb-cf66fb3e08ba",
                                "body": "#00ff00",
                                "order": 1,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "11e0f3ac-fe21-4524-93e6-27efd4a92595",
                                "body": "#0000ff",
                                "order": 2,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "e0033168-9f92-4d71-9c23-7698de9ea3b0",
                                "body": "#663300",
                                "order": 3,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "2931180f-827f-468c-a616-a8df6e94f717",
                                "body": "#ff0000",
                                "order": 4,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "9f5a09d7-c03f-44dd-85db-38065600c2c3",
                                "body": "#ffffff",
                                "order": 5,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                        ]
                    }
                ]
              }
            ),
        },
    )
    .await?;
    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, long text".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
            {
              "id": "fd0221d1-a205-42d0-b187-3ead6a1a0e6e",
              "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
              "body": "Short questions, long answers",
              "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
              "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
              "part": 1,
              "section": 1,
              "title": "General questions",
              "tries": 1,
              "triesLimited": false,
              "items": [
                  {
                      "id": "88ff824f-8aa2-4629-b727-86f98092ab22",
                      "body": "select shortest answer",
                      "direction": "row",
                      "formatRegex": null,
                      "maxLabel": null,
                      "maxValue": null,
                      "maxWords": null,
                      "minLabel": null,
                      "minValue": null,
                      "minWords": null,
                      "multi": false,
                      "order": 1,
                      "quizId": "6160b703-0c27-448b-84aa-1f0d23a037a7",
                      "title": "Choose the short answer",
                      "type": "multiple-choice",
                      "options": [
                          {
                              "id": "d174aecf-bb77-467f-b1e7-92a0e54af29f",
                              "body": "short answer",
                              "order": 1,
                              "title": null,
                              "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                          },
                          {
                              "id": "45a3c513-5dd9-4239-96f1-3dd1f53379cc",
                              "body": "very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long answer",
                              "order": 2,
                              "title": null,
                              "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                          },
                          {
                              "id": "2176ea44-46c6-48d6-a2be-1f8188b06545",
                              "body": "very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long answer",
                              "order": 3,
                              "title": null,
                              "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                          },
                          ]
                      }
                  ]
                }
              ),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, multi".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
              {
                "id": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
                "body": "Something about CSS and color codes",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about CSS and color codes",
                "tries": 1,
                "triesLimited": false,
                "items": [
                    {
                        "id": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                        "body": "Which of the color codes represent the color **red**?",
                        "direction": "row",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": true,
                        "order": 1,
                        "quizId": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                        "title": "Hexadecimal color codes",
                        "type": "multiple-choice",
                        "options": [
                            {
                                "id": "8d17a216-9655-4558-adfb-cf66fb3e08ba",
                                "body": "#00ff00",
                                "order": 1,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "11e0f3ac-fe21-4524-93e6-27efd4a92595",
                                "body": "#0000ff",
                                "order": 2,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "e0033168-9f92-4d71-9c23-7698de9ea3b0",
                                "body": "#663300",
                                "order": 3,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "2931180f-827f-468c-a616-a8df6e94f717",
                                "body": "#ff0000",
                                "order": 4,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "9f5a09d7-c03f-44dd-85db-38065600c2c3",
                                "body": "#ffffff",
                                "order": 5,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                        ]
                    }
                ]
              }
            ),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, essay".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(              {
              "id": "47cbd36c-0c32-41f2-8a4a-b008de7d3494",
              "courseId": "fdf0fed9-7665-4712-9cca-652d5bfe5233",
              "body": "Of CSS and system design of the Noldor",
              "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
              "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
              "part": 1,
              "section": 1,
              "title": "Of CSS and system design of the Noldor",
              "tries": 1,
              "triesLimited": false,
              "items": [
                  {
                      "id": "371b59cb-735d-4202-b8cb-bed967945ffd",
                      "body": "Which colour did the Fëanorian lamps emit when Tuor met Gelmir and Arminas at the gate of Annon-in-Gelydh? Give your answer in colours colourname, hexadecimal colour code and in RGB colour code. Could this have deeper contextual meaning considering the events of the previous chapter? Explain in 500 words.",
                      "direction": "row",
                      "maxLabel": null,
                      "maxValue": null,
                      "maxWords": 600,
                      "minLabel": null,
                      "minValue": null,
                      "minWords": 500,
                      "multi": false,
                      "order": 1,
                      "quizId": "47cbd36c-0c32-41f2-8a4a-b008de7d3494",
                      "title": "Of the lamps of Fëanor",
                      "type": "essay",
                      "options": []
                  }
              ]
            })
        }).await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice dropdown".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
            "id": "1af3cc18-d8d8-4cc6-9bf9-be63d79e19a4",
            "courseId": "32b060d5-78e8-4b97-a933-7458319f30a2",
            "body": null,
            "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
            "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
            "part": 1,
            "section": 1,
            "title": "Questions about CSS and color codes",
            "tries": 1,
            "triesLimited": false,
            "items": [
                {
                    "id": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                    "body": "How many different CSS hexadecimal color codes there are?",
                    "direction": "row",
                    "formatRegex": null,
                    "maxLabel": null,
                    "maxValue": null,
                    "maxWords": null,
                    "minLabel": null,
                    "minValue": null,
                    "minWords": null,
                    "multi": false,
                    "order": 1,
                    "quizId": "1af3cc18-d8d8-4cc6-9bf9-be63d79e19a4",
                    "title": null,
                    "type": "multiple-choice-dropdown",
                    "options": [
                        {
                            "id": "d0514fbb-1081-4602-b564-22dd5374dd46",
                            "body": "at least two",
                            "order": 1,
                            "title": null,
                            "quizItemId": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                        },
                        {
                            "id": "a7a58b81-bd76-4b9a-9060-1516597cb9b7",
                            "body": "more than 2.546 * 10^56",
                            "order": 2,
                            "title": null,
                            "quizItemId": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                        },
                        {
                            "id": "255ff119-1705-4f79-baed-cf8f0c3ca214",
                            "body": "I don't believe in hexadecimal color codes",
                            "order": 3,
                            "title": null,
                            "quizItemId": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                        },
                    ]
                },
                {
                    "id": "da705796-f8e3-420c-a717-a3064e351eed",
                    "body": "What other ways there are to represent colors in CSS?",
                    "direction": "row",
                    "formatRegex": null,
                    "maxLabel": null,
                    "maxValue": null,
                    "maxWords": null,
                    "minLabel": null,
                    "minValue": null,
                    "minWords": null,
                    "multi": false,
                    "order": 1,
                    "quizId": "1af3cc18-d8d8-4cc6-9bf9-be63d79e19a4",
                    "title": null,
                    "type": "multiple-choice-dropdown",
                    "options": [
                        {
                            "id": "dd31dfda-2bf0-4f66-af45-de6ee8ded54a",
                            "body": "RGB -color system",
                            "order": 1,
                            "title": null,
                            "quizItemId": "da705796-f8e3-420c-a717-a3064e351eed",
                        },
                        {
                            "id": "af864a7e-46d5-46c4-b027-413cb4e5fa68",
                            "body": "Human readable text representation",
                            "order": 2,
                            "title": null,
                            "quizItemId": "da705796-f8e3-420c-a717-a3064e351eed",
                        },
                        {
                            "id": "66df5778-f80c-42b4-a544-4fb35d44a80f",
                            "body": "I'm colorblind, so I don't really care :/",
                            "order": 3,
                            "title": null,
                            "quizItemId": "da705796-f8e3-420c-a717-a3064e351eed",
                        },
                    ]
                }
            ]}),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,

        PlaygroundExampleData {
            name: "Quizzes example, open".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
                "id": "801b9275-5034-438d-922f-104af517468a",
                "title": "Open answer question",
                "body": "",
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "items": [
                    {
                        "id": "30cc054a-8efb-4242-9a0d-9acc6ae2ca57",
                        "body": "Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD).",
                        "type": "open",
                        "multi": false,
                        "order": 0,
                        "title": "Date formats",
                        "quizId": "801b9275-5034-438d-922f-104af517468a",
                        "options": [],
                        "maxValue": null,
                        "maxWords": null,
                        "minValue": null,
                        "minWords": null,
                        "direction": "row",
                        "formatRegex": "\\d{4}-\\d{2}-\\d{2}",
                    }
                ],
                "tries": 1,
                "section": 1,
                "courseId": "f6b6a606-e1f8-4ded-a458-01f541c06019",
                "triesLimited": true,
            }),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, scale".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
                "id": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                "title": "The regex quiz",
                "body": "Please answer to the following guestions based on your feelings about using regex. Use the scale 1 = completely disagree, 7 = completely agree",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "items": [
                  {
                    "id": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    "body": "",
                    "type": "scale",
                    "multi": false,
                    "order": 1,
                    "title": "Regex is generally readable.",
                    "quizId": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                    "options": [],
                    "maxValue": 4,
                    "maxWords": null,
                    "minValue": 1,
                    "minWords": null,
                    "direction": "row",
                    "formatRegex": null,
                  },
                  {
                    "id": "b3ce858c-a5ed-4cf7-a9ee-62ef91d1a75a",
                    "body": "",
                    "type": "scale",
                    "multi": false,
                    "order": 2,
                    "title": "Regex is what some people consider to be a 'write-only' language.",
                    "quizId": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                    "options": [],
                    "maxValue": 7,
                    "maxWords": null,
                    "minValue": 1,
                    "minWords": null,
                    "direction": "row",
                    "formatRegex": null,
                  },
                  {
                    "id": "eb7f6898-7ba5-4f89-8e24-a17f57381131",
                    "body": "",
                    "type": "scale",
                    "multi": false,
                    "order": 3,
                    "title": "Regex can be useful when parsing HTML.",
                    "quizId": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                    "options": [],
                    "maxValue": 15,
                    "maxWords": null,
                    "minValue": 1,
                    "minWords": null,
                    "direction": "row",
                    "formatRegex": null,
                  }
                ],
                "tries": 1,
                "section": 1,
                "courseId": "f5bed4ff-63ec-44cd-9056-86eb00df84ca",
                "triesLimited": true
              }),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice clickable".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
              "id": "3562f83c-4d5d-41a9-aceb-a8f98511dd5d",
              "title": "Of favorite colors",
              "body": null,
              "deadline": Utc.ymd(2121,9,1).and_hms(23,59,59).to_string(),
              "open": Utc.ymd(2021,9,1).and_hms(23,59,59).to_string(),
              "part": 1,
              "items": [
                {
                  "id": "d2422f0c-2378-4099-bde7-e1231ceac220",
                  "body": "",
                  "type": "clickable-multiple-choice",
                  "multi": true,
                  "order": 1,
                  "title": "Choose your favorite colors",
                  "quizId": "3562f83c-4d5d-41a9-aceb-a8f98511dd5d",
                  "options": [
                    {
                      "id": "f4ef5add-cfed-4819-b1a7-b1c7a72330ea",
                      "body": "AliceBlue",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "ee6535ca-fed6-4d22-9988-bed91e3decb4",
                      "body": "AntiqueWhite",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "404c62f0-44f2-492c-a6cf-522e5cff492b",
                      "body": "Aqua",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "74e09ced-233e-4db6-a67f-d4835a596956",
                      "body": "Cyan",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "797463cf-9592-46f8-9018-7d2b3d2c0882",
                      "body": "Cornsilk",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "f5e46e15-cb14-455f-8b72-472fed50d6f8",
                      "body": "LawnGreen",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "2bfea5dd-ad64-456a-8518-c6754bd40a90",
                      "body": "LightGoldenRodYellow",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "d045ec97-a89a-4964-9bea-a5baab69786f",
                      "body": "MediumSpringGreen",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "fc901148-7d65-4150-b077-5dc53947ee7a",
                      "body": "Sienna",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "73a8f612-7bd4-48ca-9dae-2baa1a55a1da",
                      "body": "WhiteSmoke",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                  ],
                  "maxValue": 4,
                  "maxWords": null,
                  "minValue": 1,
                  "minWords": null,
                  "direction": "row",
                  "formatRegex": null,
                },
              ],
              "tries": 1,
              "section": 1,
              "courseId": "f5bed4ff-63ec-44cd-9056-86eb00df84ca",
              "triesLimited": true
            }),
        },
    )
    .await?;

    let array = vec![vec![0; 6]; 6];
    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, matrix".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
            {
                "id": "91cf86bd-39f1-480f-a16c-5b0ad36dc787",
                "courseId": "2764d02f-bea3-47fe-9529-21c801bdf6f5",
                "body": "Something about matrices and numbers",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about matrices and numbers",
                "tries": 1,
                "triesLimited": true,
                "items": [
                    {
                        "id": "b17f3965-2223-48c9-9063-50f1ebafcf08",
                        "body": "Create a matrix that represents 4x4",
                        "direction": "row",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": false,
                        "order": 1,
                        "quizId": "91cf86bd-39f1-480f-a16c-5b0ad36dc787",
                        "title": "Matrices are interesting",
                        "type": "matrix",
                        "options": [],
                        "optionCells": array,
                        }
                        ]}),
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
    student: Uuid,
    users: &[Uuid],
) -> Result<Uuid> {
    info!("inserting sample course {}", course_name);
    let new_course = NewCourse {
        name: course_name.to_string(),
        organization_id: org,
        slug: course_slug.to_string(),
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "Sample course.".to_string(),
        is_draft: false,
        is_test_mode: false,
    };
    let (course, _front_page, default_instance, default_module) = courses::insert_course(
        conn,
        course_id,
        Uuid::new_v5(&course_id, b"7344f1c8-b7ce-4c7d-ade2-5f39997bd454"),
        new_course,
        admin,
    )
    .await?;
    course_instances::insert(
        conn,
        NewCourseInstance {
            id: Uuid::new_v5(&course_id, b"67f077b4-0562-47ae-a2b9-db2f08f168a9"),
            course_id: course.id,
            name: Some("non-default instance"),
            description: Some("this is a non-default instance"),
            support_email: Some("contact@example.com"),
            teacher_in_charge_name: "admin",
            teacher_in_charge_email: "admin@example.com",
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    // chapters and pages

    let course_module_id = course_modules::insert(conn, course.id, None, 0)
        .await
        .unwrap();
    let new_chapter = NewChapter {
        chapter_number: 1,
        course_id: course.id,
        front_page_id: None,
        name: "The Basics".to_string(),
        opens_at: None,
        deadline: Some(Utc.ymd(2025, 1, 1).and_hms(23, 59, 59)),
        course_module_id: Some(course_module_id),
    };
    let (chapter_1, _front_page_1) = chapters::insert_chapter(conn, new_chapter, admin).await?;
    chapters::set_opens_at(conn, chapter_1.id, Utc::now()).await?;
    let new_chapter = NewChapter {
        chapter_number: 2,
        course_id: course.id,
        front_page_id: None,
        name: "The intermediaries".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(course_module_id),
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
        front_page_id: None,
        name: "Advanced studies".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(course_module_id),
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
        front_page_id: None,
        name: "Forbidden magicks".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(course_module_id),
    };
    let (chapter_4, _front_page_4) = chapters::insert_chapter(conn, new_chapter, admin).await?;
    chapters::set_opens_at(
        conn,
        chapter_4.id,
        Utc::now() + (chrono::Duration::days(365) * 100),
    )
    .await?;

    tracing::info!("inserting modules");
    let second_module_id =
        course_modules::insert(conn, course.id, Some("Another module"), 1).await?;
    let new_chapter = NewChapter {
        chapter_number: 5,
        course_id: course.id,
        front_page_id: None,
        name: "Another chapter".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(second_module_id),
    };
    let (_m1_chapter_1, _m1c1_front_page) =
        chapters::insert_chapter(conn, new_chapter, admin).await?;
    let new_chapter = NewChapter {
        chapter_number: 6,
        course_id: course.id,
        front_page_id: None,
        name: "Another another chapter".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(second_module_id),
    };
    let (_m1_chapter_2, _m1c2_front_page) =
        chapters::insert_chapter(conn, new_chapter, admin).await?;
    let module_id = course_modules::insert(conn, course.id, Some("Bonus module"), 2).await?;
    let new_chapter = NewChapter {
        chapter_number: 7,
        course_id: course.id,
        front_page_id: None,
        name: "Bonus chapter".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(module_id),
    };
    let (_m2_chapter_1, _m2c1_front_page) =
        chapters::insert_chapter(conn, new_chapter, admin).await?;
    let new_chapter = NewChapter {
        chapter_number: 8,
        course_id: course.id,
        front_page_id: None,
        name: "Another bonus chapter".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(module_id),
    };
    let (_m2_chapter_2, _m2c2_front_page) =
        chapters::insert_chapter(conn, new_chapter, admin).await?;

    let (_page, _) = pages::insert_course_page(
        conn,
        course.id,
        "/welcome",
        "Welcome to Introduction to Everything",
        1,
        admin,
    )
    .await?;

    info!("sample exercises");
    let block_id_1 = Uuid::new_v5(&course_id, b"af3b467a-f5db-42ad-9b21-f42ca316b3c6");
    let block_id_2 = Uuid::new_v5(&course_id, b"465f1f95-22a1-43e1-b4a3-7d18e525dc12");
    let block_id_3 = Uuid::new_v5(&course_id, b"46aad5a8-71bd-49cd-8d86-3368ee8bb7ac");
    let block_id_4 = Uuid::new_v5(&course_id, b"09b327a8-8e65-437e-9678-554fc4d98dd4");
    let block_id_5 = Uuid::new_v5(&course_id, b"834648cc-72d9-42d1-bed7-cc6a2e186ae6");
    let block_id_6 = Uuid::new_v5(&course_id, b"223a4718-5287-49ff-853e-a67f4612c629");
    let exercise_1_id = Uuid::new_v5(&course_id, b"cfb950a7-db4e-49e4-8ec4-d7a32b691b08");
    let exercise_1_slide_1_id = Uuid::new_v5(&course_id, b"182c4128-c4e4-40c9-bc5a-1265bfd3654c");
    let exercise_1_slide_1_task_1_id =
        Uuid::new_v5(&course_id, b"f73dab3b-3549-422d-8377-ece1972e5576");
    let exercise_1_slide_1_task_1_spec_1_id =
        Uuid::new_v5(&course_id, b"5f6b7850-5034-4cef-9dcf-e3fd4831067f");
    let exercise_1_slide_1_task_1_spec_2_id =
        Uuid::new_v5(&course_id, b"c713bbfc-86bf-4877-bd39-53afaf4444b5");
    let exercise_1_slide_1_task_1_spec_3_id =
        Uuid::new_v5(&course_id, b"4027d508-4fad-422e-bb7f-15c613a02cc6");

    let (exercise_block_1, exercise_1, slide_1, task_1) = create_best_exercise(
        exercise_1_id,
        exercise_1_slide_1_id,
        exercise_1_slide_1_task_1_id,
        block_id_2,
        block_id_3,
        exercise_1_slide_1_task_1_spec_1_id,
        exercise_1_slide_1_task_1_spec_2_id,
        exercise_1_slide_1_task_1_spec_3_id,
    );
    let page_c1_1 = create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/page-1".to_string(),
            title: "Page One".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![exercise_1],
            exercise_slides: vec![slide_1],
            exercise_tasks: vec![task_1],
            content: serde_json::json!([
                paragraph("Everything is a big topic.", block_id_1),
                exercise_block_1,
                paragraph("So big, that we need many paragraphs.", block_id_4),
                paragraph("Like this.", block_id_5),
                paragraph(&"At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. ".repeat(4), block_id_6),
            ]),
        },
    )
    .await?;

    let exercise_2_id = Uuid::new_v5(&course_id, b"36e7f0c2-e663-4382-a503-081866cfe7d0");
    let exercise_2_slide_1_id = Uuid::new_v5(&course_id, b"0d85864d-a20d-4d65-9ace-9b4d377f38e8");
    let exercise_2_slide_1_task_1_id =
        Uuid::new_v5(&course_id, b"e7fca192-2161-4ab8-8533-8c41dbaa2d69");
    let exercise_2_slide_1_task_1_spec_1_id =
        Uuid::new_v5(&course_id, b"5898293f-2d41-43b1-9e44-92d487196ade");
    let exercise_2_slide_1_task_1_spec_2_id =
        Uuid::new_v5(&course_id, b"93d27d79-f9a1-44ab-839f-484accc67e32");
    let exercise_2_slide_1_task_1_spec_3_id =
        Uuid::new_v5(&course_id, b"81ec2df2-a5fd-4d7d-b85f-0c304e8d2030");
    let exercise_3_id = Uuid::new_v5(&course_id, b"64d273eb-628f-4d43-a11a-e69ebe244942");
    let exercise_3_slide_1_id = Uuid::new_v5(&course_id, b"5441c7c0-60f1-4058-8223-7090c9cac7cb");
    let exercise_3_slide_1_task_1_id =
        Uuid::new_v5(&course_id, b"114caac5-006a-4afb-9806-785154263c11");
    let exercise_3_slide_1_task_1_spec_1_id =
        Uuid::new_v5(&course_id, b"28ea3062-bd6a-45f5-9844-03174e00a0a8");
    let exercise_3_slide_1_task_1_spec_2_id =
        Uuid::new_v5(&course_id, b"1982f566-2d6a-485d-acb0-65d8b8864c7e");
    let exercise_3_slide_1_task_1_spec_3_id =
        Uuid::new_v5(&course_id, b"01ec5329-2cf6-4d0f-92b2-d388360fb402");
    let exercise_4_id = Uuid::new_v5(&course_id, b"029688ec-c7be-4cb3-8928-85cfd6551083");
    let exercise_4_slide_1_id = Uuid::new_v5(&course_id, b"ab8a314b-ac03-497b-8ade-3d8512ed00c9");
    let exercise_4_slide_1_task_1_id =
        Uuid::new_v5(&course_id, b"382fffce-f177-47d0-a5c0-cc8906d34c49");
    let exercise_4_slide_1_task_1_spec_1_id =
        Uuid::new_v5(&course_id, b"4bae54a3-d67c-428b-8996-290f70ae08fa");
    let exercise_4_slide_1_task_1_spec_2_id =
        Uuid::new_v5(&course_id, b"c3f257c0-bdc2-4d81-99ff-a71c76fe670a");
    let exercise_4_slide_1_task_1_spec_3_id =
        Uuid::new_v5(&course_id, b"fca5a8ba-50e0-4375-8d4b-9d02762d908c");
    let (exercise_block_2, exercise_2, slide_2, task_2) = create_best_exercise(
        exercise_2_id,
        exercise_2_slide_1_id,
        exercise_2_slide_1_task_1_id,
        Uuid::new_v5(&course_id, b"2dbb4649-bcac-47ab-a817-ca17dcd70378"),
        Uuid::new_v5(&course_id, b"c0986981-c8ae-4c0b-b558-1163a16760ec"),
        exercise_2_slide_1_task_1_spec_1_id,
        exercise_2_slide_1_task_1_spec_2_id,
        exercise_2_slide_1_task_1_spec_3_id,
    );
    let (exercise_block_3, exercise_3, slide_3, task_3) = create_best_exercise(
        exercise_3_id,
        exercise_3_slide_1_id,
        exercise_3_slide_1_task_1_id,
        Uuid::new_v5(&course_id, b"fb26489d-ca49-4f76-a1c2-f759ed3146c0"),
        Uuid::new_v5(&course_id, b"c0986981-c8ae-4c0b-b558-1163a16760ec"),
        exercise_3_slide_1_task_1_spec_1_id,
        exercise_3_slide_1_task_1_spec_2_id,
        exercise_3_slide_1_task_1_spec_3_id,
    );
    let (exercise_block_4, exercise_4, slide_4, task_4_1) = create_best_exercise(
        exercise_4_id,
        exercise_4_slide_1_id,
        exercise_4_slide_1_task_1_id,
        Uuid::new_v5(&course_id, b"334593ad-8ba5-4589-b1f7-b159e754bdc5"),
        Uuid::new_v5(&course_id, b"389e80bd-5f91-40c7-94ff-7dda1eeb96fb"),
        exercise_4_slide_1_task_1_spec_1_id,
        exercise_4_slide_1_task_1_spec_2_id,
        exercise_4_slide_1_task_1_spec_3_id,
    );

    let page2_id = create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/page-2".to_string(),
            title: "Page 2".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![exercise_2, exercise_3, exercise_4],
            exercise_slides: vec![slide_2, slide_3, slide_4],
            exercise_tasks: vec![task_2, task_3, task_4_1],
            content: serde_json::json!([
                paragraph(
                    "First chapters second page.",
                    Uuid::new_v5(&course_id, b"9faf5a2d-f60d-4a70-af3d-0e7e3d6fe273"),
                ),
                exercise_block_2,
                exercise_block_3,
                exercise_block_4,
            ]),
        },
    )
    .await?;

    url_redirections::insert(conn, page2_id, "/old-url", course.id).await?;

    let (
        quizzes_exercise_block_1,
        quizzes_exercise_1,
        quizzes_exercise_slide_1,
        quizzes_exercise_task_1,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course_id, b"a6ee42d0-2200-43b7-9981-620753a9b5c0"),
        Uuid::new_v5(&course_id, b"8d01d9b3-87d1-4e24-bee2-2726d3853ec6"),
        Uuid::new_v5(&course_id, b"00dd984d-8651-404e-80b8-30fae9cf32ed"),
        Uuid::new_v5(&course_id, b"a66c2552-8123-4287-bd8b-b49a29204870"),
        Uuid::new_v5(&course_id, b"f6f63ff0-c119-4141-922b-bc04cbfa0a31"),
        true,
        serde_json::json!({
            "id": "a2704a2b-fe3d-4945-a007-5593e4b81195",
            "body": "very hard",
            "open": "2021-12-17T07:15:33.479Z",
            "part": 0,
            "items": [{
                "id": "c449acf6-094e-494e-aef4-f5dfa51729ae",
                "body": "",
                "type": "essay",
                "multi": false,
                "order": 0,
                "title": "write an essay",
                "quizId": "a2704a2b-fe3d-4945-a007-5593e4b81195",
                "options": [],
                "maxValue": null,
                "maxWords": 500,
                "minValue": null,
                "minWords": 10,
                "createdAt": "2021-12-17T07:16:23.202Z",
                "direction": "row",
                "updatedAt": "2021-12-17T07:16:23.202Z",
                "formatRegex": null,
                "validityRegex": null,
                "failureMessage": null,
                "successMessage": null,
                "allAnswersCorrect": false,
                "sharedOptionFeedbackMessage": null,
                "usesSharedOptionFeedbackMessage": false
            }],
            "title": "Pretty good exercise",
            "tries": 1,
            "points": 2,
            "section": 0,
            "courseId": "1dbd4a71-5f4c-49c9-b8a0-2e65fb8c4e0c",
            "deadline": "2025-12-17T07:15:33.479Z",
            "createdAt": "2021-12-17T07:15:33.479Z",
            "updatedAt": "2021-12-17T07:15:33.479Z",
            "autoReject": false,
            "autoConfirm": true,
            "triesLimited": true,
            "submitMessage": "This is an extra submit message from the teacher.",
            "excludedFromScore": true,
            "grantPointsPolicy": "grant_whenever_possible",
            "awardPointsEvenIfWrong": false}),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_2,
        quizzes_exercise_2,
        quizzes_exercise_slide_2,
        quizzes_exercise_task_2,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course_id, b"949b548f-a87f-4dc6-aafc-9f1e1abe34a7"),
        Uuid::new_v5(&course_id, b"39c36d3f-017e-4c36-a97e-908e25b3678b"),
        Uuid::new_v5(&course_id, b"8ae8971c-95dd-4d8c-b38f-152ad89c6b20"),
        Uuid::new_v5(&course_id, b"d05b1d9b-f270-4e5e-baeb-a904ea29dc90"),
        Uuid::new_v5(&course_id, b"1057f91c-9dac-4364-9d6a-fa416abc540b"),
        false,
        serde_json::json!({
            "id": "1e2bb795-1736-4b37-ae44-b16ca59b4e4f",
            "body": "very hard",
            "open": "2021-12-17T07:15:33.479Z",
            "part": 0,
            "items": [{
                "id": "d81a81f2-5e44-48c5-ab6d-f724af8a23f2",
                "body": "",
                "type": "open",
                "multi": false,
                "order": 0,
                "title": "When you started studying at the uni? Give the date in yyyy-mm-dd format.",
                "quizId": "690c69e2-9275-4cfa-aba4-63ac917e59f6",
                "options": [],
                "maxValue": null,
                "maxWords": null,
                "minValue": null,
                "minWords": null,
                "createdAt": "2021-12-17T07:16:23.202Z",
                "direction": "row",
                "updatedAt": "2021-12-17T07:16:23.202Z",
                "formatRegex": null,
                "validityRegex": r#"^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$"#.to_string(),
                "failureMessage": "Oh no! Your answer is not in yyyy-mm-dd format :(".to_string(),
                "successMessage": "Gongrats! your answer is in yyyy-mm-dd format!".to_string(),
                "allAnswersCorrect": false,
                "sharedOptionFeedbackMessage": null,
                "usesSharedOptionFeedbackMessage": false
            }],
            "title": "Pretty good exercise",
            "tries": 1,
            "points": 2,
            "section": 0,
            "courseId": "39c7879a-e61f-474a-8f18-7fc476ccc3a0",
            "deadline": "2021-12-17T07:15:33.479Z",
            "createdAt": "2021-12-17T07:15:33.479Z",
            "updatedAt": "2021-12-17T07:15:33.479Z",
            "autoReject": false,
            "autoConfirm": true,
            "triesLimited": true,
            "submitMessage": "This is an extra submit message from the teacher.",
            "excludedFromScore": true,
            "grantPointsPolicy": "grant_whenever_possible",
            "awardPointsEvenIfWrong": false}),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_3,
        quizzes_exercise_3,
        quizzes_exercise_slide_3,
        quizzes_exercise_task_3,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course_id, b"9bcf634d-584c-4fef-892c-3c0e97dab1d5"),
        Uuid::new_v5(&course_id, b"984457f6-bc9b-4604-b54c-80fb4adfab76"),
        Uuid::new_v5(&course_id, b"e4230b3a-1db8-49c4-9554-1f96f7f3d015"),
        Uuid::new_v5(&course_id, b"52939561-af36-4ab6-bffa-be97e94d3314"),
        Uuid::new_v5(&course_id, b"8845b17e-2320-4384-97f8-24e42457cb5e"),
        false,
        serde_json::json!({
            "id": "f1f0520e-3037-409c-b52d-163ad0bc5c59",
            "body": "very hard",
            "open": "2021-12-17T07:15:33.479Z",
            "part": 0,
            "items": [{
                "id": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                "body": "",
                "type": "multiple-choice-dropdown",
                "multi": false,
                "order": 0,
                "title": "Choose the right answer from given options.",
                "quizId": "f1f0520e-3037-409c-b52d-163ad0bc5c59",
                "options": [{
                    "id": "86a2d838-04aa-4b1c-8115-2c15ed19e7b3",
                    "body": "The right answer",
                    "order": 1,
                    "title": null,
                    "quizItemId": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                    "correct":true,
                    "messageAfterSubmissionWhenSelected": "You chose wisely...",
                    "additionalCorrectnessExplanationOnModelSolution": null,
                },
                {
                    "id": "fef8cd36-04ab-48f2-861c-51769ccad52f",
                    "body": "The Wright answer",
                    "order": 2,
                    "title": null,
                    "quizItemId": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                    "correct":false,
                    "messageAfterSubmissionWhenSelected": "You chose poorly...",
                    "additionalCorrectnessExplanationOnModelSolution": null,
                }],
                "maxValue": null,
                "maxWords": null,
                "minValue": null,
                "minWords": null,
                "createdAt": "2021-12-17T07:16:23.202Z",
                "direction": "row",
                "updatedAt": "2021-12-17T07:16:23.202Z",
                "formatRegex": null,
                "validityRegex": null,
                "messageAfterSubmissionWhenSelected": null,
                "additionalCorrectnessExplanationOnModelSolution": null,
                "allAnswersCorrect": false,
                "sharedOptionFeedbackMessage": null,
                "usesSharedOptionFeedbackMessage": false
            }],
            "title": "Pretty good exercise",
            "tries": 1,
            "points": 2,
            "section": 0,
            "courseId": "39c7879a-e61f-474a-8f18-7fc476ccc3a0",
            "deadline": "2021-12-17T07:15:33.479Z",
            "createdAt": "2021-12-17T07:15:33.479Z",
            "updatedAt": "2021-12-17T07:15:33.479Z",
            "autoReject": false,
            "autoConfirm": true,
            "triesLimited": true,
            "submitMessage": "This is an extra submit message from the teacher.",
            "excludedFromScore": true,
            "grantPointsPolicy": "grant_whenever_possible",
            "awardPointsEvenIfWrong": false}),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_4,
        quizzes_exercise_4,
        quizzes_exercise_slide_4,
        quizzes_exercise_task_4,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course_id, b"854a4e05-6575-4d27-8feb-6ee01f662d8a"),
        Uuid::new_v5(&course_id, b"6a8e65be-f5cd-4c87-b4f9-9522cb37bbcb"),
        Uuid::new_v5(&course_id, b"b5e1e7e87-0678-4296-acf7-a8ac926ff94b"),
        Uuid::new_v5(&course_id, b"50e26d7f-f11f-4a8a-990d-fb17c3371d1d"),
        Uuid::new_v5(&course_id, b"7ca39a36-2dcd-4521-bbf6-bfc5849874e3"),
        false,
        serde_json::json!({
            "id": "1e2bb795-1736-4b37-ae44-b16ca59b4e4f",
            "body": "very hard",
            "open": "2021-12-17T07:15:33.479Z",
            "part": 0,
            "items": [{
                "id": "d30bec57-4011-4ac4-b676-79fe766d6424",
                "body": null,
                "type": "clickable-multiple-choice",
                "multi": true,
                "order": 0,
                "title": "Pick all the programming languages from below",
                "quizId": "1e2bb795-1736-4b37-ae44-b16ca59b4e4f",
                "options": [
                    {
                        "id": "55a63887-a896-425c-91ae-2f85032c3d58",
                        "body": "Java",
                        "order": 1,
                        "title": null,
                        "quizItemId": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                        "correct":true,
                        "messageAfterSubmissionWhenSelected": "Java is a programming language",
                        "additionalCorrectnessExplanationOnModelSolution": null
                    },
                    {
                        "id": "534bf512-014e-47b6-a67b-8bea6dc65177",
                        "body": "Erlang",
                        "order": 2,
                        "title": null,
                        "quizItemId": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                        "correct":true,
                        "messageAfterSubmissionWhenSelected": "Erlang is a programming language",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },
                    {
                        "id": "ea4e0bb4-f84e-4048-be2f-f819a391396f",
                        "body": "Jupiter",
                        "order": 3,
                        "title": null,
                        "quizItemId": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "Jupiter is not a programming language",
                        "additionalCorrectnessExplanationOnModelSolution": null
                    },
                    {
                        "id": "b851f1b3-ae90-46bd-8f10-fd6d968695ef",
                        "body": "Rust",
                        "order": 4,
                        "title": null,
                        "quizItemId": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                        "correct":true,
                        "messageAfterSubmissionWhenSelected": "Rust is a programming language",
                        "additionalCorrectnessExplanationOnModelSolution": null
                    },
                    {
                        "id": "8107ae39-96aa-4f54-aa78-1a33362a19c1",
                        "body": "AC",
                        "order": 5,
                        "title": null,
                        "quizItemId": "f8cff916-da28-40ab-9e8b-f523e661ddb6",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "AC is not a programming language",
                        "additionalCorrectnessExplanationOnModelSolution": null
                    },
                ],
                "allAnswersCorrect": false,
                "sharedOptionFeedbackMessage": null,
                "usesSharedOptionFeedbackMessage": false
            }],
            "title": "Pretty good exercise",
            "tries": 1,
            "points": 2,
            "section": 0,
            "courseId": "39c7879a-e61f-474a-8f18-7fc476ccc3a0",
            "deadline": "2021-12-17T07:15:33.479Z",
            "createdAt": "2021-12-17T07:15:33.479Z",
            "updatedAt": "2021-12-17T07:15:33.479Z",
            "autoReject": false,
            "autoConfirm": true,
            "triesLimited": true,
            "submitMessage": "This is an extra submit message from the teacher.",
            "excludedFromScore": true,
            "grantPointsPolicy": "grant_whenever_possible",
            "awardPointsEvenIfWrong": false}),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_5,
        quizzes_exercise_5,
        quizzes_exercise_slide_5,
        quizzes_exercise_task_5,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course.id, b"981623c8-baa3-4d14-bb8a-963e167da9ca"),
        Uuid::new_v5(&course.id, b"b1a6d7e4-00b2-43fb-bf39-863f4ef49d09"),
        Uuid::new_v5(&course.id, b"1a2f2c9f-9552-440e-8dd3-1e3703bd0fab"),
        Uuid::new_v5(&course.id, b"6b568812-f752-4d9f-a60a-48257822d21e"),
        Uuid::new_v5(&course.id, b"b2f7d8d5-f3c0-4cac-8eb7-89a7b88c2236"),
        false,
        serde_json::json!({
          "autoConfirm": true,
          "autoReject": false,
          "awardPointsEvenIfWrong": false,
          "body": "",
          "courseId": "29b09b7e-337f-4074-b14b-6109427a52f6",
          "createdAt": "2022-05-04T09:03:06.271Z",
          "deadline": "2022-05-04T09:03:06.271Z",
          "excludedFromScore": true,
          "grantPointsPolicy": "grant_whenever_possible",
          "id": "72c3bb44-1695-4ea0-af3e-f2280c726551",
          "items": [
            {
              "allAnswersCorrect": false,
              "body": "",
              "createdAt": "2022-05-04T09:03:09.167Z",
              "direction": "column",
              "failureMessage": null,
              "formatRegex": null,
              "id": "105270c8-e94a-40ec-a159-8fe38f116bb4",
              "maxValue": null,
              "maxWords": null,
              "minValue": null,
              "minWords": null,
              "multi": false,
              "optionCells": null,
              "options": [],
              "order": 0,
              "quizId": "72c3bb44-1695-4ea0-af3e-f2280c726551",
              "sharedOptionFeedbackMessage": null,
              "successMessage": null,
              "timelineItems": [
                {
                  "correctEventId": "59e30264-fb11-4e44-a91e-1c5cf80fd977",
                  "correctEventName": "Finland joins  the European Union",
                  "id": "c40fc487-9cb9-4007-80d3-8ffd7a8dc799",
                  "year": "1995"
                },
                {
                  "correctEventId": "0ee17a8e-6d51-4620-b355-90815462543f",
                  "correctEventName": "Finland switches their currency to Euro",
                  "id": "d63fd98e-b73c-47cf-a634-9046249c78e4",
                  "year": "2002"
                },
                {
                  "correctEventId": "0a59d2d3-6cf6-4b91-b1bd-873eefde78ac",
                  "correctEventName": "Finland joins the Economic and Monetary Union of the European Union",
                  "id": "50d7641c-382e-4805-95d8-e873c462bc48",
                  "year": "1998"
                }
              ],
              "title": "",
              "type": "timeline",
              "updatedAt": "2022-05-04T09:03:09.167Z",
              "usesSharedOptionFeedbackMessage": false,
              "validityRegex": null
            }
          ],
          "open": "2022-05-04T09:03:06.271Z",
          "part": 0,
          "points": 0,
          "section": 0,
          "submitMessage": "",
          "title": "",
          "tries": 1,
          "triesLimited": true,
          "updatedAt": "2022-05-04T09:03:06.271Z"
        }),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_6,
        quizzes_exercise_6,
        quizzes_exercise_slide_6,
        quizzes_exercise_task_6,
    ) = quizzes_exercise(
        "Multiple choice with feedback".to_string(),
        Uuid::new_v5(&course.id, b"f7fa3a08-e287-44de-aea8-32133af89d31"),
        Uuid::new_v5(&course.id, b"31820133-579a-4d9f-8b0c-2120f76d1390"),
        Uuid::new_v5(&course.id, b"55f929c7-30ab-441d-a0ad-6cd115857b3b"),
        Uuid::new_v5(&course.id, b"d7a91d07-9bd9-449c-9862-fbacb0b402b0"),
        Uuid::new_v5(&course.id, b"664ea614-4af4-4ad0-9855-eae1881568e6"),
        false,
        serde_json::from_str(include_str!(
            "../assets/quizzes-multiple-choice-feedback.json"
        ))?,
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let page_3 = create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/page-3".to_string(),
            title: "Page 3".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![quizzes_exercise_1],
            exercise_slides: vec![quizzes_exercise_slide_1],
            exercise_tasks: vec![quizzes_exercise_task_1],
            content: serde_json::json!([
                paragraph(
                    "First chapters essay page.",
                    Uuid::new_v5(&course_id, b"6e4ab83a-2ae8-4bd2-a6ea-0e0d1eeabe23")
                ),
                quizzes_exercise_block_1,
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/page-4".to_string(),
            title: "Page 4".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![quizzes_exercise_2],
            exercise_slides: vec![quizzes_exercise_slide_2],
            exercise_tasks: vec![quizzes_exercise_task_2],
            content: serde_json::json!([
                paragraph(
                    "First chapters open page.",
                    Uuid::new_v5(&course_id, b"771b9c61-dbc9-4266-a980-dadc853455c9")
                ),
                quizzes_exercise_block_2
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/page-5".to_string(),
            title: "Page 5".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![quizzes_exercise_3],
            exercise_slides: vec![quizzes_exercise_slide_3],
            exercise_tasks: vec![quizzes_exercise_task_3],
            content: serde_json::json!([
                paragraph(
                    "First chapters multiple-choice-dropdown page",
                    Uuid::new_v5(&course_id, b"7af470e7-cc4f-411e-ad5d-c137e353f7c3")
                ),
                quizzes_exercise_block_3
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/page-6".to_string(),
            title: "Page 6".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![quizzes_exercise_4],
            exercise_slides: vec![quizzes_exercise_slide_4],
            exercise_tasks: vec![quizzes_exercise_task_4],
            content: serde_json::json!([
                paragraph(
                    "First chapters multiple-choice clickable page.",
                    Uuid::new_v5(&course_id, b"6b7775c3-b46e-41e5-a730-0a2c2f0ba148")
                ),
                quizzes_exercise_block_4
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/the-timeline".to_string(),
            title: "The timeline".to_string(),
            chapter_id: Some(chapter_2.id),
            exercises: vec![quizzes_exercise_5],
            exercise_slides: vec![quizzes_exercise_slide_5],
            exercise_tasks: vec![quizzes_exercise_task_5],
            content: serde_json::json!([
                paragraph(
                    "Best page",
                    Uuid::new_v5(&course.id, b"891de1ca-f3a9-506f-a268-3477ea4fdd27")
                ),
                quizzes_exercise_block_5,
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/the-multiple-choice-with-feedback".to_string(),
            title: "Multiple choice with feedback".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![quizzes_exercise_6],
            exercise_slides: vec![quizzes_exercise_slide_6],
            exercise_tasks: vec![quizzes_exercise_task_6],
            content: serde_json::json!([
                paragraph(
                    "Something about rust and feedback.",
                    Uuid::new_v5(&course_id, b"cbb87878-5af1-4c01-b343-97bf668b8034")
                ),
                quizzes_exercise_block_6
            ]),
        },
    )
    .await?;

    let multi_exercise_1_id = Uuid::new_v5(&course_id, b"3abe8579-73f1-4cdf-aba0-3e123fcedaea");
    let multi_exercise_1_slide_1_id =
        Uuid::new_v5(&course_id, b"efc7663c-b0fd-4e21-893a-7b7891191e07");
    let multi_exercise_1_slide_1_task_1_id =
        Uuid::new_v5(&course_id, b"b8833157-aa58-4472-a09b-98406a82ef42");
    let multi_exercise_1_slide_1_task_2_id =
        Uuid::new_v5(&course_id, b"36921424-0a65-4de8-8f92-3be96d695463");
    let multi_exercise_1_slide_1_task_3_id =
        Uuid::new_v5(&course_id, b"4c4bc8e5-7108-4f0d-a3d9-54383aa57269");
    let (multi_exercise_block_1, multi_exercise_1, multi_exercise_1_slides, multi_exercise_1_tasks) =
        example_exercise_flexible(
            multi_exercise_1_id,
            "Multiple task exercise".to_string(),
            vec![(
                multi_exercise_1_slide_1_id,
                vec![
                    (
                        multi_exercise_1_slide_1_task_1_id,
                        "example-exercise".to_string(),
                        serde_json::json!([paragraph(
                            "First question.",
                            Uuid::new_v5(&course_id, b"e972a22b-67ae-4971-b437-70effd5614d4")
                        )]),
                        serde_json::json!([
                            {
                                "name": "Correct",
                                "correct": true,
                                "id": Uuid::new_v5(&course_id, b"0a046287-6b49-405d-ad9e-12f6dc5f9b1d"),
                            },
                            {
                                "name": "Incorrect",
                                "correct": false,
                                "id": Uuid::new_v5(&course_id, b"c202540e-9a3f-4ff4-9703-b9921e9eee8e"),
                            },
                        ]),
                    ),
                    (
                        multi_exercise_1_slide_1_task_2_id,
                        "example-exercise".to_string(),
                        serde_json::json!([paragraph(
                            "Second question.",
                            Uuid::new_v5(&course_id, b"e4895ced-757c-401a-8836-b734b75dff54")
                        )]),
                        serde_json::json!([
                            {
                                "name": "Correct",
                                "correct": true,
                                "id": Uuid::new_v5(&course_id, b"e0c2efa8-ac15-4a3c-94bb-7d5e72e57671"),
                            },
                            {
                                "name": "Incorrect",
                                "correct": false,
                                "id": Uuid::new_v5(&course_id, b"db5cf7d4-b5bb-43f7-931e-e329cc2e95b1"),
                            },
                        ]),
                    ),
                    (
                        multi_exercise_1_slide_1_task_3_id,
                        "example-exercise".to_string(),
                        serde_json::json!([paragraph(
                            "Third question.",
                            Uuid::new_v5(&course_id, b"13b75f4e-b02d-41fa-b5bc-79adf22d9aef")
                        )]),
                        serde_json::json!([
                            {
                                "name": "Correct",
                                "correct": true,
                                "id": Uuid::new_v5(&course_id, b"856defd2-08dd-4632-aaef-ec71cdfd3bca"),
                            },
                            {
                                "name": "Incorrect",
                                "correct": false,
                                "id": Uuid::new_v5(&course_id, b"95ffff70-7dbe-4e39-9480-2a3514e9ea1d"),
                            },
                        ]),
                    ),
                ],
            )],
            Uuid::new_v5(&course_id, b"9e70076a-9137-4d65-989c-0c0951027c53"),
        );
    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_1.id),
        CmsPageUpdate {
            url_path: "/chapter-1/complicated-exercise".to_string(),
            title: "Complicated exercise page".to_string(),
            chapter_id: Some(chapter_1.id),
            exercises: vec![multi_exercise_1],
            exercise_slides: multi_exercise_1_slides,
            exercise_tasks: multi_exercise_1_tasks,
            content: serde_json::json!([
                paragraph(
                    "This page has a complicated exercise.",
                    Uuid::new_v5(&course_id, b"86f1b595-ec82-43a6-954f-c1f8de3d53ac")
                ),
                multi_exercise_block_1
            ]),
        },
    )
    .await?;

    let exercise_5_id = Uuid::new_v5(&course_id, b"8bb4faf4-9a34-4df7-a166-89ade530d0f6");
    let exercise_5_slide_1_id = Uuid::new_v5(&course_id, b"b99d1041-7835-491e-a1c8-b47eee8e7ab4");
    let exercise_5_slide_1_task_1_id =
        Uuid::new_v5(&course_id, b"a6508b8a-f58e-43ac-9f02-785575e716f5");
    let exercise_5_slide_1_task_1_spec_1_id =
        Uuid::new_v5(&course_id, b"fe464d17-2365-4e65-8b33-e0ebb5a67836");
    let exercise_5_slide_1_task_1_spec_2_id =
        Uuid::new_v5(&course_id, b"6633ffc7-c76e-4049-840e-90eefa6b49e8");
    let exercise_5_slide_1_task_1_spec_3_id =
        Uuid::new_v5(&course_id, b"d77fb97d-322c-4c5f-a405-8978a8cfb0a9");
    let (exercise_block_5, exercise_5, exercise_slide_5, exercise_task_5) = create_best_exercise(
        exercise_5_id,
        exercise_5_slide_1_id,
        exercise_5_slide_1_task_1_id,
        Uuid::new_v5(&course_id, b"e869c471-b1b7-42a0-af05-dffd1d86a7bb"),
        Uuid::new_v5(&course_id, b"fe464d17-2365-4e65-8b33-e0ebb5a67836"),
        exercise_5_slide_1_task_1_spec_1_id,
        exercise_5_slide_1_task_1_spec_2_id,
        exercise_5_slide_1_task_1_spec_3_id,
    );
    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_2.id),
        CmsPageUpdate {
            url_path: "/chapter-2/intro".to_string(),
            title: "In the second chapter...".to_string(),
            chapter_id: Some(chapter_2.id),
            exercises: vec![exercise_5],
            exercise_slides: vec![exercise_slide_5],
            exercise_tasks: vec![exercise_task_5],
            content: serde_json::json!([exercise_block_5]),
        },
    )
    .await?;
    create_page(
        conn,
        course.id,
        admin,
        None,
        CmsPageUpdate {
            url_path: "/glossary".to_string(),
            title: "Glossary".to_string(),
            chapter_id: None,
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
            content: serde_json::json!([GutenbergBlock {
                name: "moocfi/glossary".to_string(),
                is_valid: true,
                client_id: Uuid::parse_str("3a388f47-4aa7-409f-af14-a0290b916225").unwrap(),
                attributes: attributes! {},
                inner_blocks: vec![]
            }]),
        },
    )
    .await?;

    // enrollments, user exercise states, submissions, grades
    info!("sample enrollments, user exercise states, submissions, grades");
    for &user_id in users {
        course_instance_enrollments::insert_enrollment_and_set_as_current(
            conn,
            NewCourseInstanceEnrollment {
                course_id,
                course_instance_id: default_instance.id,
                user_id,
            },
        )
        .await?;

        submit_and_grade(
            conn,
            b"8c447aeb-1791-4236-8471-204d8bc27507",
            exercise_1_id,
            exercise_1_slide_1_id,
            course.id,
            exercise_1_slide_1_task_1_id,
            user_id,
            default_instance.id,
            exercise_1_slide_1_task_1_spec_1_id.to_string(),
            100.0,
        )
        .await?;
        // this submission is for the same exercise, but no points are removed due to the update strategy
        submit_and_grade(
            conn,
            b"a719fe25-5721-412d-adea-4696ccb3d883",
            exercise_1_id,
            exercise_1_slide_1_id,
            course.id,
            exercise_1_slide_1_task_1_id,
            user_id,
            default_instance.id,
            exercise_1_slide_1_task_1_spec_2_id.to_string(),
            1.0,
        )
        .await?;
        submit_and_grade(
            conn,
            b"bbc16d4b-1f91-4bd0-a47f-047665a32196",
            exercise_1_id,
            exercise_1_slide_1_id,
            course.id,
            exercise_1_slide_1_task_1_id,
            user_id,
            default_instance.id,
            exercise_1_slide_1_task_1_spec_3_id.to_string(),
            0.0,
        )
        .await?;
        submit_and_grade(
            conn,
            b"c60bf5e5-9b67-4f62-9df7-16d268c1b5f5",
            exercise_1_id,
            exercise_1_slide_1_id,
            course.id,
            exercise_1_slide_1_task_1_id,
            user_id,
            default_instance.id,
            exercise_1_slide_1_task_1_spec_1_id.to_string(),
            60.0,
        )
        .await?;
        submit_and_grade(
            conn,
            b"e0ec1386-72aa-4eed-8b91-72bba420c23b",
            exercise_2_id,
            exercise_2_slide_1_id,
            course.id,
            exercise_2_slide_1_task_1_id,
            user_id,
            default_instance.id,
            exercise_2_slide_1_task_1_spec_1_id.to_string(),
            70.0,
        )
        .await?;
        submit_and_grade(
            conn,
            b"02c9e1ad-6e4c-4473-a3e9-dbfab018a055",
            exercise_5_id,
            exercise_5_slide_1_id,
            course.id,
            exercise_5_slide_1_task_1_id,
            user_id,
            default_instance.id,
            exercise_5_slide_1_task_1_spec_1_id.to_string(),
            80.0,
        )
        .await?;
        submit_and_grade(
            conn,
            b"75df4600-d337-4083-99d1-e8e3b6bf6192",
            exercise_1_id,
            exercise_1_slide_1_id,
            course.id,
            exercise_1_slide_1_task_1_id,
            user_id,
            default_instance.id,
            exercise_1_slide_1_task_1_spec_1_id.to_string(),
            90.0,
        )
        .await?;
    }

    // peer reviews
    let peer_review_id = peer_reviews::insert_with_id(
        conn,
        Uuid::new_v5(&course_id, b"64717822-ac25-4a7d-8298-f0ac39d73260"),
        course_id,
        None,
        2,
        1,
    )
    .await
    .unwrap();
    let new_peer_review_question = NewPeerReviewQuestion {
        peer_review_id,
        order_number: 0,
        question: "General comments".to_string(),
        question_type: PeerReviewQuestionType::Essay,
        answer_required: false,
    };
    let _peer_review_question_1_id = peer_review_questions::insert_with_id(
        conn,
        Uuid::new_v5(&course_id, b"64717822-ac25-4a7d-8298-f0ac39d73260"),
        &new_peer_review_question,
    )
    .await
    .unwrap();

    let new_peer_review_question2 = NewPeerReviewQuestion {
        peer_review_id,
        order_number: 1,
        question: "The answer was correct".to_string(),
        question_type: PeerReviewQuestionType::Scale,
        answer_required: true,
    };
    let _peer_review_question_2_id = peer_review_questions::insert_with_id(
        conn,
        Uuid::new_v5(&course_id, b"6365df37-a9b5-4620-b2fb-926b0c29a954"),
        &new_peer_review_question2,
    )
    .await
    .unwrap();

    let new_peer_review_question3 = NewPeerReviewQuestion {
        peer_review_id,
        order_number: 2,
        question: "The answer was easy to read".to_string(),
        question_type: PeerReviewQuestionType::Scale,
        answer_required: true,
    };
    let _peer_review_question_3_id = peer_review_questions::insert_with_id(
        conn,
        Uuid::new_v5(&course_id, b"19b81b50-fc7f-4535-a285-8fc0604ed85c"),
        &new_peer_review_question3,
    )
    .await
    .unwrap();

    // feedback
    info!("sample feedback");
    let new_feedback = NewFeedback {
        feedback_given: "this part was unclear to me".to_string(),
        selected_text: Some("blanditiis".to_string()),
        related_blocks: vec![FeedbackBlock {
            id: block_id_4,
            text: Some(
                "blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas"
                    .to_string(),
            ),
            order_number: Some(0),
        }],
        page_id: page_3,
    };
    let feedback = feedback::insert(conn, Some(student), course.id, new_feedback).await?;
    feedback::mark_as_read(conn, feedback, true).await?;
    let new_feedback = NewFeedback {
        feedback_given: "I dont think we need these paragraphs".to_string(),
        selected_text: Some("verything".to_string()),
        related_blocks: vec![
            FeedbackBlock {
                id: block_id_1,
                text: Some("verything is a big topic.".to_string()),
                order_number: Some(0),
            },
            FeedbackBlock {
                id: block_id_4,
                text: Some("So big, that we need many paragraphs.".to_string()),
                order_number: Some(1),
            },
            FeedbackBlock {
                id: block_id_5,
                text: Some("Like th".to_string()),
                order_number: Some(2),
            },
        ],
        page_id: page_3,
    };
    feedback::insert(conn, Some(student), course.id, new_feedback).await?;
    feedback::insert(
        conn,
        None,
        course.id,
        NewFeedback {
            feedback_given: "Anonymous feedback".to_string(),
            selected_text: None,
            related_blocks: vec![FeedbackBlock {
                id: block_id_1,
                text: None,
                order_number: Some(0),
            }],
            page_id: page_3,
        },
    )
    .await?;
    feedback::insert(
        conn,
        None,
        course.id,
        NewFeedback {
            feedback_given: "Anonymous unrelated feedback".to_string(),
            selected_text: None,
            related_blocks: vec![],
            page_id: page_3,
        },
    )
    .await?;

    // edit proposals
    info!("sample edit proposals");
    let edits = NewProposedPageEdits {
        page_id: page_c1_1,
        block_edits: vec![NewProposedBlockEdit {
            block_id: block_id_4,
            block_attribute: "content".to_string(),
            original_text: "So bg, that we need many paragraphs.".to_string(),
            changed_text: "So bg, that we need many, many paragraphs.".to_string(),
        }],
    };
    proposed_page_edits::insert(conn, course.id, Some(student), &edits).await?;
    let edits = NewProposedPageEdits {
        page_id: page_c1_1,
        block_edits: vec![
            NewProposedBlockEdit {
                block_id: block_id_1,
                block_attribute: "content".to_string(),
                original_text: "Everything is a big topic.".to_string(),
                changed_text: "Everything is a very big topic.".to_string(),
            },
            NewProposedBlockEdit {
                block_id: block_id_5,
                block_attribute: "content".to_string(),
                original_text: "Like this.".to_string(),
                changed_text: "Like this!".to_string(),
            },
        ],
    };
    proposed_page_edits::insert(conn, course.id, Some(student), &edits).await?;

    // acronyms
    glossary::insert(conn, "CS", "Computer science. Computer science is an essential part of being successful in your life. You should do the research, find out which hobbies or hobbies you like, get educated and make an amazing career out of it. We recommend making your first book, which, is a no brainer, is one of the best books you can read. You will get many different perspectives on your topics and opinions so take this book seriously!",  course.id).await?;
    glossary::insert(conn, "HDD", "Hard disk drive. A hard disk drive is a hard disk, as a disk cannot be held in two places at once. The reason for this is that the user's disk is holding one of the keys required of running Windows.",  course.id).await?;
    glossary::insert(conn, "SSD", "Solid-state drive. A solid-state drive is a hard drive that's a few gigabytes in size, but a solid-state drive is one where data loads are big enough and fast enough that you can comfortably write to it over long distances. This is what drives do. You need to remember that a good solid-state drive has a lot of data: it stores files on disks and has a few data centers. A good solid-state drive makes for a nice little library: its metadata includes information about everything it stores, including any data it can access, but does not store anything that does not exist outside of those files. It also stores large amounts of data from one location, which can cause problems since the data might be different in different places, or in different ways, than what you would expect to see when driving big data applications. The drives that make up a solid-state drive are called drives that use a variety of storage technologies. These drive technology technologies are called \"super drives,\" and they store some of that data in a solid-state drive. Super drives are designed to be fast but very big: they aren't built to store everything, but to store many kinds of data: including data about the data they contain, and more, like the data they are supposed to hold in them. The super drives that make up a solid-state drive can have capacities of up to 50,000 hard disks. These can be used to store files if",  course.id).await?;
    glossary::insert(conn, "KB", "Keyboard.", course.id).await?;

    Ok(course.id)
}

async fn seed_cs_course_material(conn: &mut PgConnection, org: Uuid, admin: Uuid) -> Result<Uuid> {
    // Create new course
    let new_course = NewCourse {
        name: "Introduction to Course Material".to_string(),
        organization_id: org,
        slug: "introduction-to-course-material".to_string(),
        language_code: "en-US".to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: "The definitive introduction to course material.".to_string(),
        is_draft: false,
        is_test_mode: false,
    };
    let (course, front_page, _default_instance, default_module) = courses::insert_course(
        conn,
        Uuid::parse_str("d6b52ddc-6c34-4a59-9a59-7e8594441007")?,
        Uuid::parse_str("8e6c35cd-43f2-4982-943b-11e3ffb1b2f8")?,
        new_course,
        admin,
    )
    .await?;

    // Exercises
    let (
        quizzes_exercise_block_5,
        quizzes_exercise_5,
        quizzes_exercise_slide_5,
        quizzes_exercise_task_5,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course.id, b"cd3aa815-620e-43b3-b291-0fb10beca030"),
        Uuid::new_v5(&course.id, b"0b1bbfb0-df56-4e40-92f1-df0a33f1fc70"),
        Uuid::new_v5(&course.id, b"7f011d0e-1cbf-4870-bacf-1873cf360c15"),
        Uuid::new_v5(&course.id, b"b9446b94-0edf-465c-9a9a-57708b7ef180"),
        Uuid::new_v5(&course.id, b"58e71279-81e1-4679-83e6-8f5f23ec055a"),
        false,
        serde_json::json!({
                "id": "3a1b3e10-2dd5-4cb9-9460-4c08f19e16d3",
                "body": "very hard",
                "part": 3,
                "items": [{
                    "id": "7b0049ea-de8b-4eef-a4a9-164e0e874ecc",
                    "body": "",
                    "type": "multiple-choice",
                    "direction": "row",
                    "multi": false,
                    "order": 0,
                    "title": "Choose the first answer",
                    "quizId": "3a1b3e10-2dd5-4cb9-9460-4c08f19e16d3",
                    "options": [{
                        "id": "d5124283-4e84-4b4f-84c0-a91961b0ef21",
                        "body": "This is first option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "7b0049ea-de8b-4eef-a4a9-164e0e874ecc",
                        "correct":true,
                        "messageAfterSubmissionWhenSelected": "Correct! This is indeed the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },{
                        "id": "846c09e2-653a-4471-81ae-25726486b003",
                        "body": "This is second option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "7b0049ea-de8b-4eef-a4a9-164e0e874ecc",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "Incorrect. This is not the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },{
                        "id": "8107ae39-96aa-4f54-aa78-1a33362a19c1",
                        "body": "This is third option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "7b0049ea-de8b-4eef-a4a9-164e0e874ecc",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "Incorrect. This is not the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },],
                    "allAnswersCorrect": false,
                    "sharedOptionFeedbackMessage": null,
                    "usesSharedOptionFeedbackMessage": false
                }],
                "title": "Very good exercise",
                "tries": 1,
                "points": 3,
                "section": 0,
                "courseId": "d6b52ddc-6c34-4a59-9a59-7e8594441007",
                "deadline": "2021-12-17T07:15:33.479Z",
                "createdAt": "2021-12-17T07:15:33.479Z",
                "updatedAt": "2021-12-17T07:15:33.479Z",
                "autoReject": false,
                "autoConfirm": true,
                "triesLimited": true,
                "submitMessage": "This is an extra submit message from the teacher.",
                "excludedFromScore": true,
                "grantPointsPolicy": "grant_whenever_possible",
                "awardPointsEvenIfWrong": false}),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_6,
        quizzes_exercise_6,
        quizzes_exercise_slide_6,
        quizzes_exercise_task_6,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course.id, b"925d4a89-0f25-4e8e-bc11-350393d8d894"),
        Uuid::new_v5(&course.id, b"ff92ca4a-aa9c-11ec-ac56-475e57747ad3"),
        Uuid::new_v5(&course.id, b"9037cb17-3841-4a79-8f50-bbe595a4f785"),
        Uuid::new_v5(&course.id, b"d6d80ae0-97a1-4db1-8a3b-2bdde3cfbe9a"),
        Uuid::new_v5(&course.id, b"085b60ec-aa9d-11ec-b500-7b1e176646f8"),
        false,
        serde_json::from_str(include_str!(
            "../assets/quizzes-multiple-choice-additional-feedback.json"
        ))?,
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_7,
        quizzes_exercise_7,
        quizzes_exercise_slide_7,
        quizzes_exercise_task_7,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course.id, b"57905c8a-aa9d-11ec-92d4-47ab996cb70c"),
        Uuid::new_v5(&course.id, b"5b058552-aa9d-11ec-bc36-57e1c5f8407a"),
        Uuid::new_v5(&course.id, b"5d953894-aa9d-11ec-97e7-2ff4d73f69f1"),
        Uuid::new_v5(&course.id, b"604dae7c-aa9d-11ec-8df1-575042832340"),
        Uuid::new_v5(&course.id, b"6365746e-aa9d-11ec-8718-0b5628cbe29f"),
        false,
        serde_json::json!({
                "id": "33cd47ea-aa9d-11ec-897c-5b22513d61ee",
                "body": "very hard",
                "part": 5,
                "items": [{
                    "id": "395888c8-aa9d-11ec-bb81-cb3a3f2609e4",
                    "body": "",
                    "type": "multiple-choice",
                    "direction": "column",
                    "multi": false,
                    "order": 0,
                    "title": "Choose the first answer",
                    "quizId": "33cd47ea-aa9d-11ec-897c-5b22513d61ee",
                    "options": [{
                        "id": "490543d8-aa9d-11ec-a20f-07269e5c09df",
                        "body": "This is first option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "395888c8-aa9d-11ec-bb81-cb3a3f2609e4",
                        "correct":true,
                        "messageAfterSubmissionWhenSelected": "Correct! This is indeed the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },{
                        "id": "45e77450-aa9d-11ec-abea-6b824f5ae1f6",
                        "body": "This is second option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "395888c8-aa9d-11ec-bb81-cb3a3f2609e4",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "Incorrect. This is not the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },{
                        "id": "43428140-aa9d-11ec-a6b3-83ec8e2dfb88",
                        "body": "This is third option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "395888c8-aa9d-11ec-bb81-cb3a3f2609e4",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "Incorrect. This is not the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },],
                    "allAnswersCorrect": false,
                    "sharedOptionFeedbackMessage": null,
                    "usesSharedOptionFeedbackMessage": false
                }],
                "title": "Very good exercise",
                "tries": 1,
                "points": 3,
                "section": 0,
                "courseId": "d6b52ddc-6c34-4a59-9a59-7e8594441007",
                "deadline": "2021-12-17T07:15:33.479Z",
                "createdAt": "2021-12-17T07:15:33.479Z",
                "updatedAt": "2021-12-17T07:15:33.479Z",
                "autoReject": false,
                "autoConfirm": true,
                "triesLimited": true,
                "submitMessage": "This is an extra submit message from the teacher.",
                "excludedFromScore": true,
                "grantPointsPolicy": "grant_whenever_possible",
                "awardPointsEvenIfWrong": false}),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    let (
        quizzes_exercise_block_8,
        quizzes_exercise_8,
        quizzes_exercise_slide_8,
        quizzes_exercise_task_8,
    ) = quizzes_exercise(
        "Best quizzes exercise".to_string(),
        Uuid::new_v5(&course.id, b"c1a4831c-cc78-4f42-be18-2a35a7f3b506"),
        Uuid::new_v5(&course.id, b"75045b18-aa9d-11ec-b3d1-6f64c2d6d46d"),
        Uuid::new_v5(&course.id, b"712fd37c-e3d7-4569-8a64-371d7dda9c19"),
        Uuid::new_v5(&course.id, b"6799021d-ff0c-4e4d-b5db-c2c19fba7fb9"),
        Uuid::new_v5(&course.id, b"01b69776-3e82-4694-98a9-5ce53f2a4ab5"),
        false,
        serde_json::json!({
                "id": "9a186f2b-7616-472e-b839-62ab0f2f0a6c",
                "body": "very hard",
                "part": 6,
                "items": [{
                    "id": "871c3640-aa9d-11ec-8103-633d645899a3",
                    "body": "",
                    "type": "multiple-choice",
                    "direction": "column",
                    "multi": false,
                    "order": 0,
                    "title": "Choose the first answer",
                    "quizId": "9a186f2b-7616-472e-b839-62ab0f2f0a6c",
                    "options": [{
                        "id": "4435ed30-c1da-46a0-80b8-c5b9ee923dd4",
                        "body": "This is first option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "871c3640-aa9d-11ec-8103-633d645899a3",
                        "correct":true,
                        "messageAfterSubmissionWhenSelected": "Correct! This is indeed the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },{
                        "id": "1d5de4d0-8499-4ac1-b44c-21c1562639cb",
                        "body": "This is second option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "871c3640-aa9d-11ec-8103-633d645899a3",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "Incorrect. This is not the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },{
                        "id": "93fe358e-aa9d-11ec-9aa1-f3d18a09d58c",
                        "body": "This is third option",
                        "order": 1,
                        "title": null,
                        "quizItemId": "871c3640-aa9d-11ec-8103-633d645899a3",
                        "correct":false,
                        "messageAfterSubmissionWhenSelected": "Incorrect. This is not the first answer",
                        "additionalCorrectnessExplanationOnModelSolution": null,
                    },],
                    "allAnswersCorrect": false,
                    "sharedOptionFeedbackMessage": null,
                    "usesSharedOptionFeedbackMessage": false
                }],
                "title": "Very good exercise",
                "tries": 1,
                "points": 3,
                "section": 0,
                "courseId": "d6b52ddc-6c34-4a59-9a59-7e8594441007",
                "deadline": "2021-12-17T07:15:33.479Z",
                "createdAt": "2021-12-17T07:15:33.479Z",
                "updatedAt": "2021-12-17T07:15:33.479Z",
                "autoReject": false,
                "autoConfirm": true,
                "triesLimited": true,
                "submitMessage": "This is an extra submit message from the teacher.",
                "excludedFromScore": true,
                "grantPointsPolicy": "grant_whenever_possible",
                "awardPointsEvenIfWrong": false}),
        Some(Utc.ymd(2125, 1, 1).and_hms(23, 59, 59)),
    );

    pages::update_page(
        conn,
        front_page.id,
        CmsPageUpdate {
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
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
        },
        admin,
        true,
        HistoryChangeReason::PageSaved,
        false,
    )
    .await?;
    // FAQ, we should add card/accordion block to visualize here.
    let (_page, _history) =
        pages::insert_course_page(conn, course.id, "/faq", "FAQ", 1, admin).await?;
    let course_module_id = course_modules::insert(conn, course.id, None, 0).await?;

    // Chapter-1
    let new_chapter = NewChapter {
        chapter_number: 1,
        course_id: course.id,
        front_page_id: None,
        name: "User Interface".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(course_module_id),
    };
    let (chapter_1, front_page_ch_1) = chapters::insert_chapter(conn, new_chapter, admin).await?;
    chapters::set_opens_at(conn, chapter_1.id, Utc::now()).await?;

    pages::update_page(
        conn,
        front_page_ch_1.id,
        CmsPageUpdate {
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
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
        },
        admin,
        true,
        HistoryChangeReason::PageSaved,
        false,
    )
    .await?;

    // /chapter-1/design
    let design_content = CmsPageUpdate {
        url_path: "/chapter-1/design".to_string(),
        title: "Design".to_string(),
        chapter_id: Some(chapter_1.id),
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content: serde_json::json!([
            GutenbergBlock::hero_section("Design", "A design is a plan or specification for the construction of an object or system or for the implementation of an activity or process, or the result of that plan or specification in the form of a prototype, product or process.")
                .with_id(Uuid::parse_str("98729704-9dd8-4309-aa08-402f9b2a6071")?),
            heading("First heading", Uuid::parse_str("731aa55f-238b-42f4-8c40-c093dd95ee7f")?, 2),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur bibendum felis nisi, vitae commodo mi venenatis in. Mauris hendrerit lacinia augue ut hendrerit. Vestibulum non tellus mattis, convallis magna vel, semper mauris. Maecenas porta, arcu eget porttitor sagittis, nulla magna auctor dolor, sed tempus sem lacus eu tortor. Ut id diam quam. Etiam quis sagittis justo. Quisque sagittis dolor vitae felis facilisis, ut suscipit ipsum malesuada. Nulla tempor ultricies erat ut venenatis. Ut pulvinar lectus non mollis efficitur.",
                  "dropCap": false
                },
            )
                .with_id(Uuid::parse_str("9ebddb78-23f6-4440-8d8f-5e4b33abb16f")?),
                heading("Second heading", Uuid::parse_str("a70aac40-acda-48e3-8f53-b64370be4585")?, 3),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                },
            )
                .with_id(Uuid::parse_str("029ae4b5-08b0-49f7-8baf-d916b5f879a2")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                },
            )
            .with_id(Uuid::parse_str("3693e92b-9cf0-485a-b026-2851de58e9cf")?),
            heading("Third heading", Uuid::parse_str("4d16bfea-4fa9-4355-bbd4-4c61e33d3d7c")?, 2),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                },
            )
                .with_id(Uuid::parse_str("4ef39962-634d-488c-be82-f44e5db19421")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                },
            )
            .with_id(Uuid::parse_str("0d47c02a-194e-42a4-927e-fb29a4fda39c")?),
        ]),
    };
    create_page(conn, course.id, admin, Some(chapter_1.id), design_content).await?;

    // /chapter-1/human-machine-interface
    let content_b = CmsPageUpdate {
        chapter_id: Some(chapter_1.id),
        url_path: "/chapter-1/human-machine-interface".to_string(),
        title: "Human-machine interface".to_string(),
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content: serde_json::json!([
            GutenbergBlock::hero_section("Human-machine interface", "In the industrial design field of human–computer interaction, a user interface is the space where interactions between humans and machines occur.")
                .with_id(Uuid::parse_str("ae22ae64-c0e5-42e1-895a-4a49411a72e8")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Sed venenatis, magna in ornare suscipit, orci ipsum consequat nulla, ut pulvinar libero metus et metus. Maecenas nec bibendum est. Donec quis ante elit. Nam in eros vitae urna aliquet vestibulum. Donec posuere laoreet facilisis. Aliquam auctor a tellus a tempus. Sed molestie leo eget commodo pellentesque. Curabitur lacinia odio nisl, eu sodales nunc placerat sit amet. Vivamus venenatis, risus vitae lobortis eleifend, odio nisi faucibus tortor, sed aliquet leo arcu et tellus. Donec ultrices consectetur nunc, non rhoncus sapien malesuada et. Nulla tempus ipsum vitae justo scelerisque, sed pretium neque fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur accumsan et ex pellentesque dignissim. Integer viverra libero quis tortor dignissim elementum.",
                  "dropCap": false
                },
            )
                .with_id(Uuid::parse_str("b05a62ad-e5f7-432c-8c88-2976d971e7e1")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                    "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices banana justo tellus non arcu. Cras euismod, cat lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                    "dropCap": false
                },
            )
                .with_id(Uuid::parse_str("db20e302-d4e2-4f56-a0b9-e48a4fbd5fa8")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                },
            )
            .with_id(Uuid::parse_str("c96f56d5-ea35-4aae-918a-72a36847a49c")?),
        ]),
    };
    create_page(conn, course.id, admin, Some(chapter_1.id), content_b).await?;

    // Chapter-2
    let new_chapter_2 = NewChapter {
        chapter_number: 2,
        course_id: course.id,
        front_page_id: None,
        name: "User Experience".to_string(),
        opens_at: None,
        deadline: None,
        course_module_id: Some(course_module_id),
    };
    let (chapter_2, front_page_ch_2) = chapters::insert_chapter(conn, new_chapter_2, admin).await?;
    chapters::set_opens_at(conn, chapter_2.id, Utc::now()).await?;

    pages::update_page(
        conn,
        front_page_ch_2.id,
        CmsPageUpdate {
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
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
        },
        admin,
        true,
        HistoryChangeReason::PageSaved,
        false,
    )
    .await?;
    // /chapter-2/user-research
    let page_content = CmsPageUpdate {
        chapter_id: Some(chapter_2.id),
        content: serde_json::json!([
            GutenbergBlock::hero_section("User research", "User research focuses on understanding user behaviors, needs, and motivations through observation techniques, task analysis, and other feedback methodologies.")
                .with_id(Uuid::parse_str("a43f5460-b588-44ac-84a3-5fdcabd5d3f7")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Sed venenatis, magna in ornare suscipit, orci ipsum consequat nulla, ut pulvinar libero metus et metus. Maecenas nec bibendum est. Donec quis ante elit. Nam in eros vitae urna aliquet vestibulum. Donec posuere laoreet facilisis. Aliquam auctor a tellus a tempus. Sed molestie leo eget commodo pellentesque. Curabitur lacinia odio nisl, eu sodales nunc placerat sit amet. Vivamus venenatis, risus vitae lobortis eleifend, odio nisi faucibus tortor, sed aliquet leo arcu et tellus. Donec ultrices consectetur nunc, non rhoncus sapien malesuada et. Nulla tempus ipsum vitae justo scelerisque, sed pretium neque fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur accumsan et ex pellentesque dignissim. Integer viverra libero quis tortor dignissim elementum.",
                  "dropCap": false
                },
            )
                .with_id(Uuid::parse_str("816310e3-bbd7-44ae-87cb-3f40633a4b08")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                  "content": "Sed quis fermentum mi. Integer commodo turpis a fermentum tristique. Integer convallis, nunc sed scelerisque varius, mi tellus molestie metus, eu ultrices justo tellus non arcu. Cras euismod, lectus eu scelerisque mattis, odio ex ornare ipsum, a dapibus nulla leo maximus orci. Etiam laoreet venenatis lorem, vitae iaculis mauris. Nullam lobortis, tortor eget ullamcorper lobortis, tellus odio tincidunt dolor, vitae gravida nibh turpis ac sem. Integer non sodales eros.",
                  "dropCap": false
                },
            )
                .with_id(Uuid::parse_str("37aa6421-768e-49b9-b447-5f457e5192bc")?),
            GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes!{
                    "content": "Vestibulum a scelerisque ante. Fusce interdum eros elit, posuere mattis sapien tristique id. Integer commodo mi orci, sit amet tempor libero vulputate in. Ut id gravida quam. Proin massa dolor, posuere nec metus eu, dignissim viverra nulla. Vestibulum quis neque bibendum, hendrerit diam et, fermentum diam. Sed risus nibh, suscipit in neque nec, bibendum interdum nibh. Aliquam ut banana cat enim a mi ultricies finibus. Nam tristique felis ac risus interdum molestie. Nulla venenatis, augue sed porttitor ultrices, lacus ante sollicitudin dui, vel vehicula ex enim ac mi.",
                  "dropCap": false
                },
            )
            .with_id(Uuid::parse_str("cf11a0fb-f56e-4e0d-bc12-51d920dbc278")?),
        ]),
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        url_path: "/chapter-2/user-research".to_string(),
        title: "User research".to_string(),
    };
    create_page(conn, course.id, admin, Some(chapter_2.id), page_content).await?;

    let page_content = include_str!("../assets/example-page.json");
    let parse_page_content = serde_json::from_str(page_content)?;
    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_2.id),
        CmsPageUpdate {
            content: parse_page_content,
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
            url_path: "/chapter-2/content-rendering".to_string(),
            title: "Content rendering".to_string(),
            chapter_id: Some(chapter_2.id),
        },
    )
    .await?;

    // Multiple choice

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_2.id),
        CmsPageUpdate {
            url_path: "/chapter-2/page-3".to_string(),
            title: "Page 3".to_string(),
            chapter_id: Some(chapter_2.id),
            exercises: vec![quizzes_exercise_5],
            exercise_slides: vec![quizzes_exercise_slide_5],
            exercise_tasks: vec![quizzes_exercise_task_5],
            content: serde_json::json!([
                paragraph(
                    "Second chapters third page",
                    Uuid::new_v5(&course.id, b"4ebd0208-8328-5d69-8c44-ec50939c0967")
                ),
                quizzes_exercise_block_5,
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_2.id),
        CmsPageUpdate {
            url_path: "/chapter-2/page-4".to_string(),
            title: "Page 4".to_string(),
            chapter_id: Some(chapter_2.id),
            exercises: vec![quizzes_exercise_6],
            exercise_slides: vec![quizzes_exercise_slide_6],
            exercise_tasks: vec![quizzes_exercise_task_6],
            content: serde_json::json!([
                paragraph(
                    "Second chapters fourth page",
                    Uuid::new_v5(&course.id, b"4841cabb-77a0-53cf-b539-39fbd060e73b")
                ),
                quizzes_exercise_block_6,
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_2.id),
        CmsPageUpdate {
            url_path: "/chapter-2/page-5".to_string(),
            title: "Page 5".to_string(),
            chapter_id: Some(chapter_2.id),
            exercises: vec![quizzes_exercise_7],
            exercise_slides: vec![quizzes_exercise_slide_7],
            exercise_tasks: vec![quizzes_exercise_task_7],
            content: serde_json::json!([
                paragraph(
                    "Second chapters fifth page",
                    Uuid::new_v5(&course.id, b"9a614406-e1b4-5920-8e0d-54d1a3ead5f3")
                ),
                quizzes_exercise_block_7,
            ]),
        },
    )
    .await?;

    create_page(
        conn,
        course.id,
        admin,
        Some(chapter_2.id),
        CmsPageUpdate {
            url_path: "/chapter-2/page-6".to_string(),
            title: "Page 6".to_string(),
            chapter_id: Some(chapter_2.id),
            exercises: vec![quizzes_exercise_8],
            exercise_slides: vec![quizzes_exercise_slide_8],
            exercise_tasks: vec![quizzes_exercise_task_8],
            content: serde_json::json!([
                paragraph(
                    "Second chapters sixth page",
                    Uuid::new_v5(&course.id, b"891de1ca-f3a9-506f-a268-3477ea4fdd27")
                ),
                quizzes_exercise_block_8,
            ]),
        },
    )
    .await?;

    Ok(course.id)
}

#[allow(clippy::too_many_arguments)]
async fn create_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    author: Uuid,
    chapter_id: Option<Uuid>,
    page_data: CmsPageUpdate,
) -> Result<Uuid> {
    let new_page = NewPage {
        content: Value::Array(vec![]),
        url_path: page_data.url_path.to_string(),
        title: format!("{} WIP", page_data.title),
        course_id: Some(course_id),
        exam_id: None,
        chapter_id,
        front_page_of_chapter_id: None,
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content_search_language: None,
    };
    let page = pages::insert_page(conn, new_page, author).await?;
    pages::update_page(
        conn,
        page.id,
        CmsPageUpdate {
            content: page_data.content,
            exercises: page_data.exercises,
            exercise_slides: page_data.exercise_slides,
            exercise_tasks: page_data.exercise_tasks,
            url_path: page_data.url_path,
            title: page_data.title,
            chapter_id,
        },
        author,
        true,
        HistoryChangeReason::PageSaved,
        false,
    )
    .await?;
    Ok(page.id)
}

fn paragraph(content: &str, block: Uuid) -> GutenbergBlock {
    GutenbergBlock {
        name: "core/paragraph".to_string(),
        is_valid: true,
        client_id: block,
        attributes: attributes! {
            "content": content,
            "dropCap": false,
        },
        inner_blocks: vec![],
    }
}

fn heading(content: &str, client_id: Uuid, level: i32) -> GutenbergBlock {
    GutenbergBlock {
        name: "core/heading".to_string(),
        is_valid: true,
        client_id,
        attributes: attributes! {
            "content": content,
            "level": level,
        },
        inner_blocks: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
fn create_best_exercise(
    exercise_id: Uuid,
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    block_id: Uuid,
    paragraph_id: Uuid,
    spec_1: Uuid,
    spec_2: Uuid,
    spec_3: Uuid,
) -> (
    GutenbergBlock,
    CmsPageExercise,
    CmsPageExerciseSlide,
    CmsPageExerciseTask,
) {
    let (exercise_block, exercise, mut slides, mut tasks) = example_exercise_flexible(
        exercise_id,
        "Best exercise".to_string(),
        vec![(
            exercise_slide_id,
            vec![(
                exercise_task_id,
                "example-exercise".to_string(),
                serde_json::json!([paragraph("Answer this question.", paragraph_id)]),
                serde_json::json!([
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
                ]),
            )],
        )],
        block_id,
    );
    (
        exercise_block,
        exercise,
        slides.swap_remove(0),
        tasks.swap_remove(0),
    )
}

#[allow(clippy::type_complexity)]
fn example_exercise_flexible(
    exercise_id: Uuid,
    exercise_name: String,
    exercise_slides: Vec<(Uuid, Vec<(Uuid, String, Value, Value)>)>,
    client_id: Uuid,
) -> (
    GutenbergBlock,
    CmsPageExercise,
    Vec<CmsPageExerciseSlide>,
    Vec<CmsPageExerciseTask>,
) {
    let block = GutenbergBlock {
        client_id,
        name: "moocfi/exercise".to_string(),
        is_valid: true,
        attributes: attributes! {
            "id": exercise_id,
            "name": exercise_name,
            "dropCap": false,
        },
        inner_blocks: vec![],
    };
    let slides: Vec<CmsPageExerciseSlide> = exercise_slides
        .iter()
        .map(|(slide_id, _)| CmsPageExerciseSlide {
            id: *slide_id,
            exercise_id,
            order_number: 1,
        })
        .collect();
    let tasks: Vec<CmsPageExerciseTask> = exercise_slides
        .into_iter()
        .flat_map(|(slide_id, tasks)| {
            tasks.into_iter().enumerate().map(
                move |(order_number, (task_id, task_type, assignment, spec))| {
                    (
                        slide_id,
                        task_id,
                        task_type,
                        assignment,
                        spec,
                        order_number as i32,
                    )
                },
            )
        })
        .map(
            |(slide_id, task_id, exercise_type, assignment, spec, order_number)| {
                CmsPageExerciseTask {
                    id: task_id,
                    exercise_slide_id: slide_id,
                    assignment,
                    exercise_type,
                    private_spec: Some(spec),
                    order_number,
                }
            },
        )
        .collect();
    let exercise = CmsPageExercise {
        id: exercise_id,
        name: exercise_name,
        order_number: 1,
        score_maximum: tasks.len() as i32,
        max_tries_per_slide: None,
        limit_number_of_tries: false,
        deadline: None,
        needs_peer_review: false,
    };
    (block, exercise, slides, tasks)
}

#[allow(clippy::too_many_arguments)]
fn quizzes_exercise(
    name: String,
    exercise_id: Uuid,
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    block_id: Uuid,
    paragraph_id: Uuid,
    needs_peer_review: bool,
    private_spec: serde_json::Value,
    deadline: Option<DateTime<Utc>>,
) -> (
    GutenbergBlock,
    CmsPageExercise,
    CmsPageExerciseSlide,
    CmsPageExerciseTask,
) {
    let block = GutenbergBlock {
        client_id: block_id,
        name: "moocfi/exercise".to_string(),
        is_valid: true,
        attributes: attributes! {
            "id": exercise_id,
            "name": name,
            "dropCap": false,
        },
        inner_blocks: vec![],
    };
    let exercise = CmsPageExercise {
        id: exercise_id,
        name,
        order_number: 1,
        score_maximum: 1,
        max_tries_per_slide: None,
        limit_number_of_tries: false,
        deadline,
        needs_peer_review,
    };
    let exercise_slide = CmsPageExerciseSlide {
        id: exercise_slide_id,
        exercise_id,
        order_number: 1,
    };
    let exercise_task = CmsPageExerciseTask {
        id: exercise_task_id,
        exercise_slide_id,
        assignment: serde_json::json!([paragraph("Answer this question.", paragraph_id)]),
        exercise_type: "quizzes".to_string(),
        private_spec: Some(serde_json::json!(private_spec)),
        order_number: 0,
    };
    (block, exercise, exercise_slide, exercise_task)
}

#[allow(clippy::too_many_arguments)]
async fn submit_and_grade(
    conn: &mut PgConnection,
    id: &[u8],
    exercise_id: Uuid,
    exercise_slide_id: Uuid,
    course_id: Uuid,
    exercise_task_id: Uuid,
    user_id: Uuid,
    course_instance_id: Uuid,
    spec: String,
    out_of_100: f32,
) -> Result<()> {
    // combine the id with the user id to ensure it's unique
    let id = [id, &user_id.as_bytes()[..]].concat();
    let slide_submission = exercise_slide_submissions::insert_exercise_slide_submission_with_id(
        conn,
        Uuid::new_v4(),
        &exercise_slide_submissions::NewExerciseSlideSubmission {
            exercise_slide_id,
            course_id: Some(course_id),
            course_instance_id: Some(course_instance_id),
            exam_id: None,
            exercise_id,
            user_id,
            user_points_update_strategy: UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
        },
    )
    .await?;
    let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
        conn,
        user_id,
        exercise_id,
        Some(course_instance_id),
        None,
    )
    .await?;
    let user_exercise_slide_state = user_exercise_slide_states::get_or_insert_by_unique_index(
        conn,
        user_exercise_state.id,
        exercise_slide_id,
    )
    .await?;
    let task_submission_id = exercise_task_submissions::insert_with_id(
        conn,
        &exercise_task_submissions::SubmissionData {
            id: Uuid::new_v5(&course_id, &id),
            exercise_id,
            course_id,
            exercise_task_id,
            exercise_slide_submission_id: slide_submission.id,
            exercise_slide_id,
            user_id,
            course_instance_id,
            data_json: Value::String(spec),
        },
    )
    .await?;

    let task_submission = exercise_task_submissions::get_by_id(conn, task_submission_id).await?;
    let exercise = exercises::get_by_id(conn, exercise_id).await?;
    let grading = exercise_task_gradings::new_grading(conn, &exercise, &task_submission).await?;
    let grading_result = ExerciseTaskGradingResult {
        feedback_json: Some(serde_json::json!([{"SelectedOptioIsCorrect": true}])),
        feedback_text: Some("Good job!".to_string()),
        grading_progress: GradingProgress::FullyGraded,
        score_given: out_of_100,
        score_maximum: 100,
    };
    headless_lms_models::library::grading::propagate_user_exercise_state_update_from_exercise_task_grading_result(
        conn,
        &exercise,
        &grading,
        &grading_result,
        user_exercise_slide_state,
        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
    )
    .await
    .unwrap();
    Ok(())
}

async fn create_exam(
    conn: &mut PgConnection,
    name: String,
    starts_at: Option<DateTime<Utc>>,
    ends_at: Option<DateTime<Utc>>,
    time_minutes: i32,
    organization_id: Uuid,
    course_id: Uuid,
    exam_id: Uuid,
    teacher: Uuid,
) -> Result<()> {
    let new_exam_id = exams::insert(
        conn,
        &NewExam {
            name,
            starts_at,
            ends_at,
            time_minutes,
            organization_id,
        },
        Some(exam_id),
    )
    .await?;

    let (exam_exercise_block_1, exam_exercise_1, exam_exercise_slide_1, exam_exercise_task_1) =
        quizzes_exercise(
            "Multiple choice with feedback".to_string(),
            Uuid::new_v5(&course_id, b"b1b16970-60bc-426e-9537-b29bd2185db3"),
            Uuid::new_v5(&course_id, b"ea461a21-e0b4-4e09-a811-231f583b3dcb"),
            Uuid::new_v5(&course_id, b"9d8ccf47-3e83-4459-8f2f-8e546a75f372"),
            Uuid::new_v5(&course_id, b"a4edb4e5-507d-43f1-8058-9d95941dbf09"),
            Uuid::new_v5(&course_id, b"eced4875-ece9-4c3d-ad0a-2443e61b3e78"),
            false,
            serde_json::from_str(include_str!(
                "../assets/quizzes-multiple-choice-feedback.json"
            ))?,
            None,
        );
    let (exam_exercise_block_2, exam_exercise_2, exam_exercise_slide_2, exam_exercise_task_2) =
        create_best_exercise(
            Uuid::new_v5(&course_id, b"44f472e5-b726-4c50-89a1-93f4170673f5"),
            Uuid::new_v5(&course_id, b"23182b3d-fbf4-4c0d-93fa-e9ddc199cc52"),
            Uuid::new_v5(&course_id, b"ca105826-5007-439f-87be-c25f9c79506e"),
            Uuid::new_v5(&course_id, b"96a9e586-cf88-4cb2-b7c9-efc2bc47e90b"),
            Uuid::new_v5(&course_id, b"fe5bb5a9-d0ab-4072-abe1-119c9c1e4f4a"),
            Uuid::new_v5(&course_id, b"22959aad-26fc-4212-8259-c128cdab8b08"),
            Uuid::new_v5(&course_id, b"d8ba9e92-4530-4a74-9b11-eb708fa54d40"),
            Uuid::new_v5(&course_id, b"846f4895-f573-41e2-9926-cd700723ac18"),
        );
    pages::insert_page(
        conn,
        NewPage {
            exercises: vec![exam_exercise_1, exam_exercise_2],
            exercise_slides: vec![exam_exercise_slide_1, exam_exercise_slide_2],
            exercise_tasks: vec![exam_exercise_task_1, exam_exercise_task_2],
            content: serde_json::json!([
                heading(
                    "The exam",
                    Uuid::parse_str("d6cf16ce-fe78-4e57-8399-e8b63d7fddac").unwrap(),
                    1
                ),
                paragraph(
                    "In this exam you're supposed to answer to two easy questions. Good luck!",
                    Uuid::parse_str("474d4f21-798b-4ba0-b39f-120b134e7fa0").unwrap(),
                ),
                exam_exercise_block_1,
                exam_exercise_block_2,
            ]),
            url_path: "".to_string(),
            title: "".to_string(),
            course_id: None,
            exam_id: Some(new_exam_id),
            chapter_id: None,
            front_page_of_chapter_id: None,
            content_search_language: None,
        },
        teacher,
    )
    .await?;
    exams::set_course(conn, new_exam_id, course_id).await?;
    Ok(())
}
