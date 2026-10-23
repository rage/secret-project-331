use pretty_assertions::assert_eq;
use serde_json::{Value, json};

use super::*;
use crate::ids::SequentialIds;
use crate::test_fixtures::{id, p};

fn spage(name: &str, title: &str, url_path: &str) -> StructurePage {
    StructurePage {
        id: id(name),
        title: title.to_string(),
        url_path: url_path.to_string(),
        hidden: false,
        block_count: 3,
        exercise_count: 0,
        has_submissions: false,
    }
}

fn chapter(name: &str, number: i32, title: &str, pages: Vec<StructurePage>) -> StructureChapter {
    StructureChapter {
        id: id(name),
        chapter_number: number,
        name: title.to_string(),
        color: None,
        opens_at: None,
        deadline: None,
        pages,
    }
}

fn sample() -> CourseStructure {
    let mut variables = spage("pg2", "Variables", "/chapter-1/variables");
    variables.exercise_count = 3;
    variables.has_submissions = true;
    CourseStructure {
        course: StructureCourse {
            id: id("c1"),
            pages: vec![
                spage("pg0", "Ohjelmoinnin perusteet", "/"),
                spage("pg40", "FAQ", "/faq"),
            ],
            modules: vec![
                StructureModule {
                    id: id("m1"),
                    default: true,
                    name: None,
                    chapters: vec![
                        chapter(
                            "ch1",
                            1,
                            "Basics",
                            vec![
                                spage("pg1", "Basics", "/chapter-1"),
                                variables,
                                spage("pg3", "Loops", "/chapter-1/loops"),
                            ],
                        ),
                        chapter(
                            "ch2",
                            2,
                            "Functions",
                            vec![
                                spage("pg4", "Functions", "/chapter-2"),
                                spage("pg5", "Recursion", "/chapter-2/recursion"),
                            ],
                        ),
                    ],
                },
                StructureModule {
                    id: id("m2"),
                    default: false,
                    name: Some("Advanced".to_string()),
                    chapters: vec![chapter(
                        "ch3",
                        3,
                        "Classes",
                        vec![spage("pg6", "Classes", "/chapter-3")],
                    )],
                },
                StructureModule {
                    id: id("m3"),
                    default: false,
                    name: Some("Empty".to_string()),
                    chapters: vec![],
                },
            ],
        },
    }
}

fn run_live(doc: &CourseStructure, ops: Value, live: bool) -> Result<StructureResult, EditError> {
    let raw = ops.as_array().cloned().unwrap_or_default();
    let ops = parse(&raw)?;
    let ids = SequentialIds::new();
    let ctx = EngineContext::new(&ids).live(live);
    apply(doc, &ops, &ctx)
}

fn run(doc: &CourseStructure, ops: Value) -> Result<StructureResult, EditError> {
    run_live(doc, ops, false)
}

fn new_id(n: u64) -> Uuid {
    SequentialIds::nth(n)
}

fn path_of(result: &StructureResult, page: Uuid) -> String {
    result
        .structure
        .page(page)
        .map(|p| p.url_path.clone())
        .unwrap_or_default()
}

fn chapter_pages(result: &StructureResult, chapter: &str) -> Vec<Uuid> {
    result
        .structure
        .chapters()
        .find(|c| c.id == id(chapter))
        .map(|c| c.pages.iter().map(|p| p.id).collect())
        .unwrap_or_default()
}

