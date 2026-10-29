use chrono::{Duration, Utc};
use headless_lms_models::{
    PKeyPolicy,
    chapters::{self, NewChapter},
    courses, exercise_slides,
    exercise_tasks::{self, NewExerciseTask},
    join_code_uses, organizations, page_visit_datum, user_exercise_states,
};
use headless_lms_utils::course_url::{build_course_url, course_page_url};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::{Fixture, TestExercise};

impl Fixture {
    /// The course site URL of the fixture's course, with `path` appended.
    async fn public_url(&self, path: &str) -> String {
        let mut conn = self.pool.acquire().await.unwrap();
        let course = courses::get_course(&mut conn, self.course_id)
            .await
            .unwrap();
        let organization = organizations::get_organization(&mut conn, course.organization_id)
            .await
            .unwrap();
        if path.is_empty() {
            build_course_url(&self.app_conf.base_url, &organization.slug, &course.slug)
        } else {
            course_page_url(
                &self.app_conf.base_url,
                &organization.slug,
                &course.slug,
                path,
            )
            .unwrap()
        }
    }

    /// Adds `count` pages with maximum-length titles under `path_prefix`, in `chapter_id` or at
    /// the top level.
    async fn add_long_titled_pages(
        &self,
        chapter_id: Option<Uuid>,
        path_prefix: &str,
        count: usize,
    ) {
        for index in 0..count {
            self.add_page_in(
                chapter_id,
                &format!("{index:03}{}", "x".repeat(252)),
                &format!("{path_prefix}/long-{index}"),
            )
            .await;
        }
    }

    /// The structured result of `read_public_course` on `url`, which may be a refusal.
    async fn read_public(&self, url: String, path: Option<&str>) -> Value {
        let mut arguments = json!({"url": url});
        if let Some(path) = path {
            arguments["path"] = json!(path);
        }
        self.call_result("read_public_course", arguments).await
    }

    /// Adds a task with recognizable private and model solution specs to the exercise's slide.
    async fn add_task_with_answers(&self, exercise: &TestExercise) {
        let mut conn = self.pool.acquire().await.unwrap();
        let slide = exercise_slides::get_exercise_slides_by_exercise_id(&mut conn, exercise.id)
            .await
            .unwrap()
            .remove(0);
        exercise_tasks::insert(
            &mut conn,
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide.id,
                exercise_type: "quizzes".to_string(),
                assignment: vec![],
                public_spec: Some(json!({"options": ["for", "while"]})),
                private_spec: Some(json!({"correct": "private-answer-key"})),
                model_solution_spec: Some(json!({"correct": "model-solution-answer"})),
                order_number: 1,
            },
        )
        .await
        .unwrap();
    }
}

fn succeeded(result: &Value) -> &Value {
    assert_eq!(result["isError"], json!(false), "{result}");
    &result["structuredContent"]
}

fn refusal(result: &Value) -> String {
    assert_eq!(result["isError"], json!(true), "{result}");
    result["structuredContent"]["error"]["message"]
        .as_str()
        .unwrap()
        .to_string()
}

#[tokio::test]
async fn reads_another_teachers_course_as_published_reference() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    let exercise = owner.add_exercise(false).await;
    owner.add_task_with_answers(&exercise).await;
    owner.edit_paragraph("Staged, not published.").await;
    let url = owner.public_url("").await;

    let outline = reader.read_public(url.clone(), None).await;
    let outline = succeeded(&outline);
    assert_eq!(outline["reference_only"], json!(true));
    assert!(
        outline["notice"]
            .as_str()
            .unwrap()
            .contains("not a course you are working on")
    );
    assert_eq!(outline["course"]["language_code"], json!("en"));
    assert_eq!(outline["course"]["organization"], json!("MCP tests"));
    let chapter = &outline["chapters"][0];
    assert_eq!(chapter["name"], json!("Basics"));
    assert!(
        chapter["pages"]
            .as_array()
            .unwrap()
            .contains(&json!({"title": "Loops", "path": "/chapter-1/loops"}))
    );

    let page = reader
        .read_public(owner.public_url("/chapter-1/loops").await, None)
        .await;
    let page = succeeded(&page);
    assert_eq!(page["reference_only"], json!(true));
    assert_eq!(page["page"]["title"], json!("Loops"));
    let blocks = page["blocks"].to_string();
    assert!(blocks.contains("Loops repeat things."), "{blocks}");
    assert!(!blocks.contains("Staged, not published."), "{blocks}");
    assert_eq!(page["exercises"][0]["name"], json!("Write a loop"));
    assert_eq!(page["exercises"][0]["tasks"].as_array().unwrap().len(), 2);

    let serialized = page.to_string();
    assert!(serialized.contains("\"options\":[\"for\",\"while\"]"));
    assert!(!serialized.contains("private-answer-key"));
    assert!(!serialized.contains("model-solution-answer"));
    assert!(!serialized.contains("private_spec"));
    assert!(!serialized.contains("has_submissions"));

    let by_slugs = reader
        .call_result(
            "read_public_course",
            json!({
                "course_slug": url.split('/').nth(6).unwrap(),
                "path": "/chapter-1/loops",
            }),
        )
        .await;
    assert_eq!(succeeded(&by_slugs)["page"]["title"], json!("Loops"));

    // Nothing else in this database writes visits, so any row would be ours.
    let mut conn = reader.pool.acquire().await.unwrap();
    assert_eq!(
        page_visit_datum::get_oldest_date(&mut conn).await.unwrap(),
        None
    );
}

