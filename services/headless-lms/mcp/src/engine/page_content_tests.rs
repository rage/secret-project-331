use pretty_assertions::assert_eq;
use serde_json::{Value, json};

use super::*;
use crate::engine::op::{PatchTarget, parse_ops};
use crate::ids::SequentialIds;
use crate::test_fixtures::*;

fn run_with(
    page_doc: &PageDocument,
    others: &[PageDocument],
    ops: Value,
) -> Result<PageContentResult, EditError> {
    let raw = ops.as_array().cloned().unwrap_or_default();
    let ops = parse_ops(&raw, PatchTarget::PageContent)?;
    let ids = SequentialIds::new();
    let ctx = EngineContext::new(&ids).with_pages(others);
    apply(page_doc, &ops, &ctx)
}

fn run(page_doc: &PageDocument, ops: Value) -> Result<PageContentResult, EditError> {
    run_with(page_doc, &[], ops)
}

fn new_id(n: u64) -> Uuid {
    SequentialIds::nth(n)
}

fn sample() -> PageDocument {
    page(
        "pg1",
        PageType::CoursePage,
        vec![
            heading("h1", "Loops"),
            para("p1", "First."),
            para("p2", "Second."),
            infobox(
                "box1",
                vec![para("c1", "Inside one."), para("c2", "Inside two.")],
            ),
            para("p3", "Third."),
            exercise("ex1", "exercise-1"),
        ],
    )
}

fn content(result: &PageContentResult, block: Uuid) -> String {
    let path = blocks::find_path(&result.page.blocks, block).expect("block exists");
    blocks::get(&result.page.blocks, &path).attributes["content"]
        .as_str()
        .unwrap_or_default()
        .to_string()
}

#[test]
fn row1_add_before_and_after_a_block() {
    let result = run(
        &sample(),
        json!([
            {"op":"add","path":p("p2"),"position":"before","value":{"name":"core/heading","attributes":{"level":2,"content":"Loops"}}},
            {"op":"add","path":p("p1"),"position":"after","value":{"name":"core/paragraph","attributes":{"content":"After p1"}}},
        ]),
    )
    .unwrap();
    assert_eq!(
        top_level(&result.page.blocks)[..5],
        [id("h1"), id("p1"), new_id(2), new_id(1), id("p2")]
    );
    assert_eq!(
        result.created,
        vec![
            CreatedIds {
                op: 0,
                ids: vec![new_id(1)]
            },
            CreatedIds {
                op: 1,
                ids: vec![new_id(2)]
            }
        ]
    );
}

#[test]
fn row2_add_at_start_and_end_of_page_and_container() {
    let result = run(
        &sample(),
        json!([
            {"op":"add","path":"","position":"end","value":{"name":"core/paragraph"}},
            {"op":"add","path":"","position":"start","value":{"name":"core/paragraph"}},
            {"op":"add","path":format!("{}/innerBlocks", p("box1")),"position":"start","value":{"name":"core/paragraph"}},
        ]),
    )
    .unwrap();
    let top = top_level(&result.page.blocks);
    assert_eq!(top.first(), Some(&new_id(2)));
    assert_eq!(top.last(), Some(&new_id(1)));
    let boxed = &result.page.blocks[4];
    assert_eq!(boxed.client_id, id("box1"));
    assert_eq!(boxed.inner_blocks[0].client_id, new_id(3));
}

#[test]
fn row3_add_several_in_order() {
    let result = run(
        &sample(),
        json!([{"op":"add","path":p("p1"),"position":"after","value":[
            {"name":"core/paragraph","attributes":{"content":"A"}},
            {"name":"core/paragraph","attributes":{"content":"B"}},
            {"name":"core/paragraph","attributes":{"content":"C"}}
        ]}]),
    )
    .unwrap();
    assert_eq!(
        top_level(&result.page.blocks)[1..5],
        [id("p1"), new_id(1), new_id(2), new_id(3)]
    );
    assert_eq!(content(&result, new_id(3)), "C");
    assert_eq!(result.created[0].ids, vec![new_id(1), new_id(2), new_id(3)]);
}