#[test]
fn row1_set_fields() {
    let result = run(
        &sample(),
        json!([
            {"op":"replace","path":format!("{}/name", p("m2")),"value":"Advanced topics"},
            {"op":"replace","path":format!("{}/name", p("ch2")),"value":"Funcs"},
            {"op":"replace","path":format!("{}/color", p("ch2")),"value":"#1f6964"},
            {"op":"replace","path":format!("{}/deadline", p("ch2")),"value":"2026-12-01T21:59:00Z"},
            {"op":"replace","path":format!("{}/title", p("pg3")),"value":"For loops"},
            {"op":"replace","path":format!("{}/hidden", p("pg3")),"value":true},
        ]),
    )
    .unwrap();
    let ch2 = result
        .structure
        .chapters()
        .find(|c| c.id == id("ch2"))
        .unwrap();
    assert_eq!(ch2.name, "Funcs");
    assert_eq!(ch2.color.as_deref(), Some("#1F6964"));
    assert!(ch2.deadline.is_some());
    assert_eq!(
        result.structure.course.modules[1].name.as_deref(),
        Some("Advanced topics")
    );
    let pg3 = result.structure.page(id("pg3")).unwrap();
    assert!(pg3.hidden);
    assert_eq!(pg3.url_path, "/chapter-1/loops");
}

