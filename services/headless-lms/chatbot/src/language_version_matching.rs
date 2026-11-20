//! AI-suggested counterparts between the language versions of a course, from page titles,
//! exercise names and content excerpts.

use std::fmt::Write;

use futures::StreamExt;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_configurations::ReasoningEffortLevel,
    chatbot_conversation_message_messages::MessageRole,
    library::language_versions::{
        ai_matching::{
            AiKnownPair, AiMatchingAnswer, AiMatchingItem, AiMatchingTask, AiPicksByCourse,
        },
        types::SuggestionSureness,
    },
};
use headless_lms_utils::json_schema_types::{
    ArrayItem, ArrayProperty, JSONType, JsonItem, Schema, SchemaPropertyType,
    nullable_string_property,
};
use indexmap::IndexMap;
use tokio::time::{Duration, Instant};

use crate::{
    azure_chatbot::azure::protocol::{
        InputItem, LLMRequestParams, LLMRequestResponseFormatParam, NonThinkingParams, Reasoning,
        ThinkingParams,
    },
    llm_utils::{APIInputMessage, MessageContent, model_is_thinking, request_structured_json},
    prelude::*,
};

/// Names this feature's structured output to Azure. The test-mode mock Azure API picks its canned
/// answer for this feature by this name.
pub const RESPONSE_FORMAT_NAME: &str = "LanguageVersionMatchingResponse";

/// Headings and line prefixes of the prompt, which lists items as `- id: <uuid> "title"`.
/// The test-mode mock Azure API reads the heuristic's picks back out of the prompt by these.
pub const THIS_PAGES_HEADING: &str = "## Pages of course A";
pub const OTHER_PAGES_HEADING: &str = "## Pages of course B";
pub const THIS_EXERCISES_HEADING: &str = "## Exercises of course A";
pub const OTHER_EXERCISES_HEADING: &str = "## Exercises of course B";
pub const HEURISTIC_PICK_PREFIX: &str = "Position heuristic suggests: ";
/// How the prompt names [SuggestionSureness::VerySure] after a heuristic pick.
pub const VERY_SURE_LABEL: &str = "very sure";
pub const ITEM_ID_PREFIX: &str = "- id: ";

/// Requests in flight at once; one per chapter and other course.
const MAX_CONCURRENT_REQUESTS: usize = 8;
/// Every request must finish by then; the ingress for this endpoint allows 300 s.
const DEADLINE: Duration = Duration::from_secs(150);

const SYSTEM_PROMPT: &str = r#"You match the pages and exercises of two language versions of the same online course: course A and its translation, course B. You get one chapter at a time, or the pages outside chapters.

For each page of course A, pick the page of course B that is its translation. Do the same for the exercises. Base the decision on what the titles, names and text excerpts mean, not on their order or position: translations are often reordered, and some pages or exercises exist in only one language (for example review quizzes or feedback surveys added to one version only). When nothing in course B corresponds, answer null as the counterpart.

Answer every item of course A by copying its id exactly; the counterpart is the exact id of an item of the same kind in course B, or null.

Rules:
- Answer every page and exercise of course A exactly once.
- Each page or exercise of course B can be the counterpart of at most one item of course A.
- Pages match only pages and exercises only exercises.
- An exercise's counterpart is usually on the counterpart of its page, but not always.
- "Known pairs" are already linked; they show how the courses correspond, and their items are not listed for matching.
- Some items come with the suggestion of a position heuristic. It only compares positions and exercise counts, so it is imprecise and often wrong when the versions differ. Treat it as a weak hint and overrule it whenever the titles or texts say otherwise.

Example (made-up course, by title; your answer uses the ids):
Pages of course A: "Silmukat", "Ehtolauseet", "Kertaus", "Palautekysely"
Pages of course B: "Conditional statements", "Loops", "Feedback survey"
Matches: "Silmukat" -> "Loops" and "Ehtolauseet" -> "Conditional statements" (the order differs, the meaning matches); "Kertaus" -> null (a review quiz that course B does not have); "Palautekysely" -> "Feedback survey".
Names can differ in wording too: "Kertaus" means "Review", and "Tehtävä: summa" can be the counterpart of "Exercise: Sum of numbers"."#;

/// The structured output the matching request answers in; mirrors [AiMatchingAnswer].
fn response_format() -> LLMRequestResponseFormatParam {
    let picks = |description: &str| {
        SchemaPropertyType::ArrayProperty(ArrayProperty {
            type_field: JSONType::Array,
            items: ArrayItem::Schema(Schema::strict_object(
                IndexMap::from([
                    (
                        "item".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("Id of the item in course A.".to_string()),
                        }),
                    ),
                    (
                        "counterpart".to_string(),
                        nullable_string_property(Some(
                            "Id of its counterpart in course B, or null for none.",
                        )),
                    ),
                ]),
                None,
            )),
            description: Some(description.to_string()),
        })
    };
    LLMRequestResponseFormatParam::JsonSchema {
        name: RESPONSE_FORMAT_NAME.to_string(),
        schema: Schema::strict_object(
            IndexMap::from([
                (
                    "pages".to_string(),
                    picks("One entry per page of course A."),
                ),
                (
                    "exercises".to_string(),
                    picks("One entry per exercise of course A."),
                ),
            ]),
            None,
        ),
        strict: true,
    }
}

fn sureness_label(sureness: SuggestionSureness) -> &'static str {
    match sureness {
        SuggestionSureness::VerySure => VERY_SURE_LABEL,
        SuggestionSureness::Likely => "likely",
        SuggestionSureness::Unsure | SuggestionSureness::AiSuggestion => "unsure",
    }
}