#[test]
fn row4_label_addresses_new_block_later_in_call() {
    let result = run(
        &sample(),
        json!([
            {"op":"add","path":"","position":"end","value":{"label":"$box","name":"moocfi/infobox","innerBlocks":[]}},
            {"op":"add","path":"/$box/innerBlocks","position":"end","value":[{"name":"core/paragraph"},{"name":"core/paragraph"}]},
        ]),
    )
    .unwrap();
    let new_box = result.page.blocks.last().unwrap();
    assert_eq!(new_box.client_id, new_id(1));
    assert_eq!(top_level(&new_box.inner_blocks), vec![new_id(2), new_id(3)]);
    assert_eq!(result.labels.get("$box"), Some(&new_id(1)));
}

#[test]
fn row5_replace_block_keeps_id() {
    let result = run(
        &sample(),
        json!([{"op":"replace","path":p("p2"),"value":{"name":"core/paragraph","attributes":{"content":"Rewritten."}}}]),
    )
    .unwrap();
    assert_eq!(content(&result, id("p2")), "Rewritten.");
    assert!(result.created.is_empty());
}

#[test]
fn row5_replace_container_without_inner_blocks_is_rejected() {
    let error = run(
        &sample(),
        json!([{"op":"replace","path":p("box1"),"value":{"name":"moocfi/infobox"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::MissingField);
    assert!(error.fix.unwrap().contains(&id("c1").to_string()));
}

#[test]
fn row5_replace_with_array_points_to_add_and_remove() {
    let error = run(
        &sample(),
        json!([{"op":"replace","path":p("p2"),"value":[{"name":"core/paragraph"}]}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvalidValue);
    assert!(error.fix.unwrap().contains("remove"));
}

#[test]
fn row6_replace_one_block_with_several() {
    let result = run(
        &sample(),
        json!([
            {"op":"add","path":p("p2"),"position":"after","value":[{"name":"core/paragraph"},{"name":"core/list"}]},
            {"op":"remove","path":p("p2")},
        ]),
    )
    .unwrap();
    assert_eq!(
        top_level(&result.page.blocks)[1..4],
        [id("p1"), new_id(1), new_id(2)]
    );
}

#[test]
fn row7_remove_block_and_range() {
    let result = run(
        &sample(),
        json!([{"op":"remove","path":p("p1"),"through":p("box1")}, {"op":"remove","path":p("p3")}]),
    )
    .unwrap();
    assert_eq!(top_level(&result.page.blocks), vec![id("h1"), id("ex1")]);
}

#[test]
fn row7_using_a_removed_block_names_the_removing_op() {
    let error = run(
        &sample(),
        json!([{"op":"remove","path":p("box1")}, {"op":"remove","path":p("c1")}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::NotFound);
    assert!(error.message.contains("removed by op 0"));
    assert_eq!(error.op, Some(1));
}

#[test]
fn row8_move_block_and_range() {
    let result = run(
        &sample(),
        json!([
            {"op":"move","from":p("p3"),"path":p("h1"),"position":"after"},
            {"op":"move","from":p("p1"),"through":p("p2"),"path":p("ex1"),"position":"after"},
        ]),
    )
    .unwrap();
    assert_eq!(
        top_level(&result.page.blocks),
        vec![
            id("h1"),
            id("p3"),
            id("box1"),
            id("ex1"),
            id("p1"),
            id("p2")
        ]
    );
}

#[test]
fn row9_move_into_container() {
    let result = run(
        &sample(),
        json!([{"op":"move","from":p("p1"),"path":format!("{}/innerBlocks", p("box1")),"position":"end"}]),
    )
    .unwrap();
    let boxed = result
        .page
        .blocks
        .iter()
        .find(|b| b.client_id == id("box1"))
        .unwrap();
    assert_eq!(
        top_level(&boxed.inner_blocks),
        vec![id("c1"), id("c2"), id("p1")]
    );
}

#[test]
fn row10_move_range_to_another_page() {
    let other = page("pg2", PageType::CoursePage, vec![heading("h2", "Other")]);
    let result = run_with(
        &sample(),
        std::slice::from_ref(&other),
        json!([{"op":"move","from":p("p1"),"through":p("box1"),"to_page":id("pg2").to_string(),"path":p("h2"),"position":"after"}]),
    )
    .unwrap();
    assert_eq!(
        top_level(&result.page.blocks),
        vec![id("h1"), id("p3"), id("ex1")]
    );
    let target = &result.other_pages[0];
    assert_eq!(target.page_id, id("pg2"));
    assert_eq!(
        top_level(&target.blocks),
        vec![id("h2"), id("p1"), id("p2"), id("box1")]
    );
    let moved: Vec<Uuid> = result
        .moved_between_pages
        .iter()
        .map(|m| m.block_id)
        .collect();
    assert!(moved.contains(&id("c1")));
    assert!(
        result
            .moved_between_pages
            .iter()
            .all(|m| m.to_page == id("pg2"))
    );
}

#[test]
fn row10_exercise_moves_to_another_page_keeping_its_id() {
    let other = page("pg2", PageType::CoursePage, vec![]);
    let result = run_with(
        &sample(),
        std::slice::from_ref(&other),
        json!([{"op":"move","from":p("ex1"),"to_page":format!("/{}", id("pg2")),"path":"","position":"end"}]),
    )
    .unwrap();
    assert_eq!(
        result.other_pages[0].blocks[0],
        exercise("ex1", "exercise-1")
    );
    assert!(result.exercise_copies.is_empty());
}

#[test]
fn row10_unloaded_target_page_is_an_error() {
    let error = run(
        &sample(),
        json!([{"op":"move","from":p("p1"),"to_page":id("nope").to_string(),"path":"","position":"end"}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::PageNotLoaded);
}

#[test]
fn row11_copy_assigns_new_ids_and_label() {
    let result = run(
        &sample(),
        json!([
            {"op":"copy","from":p("box1"),"path":p("box1"),"position":"after","label":"$copy"},
            {"op":"replace","path":"/$copy/attributes/backgroundColor","value":"#fff"},
        ]),
    )
    .unwrap();
    let copy = &result.page.blocks[4];
    assert_eq!(copy.client_id, new_id(1));
    assert_eq!(top_level(&copy.inner_blocks), vec![new_id(2), new_id(3)]);
    assert_eq!(copy.attributes["backgroundColor"], json!("#fff"));
    assert_eq!(
        result.page.blocks[3],
        infobox(
            "box1",
            vec![para("c1", "Inside one."), para("c2", "Inside two.")]
        )
    );
}

#[test]
fn row11_copy_of_exercise_creates_a_new_exercise() {
    let other = page("pg2", PageType::CoursePage, vec![]);
    let result = run_with(
        &sample(),
        std::slice::from_ref(&other),
        json!([{"op":"copy","from":p("p3"),"through":p("ex1"),"to_page":id("pg2").to_string(),"path":"","position":"end"}]),
    )
    .unwrap();
    let copied_exercise = &result.other_pages[0].blocks[1];
    assert_eq!(copied_exercise.client_id, new_id(2));
    assert_eq!(
        copied_exercise.attributes["id"],
        json!(new_id(3).to_string())
    );
    assert_eq!(
        result.exercise_copies,
        vec![ExerciseCopy {
            source_exercise_id: id("exercise-1"),
            new_exercise_id: new_id(3),
            new_block_id: new_id(2),
            page_id: id("pg2")
        }]
    );
    assert!(
        result
            .warnings
            .iter()
            .any(|w| w.code == WarningCode::ExerciseCopied)
    );
    assert_eq!(result.page.blocks.len(), 6);
}

#[test]
fn row11_copy_exercise_to_top_level_page_is_rejected() {
    let other = page("top", PageType::TopLevelPage, vec![]);
    let error = run_with(
        &sample(),
        std::slice::from_ref(&other),
        json!([{"op":"copy","from":p("ex1"),"to_page":id("top").to_string(),"path":"","position":"end"}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvariantViolated);
    assert!(error.message.contains("outside chapters"));
}

#[test]
fn row12_set_attribute_at_any_depth() {
    let result = run(
        &sample(),
        json!([
            {"op":"replace","path":format!("{}/attributes/level", p("h1")),"value":3},
            {"op":"replace","path":format!("{}/attributes/content", p("p1")),"value":"Use <code>for</code> to <em>iterate</em>."},
            {"op":"replace","path":format!("{}/attributes/anchor", p("h1")),"value":"loops"},
        ]),
    )
    .unwrap();
    let h1 = &result.page.blocks[0];
    assert_eq!(h1.attributes["level"], json!(3));
    assert_eq!(h1.attributes["anchor"], json!("loops"));
    assert_eq!(
        content(&result, id("p1")),
        "Use <code>for</code> to <em>iterate</em>."
    );
}

#[test]
fn row12_array_indexes_allowed_inside_attributes() {
    let table = block(
        "t1",
        "core/table",
        json!({"body":[{"cells":[{"content":"a"}]}]}),
        vec![],
    );
    let doc = page("pg1", PageType::CoursePage, vec![table]);
    let result = run(
        &doc,
        json!([
            {"op":"replace","path":format!("{}/attributes/body/0/cells/0/content", p("t1")),"value":"b"},
            {"op":"add","path":format!("{}/attributes/body/-", p("t1")),"value":{"cells":[{"content":"c"}]}},
        ]),
    )
    .unwrap();
    assert_eq!(
        result.page.blocks[0].attributes["body"],
        json!([{"cells":[{"content":"b"}]},{"cells":[{"content":"c"}]}])
    );
}

#[test]
fn row13_remove_attribute() {
    let result = run(
        &sample(),
        json!([{"op":"remove","path":format!("{}/attributes/dropCap", p("p1"))}]),
    )
    .unwrap();
    assert!(!result.page.blocks[1].attributes.contains_key("dropCap"));
    let error = run(
        &sample(),
        json!([{"op":"remove","path":format!("{}/attributes/anchor", p("p1"))}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::NotFound);
}

#[test]
fn row14_change_block_type() {
    let result = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/name", p("p3")),"value":"core/heading"}]),
    )
    .unwrap();
    assert_eq!(result.page.blocks[4].name, "core/heading");
}

#[test]
fn row15_wrap_range() {
    let result = run(
        &sample(),
        json!([{"op":"wrap","path":p("p1"),"through":p("p2"),"value":{"name":"moocfi/infobox"},"label":"$w"}]),
    )
    .unwrap();
    let wrapper = &result.page.blocks[1];
    assert_eq!(wrapper.client_id, new_id(1));
    assert_eq!(wrapper.name, "moocfi/infobox");
    assert_eq!(top_level(&wrapper.inner_blocks), vec![id("p1"), id("p2")]);
    assert_eq!(result.labels["$w"], new_id(1));
}

#[test]
fn row15_wrapping_an_exercise_is_rejected() {
    let error = run(
        &sample(),
        json!([{"op":"wrap","path":p("p3"),"through":p("ex1"),"value":{"name":"moocfi/infobox"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvariantViolated);
}

#[test]
fn row16_unwrap_container() {
    let result = run(&sample(), json!([{"op":"unwrap","path":p("box1")}])).unwrap();
    assert_eq!(top_level(&result.page.blocks)[3..5], [id("c1"), id("c2")]);
    let error = run(&sample(), json!([{"op":"unwrap","path":p("p1")}])).unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvalidValue);
}

#[test]
fn row17_split_text_block() {
    let doc = page(
        "pg1",
        PageType::CoursePage,
        vec![para("p7", "Loops repeat. However, they can end.")],
    );
    let result = run(
        &doc,
        json!([{"op":"split","path":p("p7"),"at_text":"However,","label":"$rest"}]),
    )
    .unwrap();
    assert_eq!(content(&result, id("p7")), "Loops repeat.");
    assert_eq!(content(&result, new_id(1)), "However, they can end.");
    assert_eq!(result.page.blocks[1].attributes["dropCap"], json!(false));
    assert_eq!(result.labels["$rest"], new_id(1));
}

#[test]
fn row17_split_errors_teach() {
    let doc = page(
        "pg1",
        PageType::CoursePage,
        vec![
            para(
                "p7",
                "Use <em>for loops</em> and for loops. <a href=\"x\">link</a>",
            ),
            heading("h", "x"),
        ],
    );
    let ambiguous = run(
        &doc,
        json!([{"op":"split","path":p("p7"),"at_text":"for loops"}]),
    )
    .unwrap_err();
    assert_eq!(ambiguous.code, EditErrorCode::TextAmbiguous);
    let inside = run(
        &doc,
        json!([{"op":"split","path":p("p7"),"at_text":"loops</em>"}]),
    )
    .unwrap_err();
    assert_eq!(inside.code, EditErrorCode::SplitInsideMarkup);
    let missing = run(
        &doc,
        json!([{"op":"split","path":p("p7"),"at_text":"while"}]),
    )
    .unwrap_err();
    assert_eq!(missing.code, EditErrorCode::TextNotFound);
    let in_markup = run(
        &doc,
        json!([{"op":"split","path":p("p7"),"at_text":"Use for"}]),
    )
    .unwrap_err();
    assert!(in_markup.fix.unwrap().contains("markup"));
    let not_text = run(
        &sample(),
        json!([{"op":"split","path":p("box1"),"at_text":"x"}]),
    )
    .unwrap_err();
    assert_eq!(not_text.code, EditErrorCode::NotATextBlock);
}

#[test]
fn row18_merge_next_block_into_previous() {
    let result = run(
        &sample(),
        json!([{"op":"merge","from":p("p2"),"path":p("p1")}]),
    )
    .unwrap();
    assert_eq!(content(&result, id("p1")), "First. Second.");
    assert!(blocks::find_path(&result.page.blocks, id("p2")).is_none());
    let error = run(
        &sample(),
        json!([{"op":"merge","from":p("p3"),"path":p("p1")}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::MergeNotAdjacent);
    assert!(error.details.is_some());
}

#[test]
fn row19_replace_children_with_stubs_new_and_full_blocks() {
    let result = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/innerBlocks", p("box1")),"value":[
            {"clientId": id("c2").to_string()},
            {"name":"core/paragraph","attributes":{"content":"New"}},
            {"clientId": id("c1").to_string(), "name":"core/paragraph","attributes":{"content":"Changed"}},
        ]}]),
    )
    .unwrap();
    let boxed = &result.page.blocks[3];
    assert_eq!(
        top_level(&boxed.inner_blocks),
        vec![id("c2"), new_id(1), id("c1")]
    );
    assert_eq!(content(&result, id("c1")), "Changed");
    assert_eq!(content(&result, id("c2")), "Inside two.");
}

#[test]
fn row19_stub_from_elsewhere_on_page_moves_the_block() {
    let result = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/innerBlocks", p("box1")),"value":[
            {"clientId": id("c1").to_string()}, {"clientId": id("c2").to_string()}, {"clientId": id("p3").to_string()},
        ]}]),
    )
    .unwrap();
    assert_eq!(
        top_level(&result.page.blocks),
        vec![id("h1"), id("p1"), id("p2"), id("box1"), id("ex1")]
    );
    assert_eq!(
        top_level(&result.page.blocks[3].inner_blocks),
        vec![id("c1"), id("c2"), id("p3")]
    );
}

#[test]
fn row19_missing_and_unknown_ids_are_errors() {
    let missing = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/innerBlocks", p("box1")),"value":[{"clientId": id("c2").to_string()}]}]),
    )
    .unwrap_err();
    assert_eq!(missing.code, EditErrorCode::MissingIds);
    assert_eq!(
        missing.details.unwrap()["missing_ids"],
        json!([id("c1").to_string()])
    );

    let unknown = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/innerBlocks", p("box1")),"value":[
            {"clientId": id("c1").to_string()}, {"clientId": id("c2").to_string()}, {"clientId": id("ghost").to_string()}
        ]}]),
    )
    .unwrap_err();
    assert_eq!(unknown.code, EditErrorCode::UnknownIds);

    let duplicate = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/innerBlocks", p("box1")),"value":[
            {"clientId": id("c1").to_string()}, {"clientId": id("c1").to_string()}, {"clientId": id("c2").to_string()}
        ]}]),
    )
    .unwrap_err();
    assert_eq!(duplicate.code, EditErrorCode::DuplicateIds);
}

