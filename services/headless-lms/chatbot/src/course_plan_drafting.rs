//! AI drafts of the texts a course created from a course design plan starts with: one request for
//! the course-level texts and one per planned chapter.

use std::fmt::Write;

use futures::{StreamExt, TryStreamExt};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_configurations::ReasoningEffortLevel,
    chatbot_conversation_message_messages::MessageRole,
    course_designer_stage_workspace::DesignChapter,
    library::course_designer::{
        ChapterDraft, CourseDraft, CourseFromPlanDrafts, CourseFromPlanSource, chapter_topic_titles,
    },
};
use headless_lms_utils::{
    json_schema_types::{
        ArrayItem, ArrayProperty, JSONType, JsonItem, Schema, SchemaPropertyType,
        string_array_property,
    },
    strings::non_empty_trimmed,
};
use indexmap::IndexMap;
use serde::de::DeserializeOwned;
use tokio::time::Duration;

use crate::{
    azure_chatbot::azure::protocol::{
        InputItem, LLMRequestParams, LLMRequestResponseFormatParam, NonThinkingParams, Reasoning,
        ThinkingParams,
    },
    llm_utils::{APIInputMessage, MessageContent, model_is_thinking, request_structured_json},
    prelude::*,
};

/// Name the course-level structured output goes by; the test-mode mock Azure API answers by it.
pub const COURSE_RESPONSE_FORMAT_NAME: &str = "CoursePlanCourseDraft";
/// Name the per-chapter structured output goes by; the test-mode mock Azure API answers by it.
pub const CHAPTER_RESPONSE_FORMAT_NAME: &str = "CoursePlanChapterDraft";
/// Introduces the learning goals in the course-level prompt, one [`LIST_ITEM_PREFIX`] line each.
/// The test-mode mock Azure API counts them to answer with as many headings.
pub const LEARNING_GOALS_HEADING: &str = "## Course learning goals";
/// Introduces the chapter's topics in the per-chapter prompt, one [`LIST_ITEM_PREFIX`] line each.
/// The test-mode mock Azure API counts them to answer with as many outlines.
pub const TOPICS_HEADING: &str = "## Topics of this chapter";
pub const LIST_ITEM_PREFIX: &str = "- ";
/// Ends the sections that [`LEARNING_GOALS_HEADING`] and [`TOPICS_HEADING`] start.
pub const SECTION_END: &str = "\n## ";

const MAX_CONCURRENT_REQUESTS: usize = 8;
/// The teacher waits in the dialog, and the endpoint's ingress allows 300 s.
const DEADLINE: Duration = Duration::from_secs(150);
const ATTEMPTS_PER_REQUEST: usize = 2;

const COMMON_RULES: &str = r#"You help a university teacher turn a course design plan into a first draft of an online course (MOOC). The teacher edits everything you write before students see it.

Rules:
- Write in the language whose code is given as "Course language", whatever language the plan is written in.
- Use only what the plan says. Do not invent facts, numbers, names, dates, sources or claims about the course.
- Follow the plan's writing style and terminology when it gives them.
- Plain text only: no Markdown, no HTML."#;

const COURSE_INSTRUCTIONS: &str = r#"Draft the course-level texts:
- description: 2 to 3 sentences for the course catalog on what the course teaches and for whom.
- hero_subtitle: one short sentence under the course name on the front page.
- about_text: one paragraph for the "About this course" section of the front page.
- learning_goal_headings: one short heading (at most 6 words) per course learning goal, in the order listed, summarising that goal.
- how_to_study_paragraphs: 1 to 3 short paragraphs for the "How to study this course" page: how the course is organised into chapters and pages, the planned content formats and exercises, and that students can study at their own pace when the plan says the course is asynchronous. Do not mention workload numbers; they are listed separately."#;

const CHATBOT_INSTRUCTIONS: &str = r#"- chatbot: the course plans an AI chatbot. Give it a short name, a system prompt that keeps it a helpful study companion for this course's topics and learning goals without doing students' exercises for them, a short first message to students, and 3 to 4 short example messages a student could send first."#;