#[tokio::test]
async fn write_tools_still_refuse_the_course() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    let edit = reader
        .call_result(
            "patch_page_content",
            json!({
                "course": owner.course_id,
                "page": owner.page_id,
                "ops": [{"op": "replace", "path": format!("/{}/attributes/content", owner.paragraph_id), "value": "Changed"}],
            }),
        )
        .await;
    assert!(refusal(&edit).contains("read_public_course"));
}

#[tokio::test]
async fn draft_courses_are_refused() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    owner.set_draft(true).await;
    let read = reader.read_public(owner.public_url("").await, None).await;
    assert!(refusal(&read).contains("draft"));
    let own = owner.read_public(owner.public_url("").await, None).await;
    succeeded(&own);
}

#[tokio::test]
async fn join_code_courses_open_only_to_those_who_joined() {
    let owner = Fixture::new().await;
    let joined = Fixture::new().await;
    let stranger = Fixture::new().await;
    owner
        .update_course(|update| update.is_joinable_by_code_only = true)
        .await;
    join_code_uses::insert(
        &mut owner.pool.acquire().await.unwrap(),
        PKeyPolicy::Generate,
        joined.user_id,
        owner.course_id,
    )
    .await
    .unwrap();
    let url = owner.public_url("/chapter-1/loops").await;

    let read = joined.read_public(url.clone(), None).await;
    assert_eq!(succeeded(&read)["page"]["title"], json!("Loops"));
    let refused = stranger.read_public(url, None).await;
    assert!(refusal(&refused).contains("join code"));
}

#[tokio::test]
async fn unopened_chapters_are_listed_closed_without_pages() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    chapters::set_opens_at(
        &mut owner.pool.acquire().await.unwrap(),
        owner.chapter_id,
        Utc::now() + Duration::days(7),
    )
    .await
    .unwrap();

    let outline = reader.read_public(owner.public_url("").await, None).await;
    let chapter = &succeeded(&outline)["chapters"][0];
    assert_eq!(chapter["name"], json!("Basics"));
    assert_eq!(chapter["status"], json!("closed"));
    assert!(chapter.get("pages").is_none(), "{chapter}");
    let page = reader
        .read_public(owner.public_url("").await, Some("/chapter-1/loops"))
        .await;
    assert!(refusal(&page).contains("isn't open yet"));

    let teacher_outline = owner.read_public(owner.public_url("").await, None).await;
    assert!(succeeded(&teacher_outline)["chapters"][0]["pages"].is_array());
    let as_teacher = owner
        .read_public(owner.public_url("").await, Some("/chapter-1/loops"))
        .await;
    assert_eq!(succeeded(&as_teacher)["page"]["title"], json!("Loops"));
}