#[test]
fn row19_container_cannot_be_moved_into_itself_by_stub() {
    let error = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/innerBlocks", p("box1")),"value":[
            {"clientId": id("c1").to_string()}, {"clientId": id("c2").to_string()}, {"clientId": id("box1").to_string()}
        ]}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::MoveIntoItself);
}

#[test]
fn row20_replace_whole_page() {
    let doc = sample();
    let mut value: Vec<Value> = doc
        .blocks
        .iter()
        .rev()
        .map(|b| json!({"clientId": b.client_id.to_string()}))
        .collect();
    value.insert(
        0,
        json!({"name":"core/heading","attributes":{"content":"Intro"}}),
    );
    let result = run(&doc, json!([{"op":"replace","path":"","value":value}])).unwrap();
    assert_eq!(result.page.blocks[0].client_id, new_id(1));
    assert_eq!(result.page.blocks[1].client_id, id("ex1"));
    assert_eq!(result.page.blocks[6].client_id, id("h1"));
}

#[test]
fn row21_exercise_block_moves_but_is_not_replaced() {
    let moved = run(
        &sample(),
        json!([{"op":"move","from":p("ex1"),"path":"","position":"start"}]),
    )
    .unwrap();
    assert_eq!(moved.page.blocks[0].client_id, id("ex1"));

    for op in [
        json!({"op":"replace","path":p("ex1"),"value":{"name":"moocfi/exercise"}}),
        json!({"op":"replace","path":format!("{}/attributes/id", p("ex1")),"value":"x"}),
        json!({"op":"replace","path":format!("{}/name", p("ex1")),"value":"core/paragraph"}),
        json!({"op":"unwrap","path":p("ex1")}),
    ] {
        let error = run(&sample(), json!([op])).unwrap_err();
        assert_eq!(error.code, EditErrorCode::ExerciseReadOnly, "{op}");
        assert!(error.fix.unwrap().contains("remove"));
    }

    let created = run(
        &sample(),
        json!([{"op":"add","path":"","position":"end","value":{"name":"moocfi/exercise"}}]),
    )
    .unwrap_err();
    assert_eq!(created.code, EditErrorCode::ExerciseReadOnly);

    let nested = run(&sample(), json!([{"op":"move","from":p("ex1"),"path":format!("{}/innerBlocks", p("box1")),"position":"end"}])).unwrap_err();
    assert_eq!(nested.code, EditErrorCode::InvariantViolated);

    let full = run(
        &sample(),
        json!([{"op":"replace","path":"","value":[
            {"clientId": id("h1").to_string()}, {"clientId": id("p1").to_string()}, {"clientId": id("p2").to_string()},
            {"clientId": id("box1").to_string()}, {"clientId": id("p3").to_string()},
            {"clientId": id("ex1").to_string(), "attributes": {"id": "x"}},
        ]}]),
    )
    .unwrap_err();
    assert_eq!(full.code, EditErrorCode::ExerciseReadOnly);
}