#[test]
fn row2_clear_nullable_field() {
    let mut doc = sample();
    doc.course.modules[0].chapters[1].deadline = Some(Utc::now());
    let result = run(
        &doc,
        json!([{"op":"remove","path":format!("{}/deadline", p("ch2"))}]),
    )
    .unwrap();
    assert!(result.structure.chapters().all(|c| c.deadline.is_none()));
    let replaced = run(
        &doc,
        json!([{"op":"replace","path":format!("{}/deadline", p("ch2")),"value":null}]),
    )
    .unwrap();
    assert!(replaced.structure.chapters().all(|c| c.deadline.is_none()));
    let error = run(
        &doc,
        json!([{"op":"remove","path":format!("{}/title", p("pg3"))}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvalidValue);
}

#[test]
fn row3_add_module_at_end_or_after_another() {
    let result = run(
        &sample(),
        json!([
            {"op":"add","path":"/course/modules","position":"end","value":{"name":"Project"}},
            {"op":"add","path":p("m2"),"position":"after","value":{"name":"Extra"}},
        ]),
    )
    .unwrap();
    let names: Vec<_> = result
        .structure
        .course
        .modules
        .iter()
        .map(|m| m.name.clone().unwrap_or_default())
        .collect();
    assert_eq!(names, vec!["", "Advanced", "Extra", "Empty", "Project"]);
    assert_eq!(result.new_modules, vec![new_id(1), new_id(2)]);
}

#[test]
fn row3_nothing_goes_before_the_default_module() {
    let error = run(
        &sample(),
        json!([{"op":"add","path":"/course/modules","position":"start","value":{"name":"X"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::DefaultModule);
    let settings = run(&sample(), json!([{"op":"add","path":"/course/modules","position":"end","value":{"name":"X","completion_policy":{}}}])).unwrap_err();
    assert_eq!(settings.code, EditErrorCode::WrongTool);
}

#[test]
fn row4_remove_empty_module_only() {
    let result = run(&sample(), json!([{"op":"remove","path":p("m3")}])).unwrap();
    assert_eq!(result.structure.course.modules.len(), 2);
    let error = run(&sample(), json!([{"op":"remove","path":p("m2")}])).unwrap_err();
    assert_eq!(error.code, EditErrorCode::ModuleNotEmpty);
    assert!(error.message.contains("Classes"));
    let default = run(&sample(), json!([{"op":"remove","path":p("m1")}])).unwrap_err();
    assert_eq!(default.code, EditErrorCode::DefaultModule);
}

#[test]
fn row5_add_chapter_gets_front_page_and_renumbers() {
    let result = run(
        &sample(),
        json!([{"op":"add","path":p("ch2"),"position":"before","value":{"name":"Recursion","color":"#1F6964"}}]),
    )
    .unwrap();
    let new_chapter = result
        .structure
        .chapters()
        .find(|c| c.id == new_id(1))
        .unwrap();
    assert_eq!(new_chapter.chapter_number, 2);
    assert_eq!(new_chapter.pages[0].title, "Recursion");
    assert_eq!(new_chapter.pages[0].url_path, "/chapter-2");
    assert_eq!(path_of(&result, id("pg5")), "/chapter-3/recursion");
    assert_eq!(path_of(&result, id("pg6")), "/chapter-4");
    assert!(result.renumbered_chapters.contains(&ChapterRenumber {
        chapter_id: id("ch2"),
        from: 2,
        to: 3
    }));
    assert!(result.redirects.contains(&Redirect {
        page_id: id("pg4"),
        from: "/chapter-2".into(),
        to: "/chapter-3".into()
    }));
}

#[test]
fn row6_add_chapter_with_pages_and_content() {
    let result = run(
        &sample(),
        json!([
            {"op":"add","path":format!("{}/chapters", p("m2")),"position":"end","value":{"label":"$ch","name":"Recursion"}},
            {"op":"add","path":"/$ch/pages","position":"end","value":[
                {"title":"Base cases","blocks":[{"name":"core/paragraph","attributes":{"content":"…"}}]},
                {"title":"Tail calls"}
            ]},
        ]),
    )
    .unwrap();
    let pages = chapter_pages(&result, "unused");
    assert!(pages.is_empty());
    let new_chapter = result
        .structure
        .chapters()
        .find(|c| c.id == new_id(1))
        .unwrap();
    let titles: Vec<_> = new_chapter.pages.iter().map(|p| p.title.as_str()).collect();
    assert_eq!(titles, vec!["Recursion", "Base cases", "Tail calls"]);
    assert_eq!(new_chapter.pages[1].url_path, "/chapter-4/base-cases");
    let content = result
        .new_pages
        .iter()
        .find(|p| p.page_id == new_chapter.pages[1].id)
        .unwrap();
    assert_eq!(content.blocks.len(), 1);
    assert_eq!(content.page_type, PageType::CoursePage);
    assert_eq!(result.labels["$ch"], new_id(1));
}

#[test]
fn row7_set_opening_time() {
    let result = run(&sample(), json!([{"op":"replace","path":format!("{}/opens_at", p("ch3")),"value":"2027-02-01T08:00:00Z"}])).unwrap();
    assert!(
        result
            .structure
            .chapters()
            .find(|c| c.id == id("ch3"))
            .unwrap()
            .opens_at
            .is_some()
    );
    let error = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/opens_at", p("ch3")),"value":"tomorrow"}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvalidValue);
}

#[test]
fn row8_move_before_or_after() {
    let result = run(
        &sample(),
        json!([
            {"op":"move","from":p("m3"),"path":p("m2"),"position":"before"},
            {"op":"move","from":p("ch1"),"path":p("ch2"),"position":"after"},
            {"op":"move","from":p("pg5"),"path":p("pg4"),"position":"before"},
        ]),
    )
    .unwrap();
    assert_eq!(result.structure.course.modules[1].id, id("m3"));
    let chapters: Vec<_> = result
        .structure
        .chapters()
        .map(|c| (c.id, c.chapter_number))
        .collect();
    assert_eq!(chapters[0], (id("ch2"), 1));
    assert_eq!(path_of(&result, id("pg5")), "/chapter-1");
    assert_eq!(path_of(&result, id("pg4")), "/chapter-1/functions");
    assert_eq!(path_of(&result, id("pg2")), "/chapter-2/variables");
}

#[test]
fn row9_move_into_another_parent() {
    let result = run(
        &sample(),
        json!([
            {"op":"move","from":p("ch2"),"path":format!("{}/chapters", p("m3")),"position":"end"},
            {"op":"move","from":p("pg3"),"path":"/course/pages","position":"end"},
        ]),
    )
    .unwrap();
    assert_eq!(result.structure.course.modules[2].chapters[0].id, id("ch2"));
    assert_eq!(path_of(&result, id("pg3")), "/loops");
    assert!(result.moved_pages.contains(&PageChapterMove {
        page_id: id("pg3"),
        from_chapter: Some(id("ch1")),
        to_chapter: None
    }));
}

#[test]
fn row9_page_with_exercises_stays_in_chapters() {
    let error = run(
        &sample(),
        json!([{"op":"move","from":p("pg2"),"path":"/course/pages","position":"end"}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvariantViolated);
    let ok = run(&sample(), json!([{"op":"move","from":p("pg2"),"path":format!("{}/pages", p("ch2")),"position":"end"}])).unwrap();
    assert!(ok.moved_pages.contains(&PageChapterMove {
        page_id: id("pg2"),
        from_chapter: Some(id("ch1")),
        to_chapter: Some(id("ch2"))
    }));
}

#[test]
fn row10_move_range_of_pages() {
    let result = run(
        &sample(),
        json!([{"op":"move","from":p("pg2"),"through":p("pg3"),"path":format!("{}/pages", p("ch3")),"position":"end"}]),
    )
    .unwrap();
    assert_eq!(
        chapter_pages(&result, "ch3"),
        vec![id("pg6"), id("pg2"), id("pg3")]
    );
    assert_eq!(path_of(&result, id("pg2")), "/chapter-3/variables");
}

#[test]
fn row11_front_page_swap_by_move_to_start() {
    let result = run(&sample(), json!([{"op":"move","from":p("pg3"),"path":format!("{}/pages", p("ch1")),"position":"start"}])).unwrap();
    assert_eq!(path_of(&result, id("pg3")), "/chapter-1");
    assert_eq!(path_of(&result, id("pg1")), "/chapter-1/basics");
    let redirects = &result.redirects;
    assert!(redirects.contains(&Redirect {
        page_id: id("pg3"),
        from: "/chapter-1/loops".into(),
        to: "/chapter-1".into()
    }));
    assert!(redirects.contains(&Redirect {
        page_id: id("pg1"),
        from: "/chapter-1".into(),
        to: "/chapter-1/basics".into()
    }));
}

#[test]
fn front_page_swap_when_first_page_is_removed() {
    let result = run(&sample(), json!([{"op":"remove","path":p("pg1")}])).unwrap();
    assert_eq!(path_of(&result, id("pg2")), "/chapter-1");
    assert!(result.redirects.iter().all(|r| r.page_id != id("pg1")));
}

#[test]
fn row12_reorder() {
    let result = run(
        &sample(),
        json!([{"op":"reorder","path":format!("{}/pages", p("ch1")),"value":[id("pg3").to_string(), p("pg1"), id("pg2").to_string()]}]),
    )
    .unwrap();
    assert_eq!(
        chapter_pages(&result, "ch1"),
        vec![id("pg3"), id("pg1"), id("pg2")]
    );
    let error = run(&sample(), json!([{"op":"reorder","path":format!("{}/pages", p("ch1")),"value":[id("pg3").to_string()]}])).unwrap_err();
    assert_eq!(error.code, EditErrorCode::ReorderMismatch);
    assert_eq!(
        error.details.unwrap()["current_ids"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
}

#[test]
fn row13_copy_then_rename_by_label() {
    let result = run(
        &sample(),
        json!([
            {"op":"copy","from":p("pg3"),"path":p("pg3"),"position":"after","label":"$c"},
            {"op":"replace","path":"/$c/title","value":"For loops, part 2"},
        ]),
    )
    .unwrap();
    let copy = result.structure.page(new_id(1)).unwrap();
    assert_eq!(copy.title, "For loops, part 2");
    assert_eq!(copy.url_path, "/chapter-1/loops-copy");
    assert_eq!(
        result.page_copies,
        vec![PageCopy {
            source_page_id: id("pg3"),
            new_page_id: new_id(1)
        }]
    );
}

#[test]
fn row13_copy_chapter_copies_pages() {
    let result = run(
        &sample(),
        json!([{"op":"copy","from":p("ch2"),"path":p("ch2"),"position":"after"}]),
    )
    .unwrap();
    let copy = result
        .structure
        .chapters()
        .find(|c| c.id == new_id(1))
        .unwrap();
    assert_eq!(copy.name, "Functions-copy");
    assert_eq!(copy.chapter_number, 3);
    assert_eq!(copy.pages[0].url_path, "/chapter-3");
    assert_eq!(copy.pages[1].url_path, "/chapter-3/recursion-copy");
    assert_eq!(result.page_copies.len(), 2);
}

#[test]
fn row14_remove_chapter_with_pages() {
    let result = run(&sample(), json!([{"op":"remove","path":p("ch1")}])).unwrap();
    assert!(result.structure.page(id("pg2")).is_none());
    assert_eq!(path_of(&result, id("pg4")), "/chapter-1");
    assert!(result.redirects.iter().all(|r| r.page_id != id("pg2")));
}

#[test]
fn row15_add_page_empty_or_with_content() {
    let result = run_live(
        &sample(),
        json!([
            {"op":"add","path":format!("{}/pages", p("ch1")),"position":"end","value":{"title":"While loops","blocks":[{"name":"core/paragraph"}]}},
            {"op":"add","path":"/course/pages","position":"end","value":{"title":"Contact","url_path":"/contact"}},
            {"op":"add","path":"/course/pages","position":"end","value":{"title":"Usein kysytyt kysymykset"}},
        ]),
        true,
    )
    .unwrap();
    let while_page = result.structure.page(new_id(1)).unwrap();
    assert_eq!(while_page.url_path, "/chapter-1/while-loops");
    assert!(!while_page.hidden);
    let contact = result.structure.page(new_id(3)).unwrap();
    assert_eq!(contact.url_path, "/contact");
    assert!(contact.hidden);
    assert_eq!(
        result.structure.page(new_id(4)).unwrap().url_path,
        "/usein-kysytyt-kysymykset"
    );
    assert_eq!(
        result
            .warnings
            .iter()
            .filter(|w| w.code == WarningCode::NewPageHidden)
            .count(),
        2
    );
}

#[test]
fn row15_pinned_front_page() {
    let error = run(
        &sample(),
        json!([{"op":"add","path":"/course/pages","position":"start","value":{"title":"X"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::PinnedFrontPage);
    assert!(error.fix.unwrap().contains(&id("pg0").to_string()));
    for op in [
        json!({"op":"remove","path":p("pg0")}),
        json!({"op":"move","from":p("pg0"),"path":"/course/pages","position":"end"}),
        json!({"op":"replace","path":format!("{}/url_path", p("pg0")),"value":"/home"}),
    ] {
        assert_eq!(
            run(&sample(), json!([op])).unwrap_err().code,
            EditErrorCode::PinnedFrontPage
        );
    }
    let renamed = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/title", p("pg0")),"value":"Home"}]),
    )
    .unwrap();
    assert_eq!(renamed.structure.course.pages[0].title, "Home");
}

#[test]
fn row16_remove_page_range() {
    let result = run(
        &sample(),
        json!([{"op":"remove","path":p("pg2"),"through":p("pg3")}]),
    )
    .unwrap();
    assert_eq!(chapter_pages(&result, "ch1"), vec![id("pg1")]);
}

#[test]
fn row17_split_chapter() {
    let result = run(
        &sample(),
        json!([
            {"op":"add","path":p("ch1"),"position":"after","value":{"label":"$ch","name":"Basics, part 2"}},
            {"op":"move","from":p("pg2"),"through":p("pg3"),"path":"/$ch/pages","position":"end"},
        ]),
    )
    .unwrap();
    let pages = result
        .structure
        .chapters()
        .nth(1)
        .unwrap()
        .pages
        .iter()
        .map(|p| p.id)
        .collect::<Vec<_>>();
    assert_eq!(pages, vec![new_id(2), id("pg2"), id("pg3")]);
}

#[test]
fn row18_merge_chapter_into_previous() {
    let result = run(
        &sample(),
        json!([
            {"op":"move","from":p("pg4"),"through":p("pg5"),"path":format!("{}/pages", p("ch1")),"position":"end"},
            {"op":"remove","path":p("ch2")},
        ]),
    )
    .unwrap();
    assert_eq!(chapter_pages(&result, "ch1").len(), 5);
    assert_eq!(path_of(&result, id("pg4")), "/chapter-1/functions");
    assert_eq!(path_of(&result, id("pg6")), "/chapter-2");
}

#[test]
fn chapter_without_pages_is_rejected_at_the_end() {
    let error = run(&sample(), json!([{"op":"remove","path":p("pg6")}])).unwrap_err();
    assert_eq!(error.code, EditErrorCode::ChapterNeedsPage);
    assert!(error.fix.unwrap().contains(&id("ch3").to_string()));
}

#[test]
fn derived_settings_and_unknown_fields_teach() {
    let derived = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/chapter_number", p("ch1")),"value":4}]),
    )
    .unwrap_err();
    assert_eq!(derived.code, EditErrorCode::DerivedField);
    assert!(derived.fix.unwrap().contains("move"));
    let settings = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/certification_enabled", p("m2")),"value":true}]),
    )
    .unwrap_err();
    assert_eq!(settings.code, EditErrorCode::WrongTool);
    let unknown = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/slug", p("pg3")),"value":"x"}]),
    )
    .unwrap_err();
    assert_eq!(unknown.code, EditErrorCode::UnknownField);
    let course = run(
        &sample(),
        json!([{"op":"replace","path":"/course/name","value":"x"}]),
    )
    .unwrap_err();
    assert_eq!(course.code, EditErrorCode::WrongTool);
    let counts = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/block_count", p("pg3")),"value":1}]),
    )
    .unwrap_err();
    assert_eq!(counts.code, EditErrorCode::ReadOnlyField);
}

#[test]
fn url_paths_are_normalised_unique_and_swappable() {
    let swapped = run(
        &sample(),
        json!([
            {"op":"replace","path":format!("{}/url_path", p("pg2")),"value":"loops"},
            {"op":"replace","path":format!("{}/url_path", p("pg3")),"value":"/chapter-1/variables"},
        ]),
    )
    .unwrap();
    assert_eq!(path_of(&swapped, id("pg2")), "/chapter-1/loops");
    assert_eq!(path_of(&swapped, id("pg3")), "/chapter-1/variables");

    let duplicate = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/url_path", p("pg3")),"value":"variables"}]),
    )
    .unwrap_err();
    assert_eq!(duplicate.code, EditErrorCode::DuplicatePath);

    let outside = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/url_path", p("pg3")),"value":"/other/loops"}]),
    )
    .unwrap_err();
    assert_eq!(outside.code, EditErrorCode::InvalidUrlPath);

    let front = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/url_path", p("pg1")),"value":"basics"}]),
    )
    .unwrap_err();
    assert_eq!(front.code, EditErrorCode::InvalidUrlPath);

    let derived_collision = run(
        &sample(),
        json!([{"op":"add","path":"/course/pages","position":"end","value":{"title":"FAQ"}}]),
    )
    .unwrap();
    assert_eq!(path_of(&derived_collision, new_id(1)), "/faq-2");
}

#[test]
fn never_published_course_gets_no_redirects() {
    let raw = vec![
        json!({"op":"move","from":p("pg3"),"path":format!("{}/pages", p("ch1")),"position":"start"}),
    ];
    let ops = parse(&raw).unwrap();
    let ids = SequentialIds::new();
    let mut ctx = EngineContext::new(&ids);
    ctx.creates_redirects = false;
    let result = apply(&sample(), &ops, &ctx).unwrap();
    assert!(result.redirects.is_empty());
    assert_eq!(result.changed_paths.len(), 2);
}

#[test]
fn page_types_follow_position() {
    let doc = sample();
    assert_eq!(doc.page_type(id("pg0")), Some(PageType::CourseFrontPage));
    assert_eq!(doc.page_type(id("pg40")), Some(PageType::TopLevelPage));
    assert_eq!(doc.page_type(id("pg1")), Some(PageType::ChapterFrontPage));
    assert_eq!(doc.page_type(id("pg2")), Some(PageType::CoursePage));
    assert_eq!(doc.page_type(id("nope")), None);
}