#[tokio::test]
async fn exercises_show_the_slide_selected_for_the_caller() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    let exercise = owner.add_exercise(false).await;
    let mut conn = owner.pool.acquire().await.unwrap();
    let second_slide = exercise_slides::insert(&mut conn, PKeyPolicy::Generate, exercise.id, 1)
        .await
        .unwrap();
    exercise_tasks::insert(
        &mut conn,
        PKeyPolicy::Generate,
        NewExerciseTask {
            exercise_slide_id: second_slide,
            exercise_type: "quizzes".to_string(),
            assignment: vec![],
            public_spec: Some(json!({"variant": "second slide"})),
            private_spec: None,
            model_solution_spec: None,
            order_number: 0,
        },
    )
    .await
    .unwrap();
    user_exercise_states::upsert_selected_exercise_slide_id(
        &mut conn,
        reader.user_id,
        exercise.id,
        Some(owner.course_id),
        None,
        Some(second_slide),
    )
    .await
    .unwrap();
    drop(conn);

    let url = owner.public_url("/chapter-1/loops").await;
    for _ in 0..3 {
        let page = reader.read_public(url.clone(), None).await;
        assert_eq!(
            succeeded(&page)["exercises"][0]["tasks"],
            json!([{"exercise_type": "quizzes", "instructions": [], "public_spec": {"variant": "second slide"}}])
        );
    }
}

#[tokio::test]
async fn blank_path_reads_the_outline_and_page_paths_drop_query_and_fragment() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    let url = owner.public_url("").await;

    let blank = reader.read_public(url.clone(), Some("  ")).await;
    assert!(succeeded(&blank)["chapters"].is_array(), "{blank}");
    let decorated = reader
        .read_public(url, Some("/chapter-1/loops?tab=1#exercise"))
        .await;
    assert_eq!(succeeded(&decorated)["page"]["title"], json!("Loops"));
}

#[tokio::test]
async fn urls_on_other_sites_are_refused() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    let own = owner.public_url("/chapter-1/loops").await;
    let path = own.split_once("/org/").unwrap().1;
    let elsewhere = reader
        .read_public(format!("https://example.com/org/{path}"), None)
        .await;
    assert!(
        refusal(&elsewhere).contains("isn't a course URL on this site"),
        "{elsewhere}"
    );
}

#[tokio::test]
async fn a_mismatched_organization_slug_still_reads_the_course() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    let url = owner.public_url("/chapter-1/loops").await;
    let course_and_page = url.split_once("/courses/").unwrap().1;
    let mismatched = reader
        .app_conf
        .public_url(&format!("/org/someone-else/courses/{course_and_page}"));

    let read = reader.read_public(mismatched, None).await;
    let read = succeeded(&read);
    assert_eq!(read["page"]["title"], json!("Loops"));
    assert_eq!(read["course"]["organization"], json!("MCP tests"));
    assert_eq!(read["page"]["url"], json!(url));
}

#[tokio::test]
async fn outline_continuations_carry_only_further_chapters() {
    let owner = Fixture::new().await;
    let reader = Fixture::new().await;
    let second_chapter = chapters::insert(
        &mut owner.pool.acquire().await.unwrap(),
        PKeyPolicy::Generate,
        &NewChapter {
            name: "Advanced".to_string(),
            color: None,
            course_id: owner.course_id,
            chapter_number: 2,
            front_page_id: None,
            opens_at: None,
            deadline: None,
            course_module_id: None,
        },
    )
    .await
    .unwrap();
    // About 6 KB each: both chapters fit the 16 KB budget only if the top-level pages don't count.
    owner.add_long_titled_pages(None, "", 20).await;
    owner
        .add_long_titled_pages(Some(owner.chapter_id), "/chapter-1", 20)
        .await;
    owner
        .add_long_titled_pages(Some(second_chapter), "/chapter-2", 20)
        .await;
    let url = owner.public_url("").await;

    let first = reader.read_public(url.clone(), None).await;
    let first = succeeded(&first);
    assert!(first["notice"].is_string());
    assert!(first["pages"].as_array().unwrap().len() > 20);
    assert_eq!(first["chapters"].as_array().unwrap().len(), 1, "{first}");
    assert_eq!(first["next_offset"], json!(1));

    let rest = reader
        .call_result("read_public_course", json!({"url": url, "offset": 1}))
        .await;
    let rest = succeeded(&rest);
    assert_eq!(rest["chapters"][0]["name"], json!("Advanced"));
    assert_eq!(rest["has_more"], json!(false));
    for repeated in ["notice", "course", "pages"] {
        assert!(rest.get(repeated).is_none(), "{repeated} in {rest}");
    }
}