#[test]
fn missing_position_lists_the_forms() {
    let error = run(
        &sample(),
        json!([{"op":"add","path":"","value":{"name":"core/paragraph"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::PositionRequired);
    assert!(error.fix.unwrap().contains("innerBlocks"));
}

#[test]
fn position_start_on_block_path_suggests_inner_blocks() {
    let error = run(
        &sample(),
        json!([{"op":"add","path":p("box1"),"position":"end","value":{"name":"core/paragraph"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::PositionNeedsChildren);
    assert!(
        error
            .fix
            .unwrap()
            .contains(&format!("{}/innerBlocks", p("box1")))
    );
}

#[test]
fn position_before_on_children_list_needs_a_sibling() {
    let error = run(
        &sample(),
        json!([{"op":"add","path":"","position":"after","value":{"name":"core/paragraph"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::PositionNeedsSibling);
    let error = run(
        &sample(),
        json!([{"op":"add","path":format!("{}/innerBlocks", p("box1")),"position":"before","value":{"name":"core/paragraph"}}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::PositionNeedsSibling);
}

#[test]
fn reversed_range_lists_siblings() {
    let error = run(
        &sample(),
        json!([{"op":"remove","path":p("p2"),"through":p("p1")}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvalidRange);
    assert!(error.message.contains("reversed"));
    let siblings = error.details.unwrap()["siblings_in_order"].clone();
    assert_eq!(siblings[1], json!(p("p1")));
}

#[test]
fn range_across_parents_lists_both_parents() {
    let error = run(
        &sample(),
        json!([{"op":"remove","path":p("p1"),"through":p("c2")}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvalidRange);
    assert!(error.message.contains("innerBlocks"));
}

#[test]
fn moving_into_itself_or_its_range_is_rejected() {
    let into_self = run(
        &sample(),
        json!([{"op":"move","from":p("box1"),"path":format!("{}/innerBlocks", p("box1")),"position":"end"}]),
    )
    .unwrap_err();
    assert_eq!(into_self.code, EditErrorCode::MoveIntoItself);
    let into_descendant = run(
        &sample(),
        json!([{"op":"move","from":p("box1"),"path":p("c1"),"position":"after"}]),
    )
    .unwrap_err();
    assert_eq!(into_descendant.code, EditErrorCode::MoveIntoItself);
    let into_range = run(
        &sample(),
        json!([{"op":"move","from":p("p1"),"through":p("p3"),"path":p("p2"),"position":"after"}]),
    )
    .unwrap_err();
    assert_eq!(into_range.code, EditErrorCode::MoveIntoItself);
}

#[test]
fn label_reuse_and_order_errors() {
    let reused = run(
        &sample(),
        json!([
            {"op":"add","path":"","position":"end","value":{"label":"$a","name":"core/paragraph"}},
            {"op":"add","path":"","position":"end","value":{"label":"$a","name":"core/paragraph"}},
        ]),
    )
    .unwrap_err();
    assert_eq!(reused.code, EditErrorCode::LabelReused);
    assert_eq!(reused.op, Some(1));
    let early = run(
        &sample(),
        json!([
            {"op":"remove","path":"/$a"},
            {"op":"add","path":"","position":"end","value":{"label":"$a","name":"core/paragraph"}},
        ]),
    )
    .unwrap_err();
    assert_eq!(early.code, EditErrorCode::LabelUndefined);
}

#[test]
fn numeric_indexes_name_the_current_id() {
    let error = run(
        &sample(),
        json!([{"op":"remove","path":format!("{}/innerBlocks/1", p("box1"))}]),
    )
    .unwrap_err();
    assert_eq!(error.code, EditErrorCode::NumericIndex);
    assert!(error.message.contains(&id("c2").to_string()));
    let top = run(&sample(), json!([{"op":"remove","path":"/0"}])).unwrap_err();
    assert!(top.message.contains(&id("h1").to_string()));
    let dash = run(&sample(), json!([{"op":"add","path":format!("{}/innerBlocks/-", p("box1")),"position":"end","value":{}}])).unwrap_err();
    assert_eq!(dash.code, EditErrorCode::NumericIndex);
}

#[test]
fn client_id_on_new_block_is_replaced_with_warning() {
    let result = run(
        &sample(),
        json!([{"op":"add","path":"","position":"end","value":{"clientId": id("p1").to_string(),"name":"core/paragraph"}}]),
    )
    .unwrap();
    assert_eq!(result.page.blocks.last().unwrap().client_id, new_id(1));
    assert_eq!(result.warnings[0].code, WarningCode::IgnoredClientId);
}

#[test]
fn unknown_block_fields_and_bad_paths_teach() {
    let error = run(&sample(), json!([{"op":"add","path":"","position":"end","value":{"name":"core/paragraph","content":"x"}}])).unwrap_err();
    assert_eq!(error.code, EditErrorCode::UnknownField);
    assert!(error.fix.unwrap().contains("attributes"));
    let error = run(&sample(), json!([{"op":"remove","path":"p1"}])).unwrap_err();
    assert_eq!(error.code, EditErrorCode::InvalidPath);
    let error = run(
        &sample(),
        json!([{"op":"replace","path":format!("{}/content", p("p1")),"value":"x"}]),
    )
    .unwrap_err();
    assert!(error.fix.unwrap().ends_with("/attributes/content"));
}

#[test]
fn whole_call_fails_atomically() {
    let doc = sample();
    let before = doc.clone();
    let error = run(
        &doc,
        json!([{"op":"remove","path":p("p1")}, {"op":"remove","path":p("ghost")}]),
    )
    .unwrap_err();
    assert_eq!(error.op, Some(1));
    assert_eq!(doc, before);
}

#[test]
fn read_back_label_paths_resolve() {
    let labels = BTreeMap::from([("$box".to_string(), id("box1"))]);
    assert_eq!(
        resolve_label_path("/$box/innerBlocks", &labels).unwrap(),
        format!("{}/innerBlocks", p("box1"))
    );
    assert_eq!(resolve_label_path(&p("p1"), &labels).unwrap(), p("p1"));
    assert!(resolve_label_path("/$nope", &labels).is_err());
}