const CHAPTER_INSTRUCTIONS: &str = r#"Draft texts for one chapter of the course:
- prior_learning_heading: a short heading for a box on the chapter's introduction page that activates what students already know about the chapter's topics.
- prior_learning_questions: 2 to 3 short reflection questions for that box. They are not graded.
- topic_outlines: one outline per topic of this chapter, in the order listed. Each outline has 2 to 5 sections, each with a short heading for a part of the topic's page and 1 to 4 short points on what that part should cover. Points name what to cover; they are notes for the teacher, not finished sentences for students. Keep within the chapter's learning objectives and the topic; do not repeat other topics."#;

/// Drafts every text of a course from `source`. Fails as a whole when any request fails twice or
/// the deadline passes, so a course is never created from partial drafts.
pub async fn draft_course_from_plan(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    source: &CourseFromPlanSource,
) -> ChatbotResult<CourseFromPlanDrafts> {
    let plan_text = plan_text(source);
    let drafting = async {
        let course = draft_course(app_config, task_lm, source, &plan_text);
        let chapters = futures::stream::iter(&source.design.chapters)
            .map(|chapter| draft_chapter(app_config, task_lm, &plan_text, chapter))
            .buffered(MAX_CONCURRENT_REQUESTS - 1)
            .try_collect::<Vec<_>>();
        futures::future::try_join(course, chapters).await
    };
    let (course, chapters) = tokio::time::timeout(DEADLINE, drafting)
        .await
        .map_err(|_| {
            chatbot_err!(
                FailedAzureResponse,
                "Drafting the course with AI took too long.".to_string()
            )
        })??;
    Ok(CourseFromPlanDrafts { course, chapters })
}

async fn draft_course(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    source: &CourseFromPlanSource,
    plan_text: &str,
) -> ChatbotResult<CourseDraft> {
    let has_chatbot = source.has_planned_chatbot();
    let mut instructions = COURSE_INSTRUCTIONS.to_string();
    if has_chatbot {
        let _ = write!(instructions, "\n{CHATBOT_INSTRUCTIONS}");
    }
    let goal_count = source.learning_goals().len();
    request_with_retry(
        app_config,
        task_lm,
        &instructions,
        plan_text,
        course_format(has_chatbot),
        |draft: &CourseDraft| {
            if draft.learning_goal_headings.len() != goal_count {
                return Err(format!(
                    "Expected {goal_count} learning goal headings, got {}.",
                    draft.learning_goal_headings.len()
                ));
            }
            if has_chatbot && draft.chatbot.is_none() {
                return Err("The chatbot draft is missing.".to_string());
            }
            Ok(())
        },
    )
    .await
}

async fn draft_chapter(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    plan_text: &str,
    chapter: &DesignChapter,
) -> ChatbotResult<ChapterDraft> {
    let topics = chapter_topic_titles(chapter);
    let mut prompt = format!(
        "{plan_text}\n## This chapter\nTitle: {}\nLearning objectives:\n",
        chapter.title.trim()
    );
    for objective in chapter
        .learning_objectives
        .iter()
        .filter_map(|o| non_empty_trimmed(o))
    {
        let _ = writeln!(prompt, "{LIST_ITEM_PREFIX}{objective}");
    }
    let _ = writeln!(prompt, "\n{TOPICS_HEADING}");
    for topic in &topics {
        let _ = writeln!(prompt, "{LIST_ITEM_PREFIX}{topic}");
    }
    request_with_retry(
        app_config,
        task_lm,
        CHAPTER_INSTRUCTIONS,
        &prompt,
        chapter_format(),
        |draft: &ChapterDraft| {
            if draft.topic_outlines.len() == topics.len() {
                Ok(())
            } else {
                Err(format!(
                    "Expected {} topic outlines, got {}.",
                    topics.len(),
                    draft.topic_outlines.len()
                ))
            }
        },
    )
    .await
}