fn write_items(prompt: &mut String, heading: &str, items: &[AiMatchingItem]) {
    let _ = writeln!(prompt, "\n{heading}");
    if items.is_empty() {
        let _ = writeln!(prompt, "(none)");
    }
    for item in items {
        let _ = write!(prompt, "{ITEM_ID_PREFIX}{} \"{}\"", item.id, item.title);
        if let Some(page_title) = &item.page_title {
            let _ = write!(prompt, " on page \"{page_title}\"");
        }
        let _ = writeln!(prompt);
        if !item.excerpt.is_empty() {
            let _ = writeln!(prompt, "  Text: {}", item.excerpt);
        }
        if let Some((id, sureness)) = item.heuristic_pick {
            let _ = writeln!(
                prompt,
                "  {HEURISTIC_PICK_PREFIX}{id} ({})",
                sureness_label(sureness)
            );
        }
    }
}

fn write_known_pairs(prompt: &mut String, kind: &str, pairs: &[AiKnownPair]) {
    if pairs.is_empty() {
        return;
    }
    let _ = writeln!(prompt, "\nKnown pairs of {kind} (A = B):");
    for pair in pairs {
        let _ = writeln!(
            prompt,
            "- \"{}\" = \"{}\"",
            pair.this_title, pair.other_title
        );
    }
}

fn user_prompt(task: &AiMatchingTask) -> String {
    let chapter = |name: &Option<String>| match (task.chapter_number, name) {
        (Some(number), Some(name)) => format!("chapter {number} \"{name}\""),
        (Some(number), None) => format!("chapter {number}"),
        (None, _) => "pages outside chapters".to_string(),
    };
    let mut prompt = format!(
        "Course A is in language \"{}\", {}. Course B is in language \"{}\", {}.\n",
        task.this_language_code,
        chapter(&task.this_chapter_name),
        task.other_language_code,
        chapter(&task.other_chapter_name),
    );
    write_known_pairs(&mut prompt, "pages", &task.known_page_pairs);
    write_known_pairs(&mut prompt, "exercises", &task.known_exercise_pairs);
    write_items(&mut prompt, THIS_PAGES_HEADING, &task.this_pages);
    write_items(&mut prompt, OTHER_PAGES_HEADING, &task.other_pages);
    write_items(&mut prompt, THIS_EXERCISES_HEADING, &task.this_exercises);
    write_items(&mut prompt, OTHER_EXERCISES_HEADING, &task.other_exercises);
    prompt
}

async fn request_matching(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    task: &AiMatchingTask,
) -> ChatbotResult<AiMatchingAnswer> {
    let input = vec![
        APIInputMessage {
            message_type: InputItem::Message {
                role: MessageRole::System,
                content: MessageContent::Text(SYSTEM_PROMPT.to_string()),
            },
        },
        APIInputMessage {
            message_type: InputItem::Message {
                role: MessageRole::User,
                content: MessageContent::Text(user_prompt(task)),
            },
        },
    ];
    let (params, max_output_tokens) = if model_is_thinking(task_lm.model_type) {
        (
            LLMRequestParams::GPTThinking(ThinkingParams {
                reasoning: Some(Reasoning {
                    effort: ReasoningEffortLevel::Low,
                    summary: None,
                    context: None,
                }),
            }),
            Some(16000),
        )
    } else {
        (
            LLMRequestParams::GPTNonThinking(NonThinkingParams {
                temperature: None,
                top_p: None,
                frequency_penalty: None,
                presence_penalty: None,
            }),
            Some(8000),
        )
    };
    request_structured_json(
        input,
        task_lm.model.to_owned(),
        params,
        max_output_tokens,
        response_format(),
        app_config,
        || {
            chatbot_err!(
                FailedAzureResponse,
                "Invalidly structured response from Azure"
            )
        },
    )
    .await
}

/// The AI's counterpart picks for `tasks`, and how many tasks got no usable answer (failed or
/// missed the deadline). Never fails as a whole: a failed task leaves its items to the heuristic.
pub async fn suggest_counterparts(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    tasks: &[AiMatchingTask],
) -> (AiPicksByCourse, usize) {
    let deadline = Instant::now() + DEADLINE;
    let answers: Vec<(&AiMatchingTask, Option<AiMatchingAnswer>)> = futures::stream::iter(tasks)
        .map(|task| async move {
            let answer = match tokio::time::timeout_at(
                deadline,
                request_matching(app_config, task_lm, task),
            )
            .await
            {
                Ok(Ok(answer)) => Some(answer),
                Ok(Err(e)) => {
                    warn!("Language version matching request failed: {e}");
                    None
                }
                Err(_) => {
                    warn!("Language version matching request missed the deadline");
                    None
                }
            };
            (task, answer)
        })
        .buffer_unordered(MAX_CONCURRENT_REQUESTS)
        .collect()
        .await;
    let mut picks = AiPicksByCourse::new();
    let mut failed_count = 0;
    for (task, answer) in answers {
        let Some(answer) = answer else {
            failed_count += 1;
            continue;
        };
        let dropped = picks
            .entry(task.other_course_id)
            .or_default()
            .add_answer(task, &answer);
        if dropped.total() > 0 {
            warn!(
                other_course_id = %task.other_course_id,
                chapter_number = ?task.chapter_number,
                unknown_items = dropped.unknown_items,
                unknown_counterparts = dropped.unknown_counterparts,
                duplicates = dropped.duplicates,
                "Dropped invalid picks from a language version matching answer"
            );
        }
    }
    (picks, failed_count)
}