/// Sends the request up to [`ATTEMPTS_PER_REQUEST`] times, until an answer parses as `T` and
/// passes `validate`.
async fn request_with_retry<T: DeserializeOwned>(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    instructions: &str,
    prompt: &str,
    format: LLMRequestResponseFormatParam,
    validate: impl Fn(&T) -> Result<(), String>,
) -> ChatbotResult<T> {
    let mut last_error = None;
    for _ in 0..ATTEMPTS_PER_REQUEST {
        let answer: ChatbotResult<T> =
            request(app_config, task_lm, instructions, prompt, format.clone()).await;
        match answer {
            Ok(answer) => match validate(&answer) {
                Ok(()) => return Ok(answer),
                Err(message) => {
                    warn!("Course plan drafting answer was invalid: {message}");
                    last_error = Some(chatbot_err!(FailedAzureResponse, message));
                }
            },
            Err(e) => {
                warn!("Course plan drafting request failed: {e}");
                last_error = Some(e);
            }
        }
    }
    Err(last_error.unwrap_or_else(|| {
        chatbot_err!(
            FailedAzureResponse,
            "Course plan drafting made no request.".to_string()
        )
    }))
}

async fn request<T: DeserializeOwned>(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    instructions: &str,
    prompt: &str,
    format: LLMRequestResponseFormatParam,
) -> ChatbotResult<T> {
    let input = vec![
        APIInputMessage {
            message_type: InputItem::Message {
                role: MessageRole::System,
                content: MessageContent::Text(format!("{COMMON_RULES}\n\n{instructions}")),
            },
        },
        APIInputMessage {
            message_type: InputItem::Message {
                role: MessageRole::User,
                content: MessageContent::Text(prompt.to_string()),
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
        format,
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

/// The plan as the prompts present it. Blank fields are left out.
fn plan_text(source: &CourseFromPlanSource) -> String {
    let analysis = &source.analysis;
    let design = &source.design;
    let style = &design.style_guide;
    let mut text = String::new();
    let mut field = |label: &str, value: Option<&str>| {
        if let Some(value) = value.and_then(non_empty_trimmed) {
            let _ = writeln!(text, "{label}: {value}");
        }
    };
    field("Course name", Some(&source.course_name));
    field("Course language", Some(&source.language_code));
    field("Target group", analysis.target_group.as_deref());
    field(
        "Students' background",
        analysis.students_demographic_data.as_deref(),
    );
    field(
        "Topics students wished for",
        analysis.wishes_topics.as_deref(),
    );
    field(
        "The team's vision for the course",
        source.great_mooc_vision.as_deref(),
    );
    field("Must-know content", Some(&design.core_content_must_know));
    field(
        "Should-know content",
        Some(&design.core_content_should_know),
    );
    field(
        "Nice-to-know content",
        Some(&design.core_content_nice_to_know),
    );
    field("Exercise plan", Some(&design.exercise_notes));
    field("Writing style", Some(&style.writing_style));
    field("Active or passive voice", Some(&style.active_passive_voice));
    field(
        "Terminology and acronyms",
        Some(&style.terminology_and_acronyms),
    );
    let formats = &design.planned_content_formats;
    let planned_formats: Vec<&str> = [
        (formats.text, "text"),
        (formats.infographics, "infographics"),
        (formats.photos, "photos"),
        (formats.videos, "videos"),
        (formats.podcast, "podcasts"),
        (formats.thinglink, "ThingLink"),
        (formats.simulations, "simulations"),
        (formats.chatbots, "AI chatbot"),
    ]
    .into_iter()
    .filter_map(|(is_planned, name)| is_planned.then_some(name))
    .collect();
    if !planned_formats.is_empty() {
        let _ = writeln!(
            text,
            "Planned content formats: {}",
            planned_formats.join(", ")
        );
    }
    let study_modes: Vec<&str> = [
        (analysis.mode_synchronous, "synchronous"),
        (analysis.mode_asynchronous, "asynchronous"),
    ]
    .into_iter()
    .filter_map(|(is_planned, name)| is_planned.then_some(name))
    .collect();
    if !study_modes.is_empty() {
        let _ = writeln!(text, "Study mode: {}", study_modes.join(", "));
    }

    let _ = writeln!(text, "\n{LEARNING_GOALS_HEADING}");
    for goal in source.learning_goals() {
        let _ = writeln!(text, "{LIST_ITEM_PREFIX}{goal}");
    }
    let _ = writeln!(text, "\n## Chapters");
    for (index, chapter) in design.chapters.iter().enumerate() {
        let _ = writeln!(text, "{}. {}", index + 1, chapter.title.trim());
        let topics = chapter_topic_titles(chapter);
        if !topics.is_empty() {
            let _ = writeln!(text, "   Topics: {}", topics.join("; "));
        }
    }
    text
}

fn string_property(description: &str) -> SchemaPropertyType {
    SchemaPropertyType::Item(JsonItem {
        type_field: JSONType::String,
        description: Some(description.to_string()),
    })
}

/// Mirrors [`CourseDraft`]; `chatbot` is asked for only when the course plans one.
fn course_format(has_chatbot: bool) -> LLMRequestResponseFormatParam {
    let mut properties = IndexMap::from([
        (
            "description".to_string(),
            string_property("Catalog description."),
        ),
        (
            "hero_subtitle".to_string(),
            string_property("Front page subtitle."),
        ),
        (
            "about_text".to_string(),
            string_property("About this course paragraph."),
        ),
        (
            "learning_goal_headings".to_string(),
            string_array_property(Some("One heading per learning goal, in order.")),
        ),
        (
            "how_to_study_paragraphs".to_string(),
            string_array_property(Some("Paragraphs of the How to study page.")),
        ),
    ]);
    if has_chatbot {
        properties.insert(
            "chatbot".to_string(),
            SchemaPropertyType::Object(Schema::strict_object(
                IndexMap::from([
                    ("name".to_string(), string_property("Chatbot name.")),
                    (
                        "prompt".to_string(),
                        string_property("Chatbot system prompt."),
                    ),
                    (
                        "initial_message".to_string(),
                        string_property("First message to students."),
                    ),
                    (
                        "suggested_messages".to_string(),
                        string_array_property(Some("Example first messages from a student.")),
                    ),
                ]),
                None,
            )),
        );
    }
    LLMRequestResponseFormatParam::JsonSchema {
        name: COURSE_RESPONSE_FORMAT_NAME.to_string(),
        schema: Schema::strict_object(properties, None),
        strict: true,
    }
}

/// Mirrors [`ChapterDraft`].
fn chapter_format() -> LLMRequestResponseFormatParam {
    let section = Schema::strict_object(
        IndexMap::from([
            ("heading".to_string(), string_property("Section heading.")),
            (
                "points".to_string(),
                string_array_property(Some("What the section should cover.")),
            ),
        ]),
        None,
    );
    let outline = Schema::strict_object(
        IndexMap::from([(
            "sections".to_string(),
            SchemaPropertyType::ArrayProperty(ArrayProperty {
                type_field: JSONType::Array,
                items: ArrayItem::Schema(section),
                description: None,
            }),
        )]),
        None,
    );
    LLMRequestResponseFormatParam::JsonSchema {
        name: CHAPTER_RESPONSE_FORMAT_NAME.to_string(),
        schema: Schema::strict_object(
            IndexMap::from([
                (
                    "prior_learning_heading".to_string(),
                    string_property("Heading of the prior learning box."),
                ),
                (
                    "prior_learning_questions".to_string(),
                    string_array_property(Some("Reflection questions.")),
                ),
                (
                    "topic_outlines".to_string(),
                    SchemaPropertyType::ArrayProperty(ArrayProperty {
                        type_field: JSONType::Array,
                        items: ArrayItem::Schema(outline),
                        description: Some("One outline per topic, in order.".to_string()),
                    }),
                ),
            ]),
            None,
        ),
        strict: true,
    }
}
