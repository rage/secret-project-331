use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, JSONSchema, JSONType, LLMRequest, LLMRequestParams,
        LLMRequestResponseFormatParam, NonThinkingParams, Schema, ThinkingParams,
    },
    content_cleaner::calculate_safe_token_limit,
    llm_utils::{
        APIMessage, APIMessageKind, APIMessageText, estimate_tokens, make_blocking_llm_request,
        parse_text_completion,
    },
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_models::application_task_default_language_models::TaskLMSpec;
use headless_lms_models::chatbot_conversation_messages::MessageRole;
use headless_lms_models::cms_ai::ParagraphSuggestionAction;
use headless_lms_utils::{ApplicationConfiguration, prelude::BackendError};

/// Structured LLM response for CMS paragraph suggestions.
#[derive(serde::Deserialize)]
struct CmsParagraphSuggestionResponse {
    suggestions: Vec<String>,
}

/// Returns a short human-readable instruction for the given action id. Used so the model
/// sees a precise operation description instead of an opaque id, and so we can stress
/// "only this, nothing else" per action.
fn action_instruction(action: ParagraphSuggestionAction) -> String {
    let s = match action {
        ParagraphSuggestionAction::GenerateDraftFromNotes => {
            "Write a coherent draft paragraph using only the ideas present in the notes. Fill in connective wording as needed, but do not invent facts, examples, or claims not supported by the notes."
        }
        ParagraphSuggestionAction::GenerateContinueParagraph => {
            "Append 1-3 new sentences that continue the paragraph's current idea and tone. Keep the existing paragraph text verbatim, and do not rewrite, reorder, or delete any existing words."
        }
        ParagraphSuggestionAction::GenerateAddExample => {
            "Append one concise example that directly supports the paragraph's main point. Keep the existing text unchanged, and do not introduce unrelated facts or a new topic."
        }
        ParagraphSuggestionAction::GenerateAddCounterpoint => {
            "Append one concise, relevant counterpoint or limitation that stays in scope with the paragraph's topic. Keep the existing text unchanged, and do not drift into a different topic."
        }
        ParagraphSuggestionAction::GenerateAddConcludingSentence => {
            "Append exactly one concluding sentence that reinforces the paragraph's main point. Do not introduce new claims, and keep the existing text unchanged."
        }
        ParagraphSuggestionAction::FixSpelling => {
            "Correct spelling, grammar, punctuation, and obvious typos only. Do not change meaning, tone, structure, or phrasing beyond what is required for correctness."
        }
        ParagraphSuggestionAction::ImproveClarity => {
            "Improve clarity and readability with minimal rewrites. Preserve meaning and tone, and do not add new ideas, remove important details, or change the overall message."
        }
        ParagraphSuggestionAction::ImproveFlow => {
            "Improve flow by refining transitions and, if needed, lightly reordering sentences for smoother reading. Preserve all original claims and details, and do not add new content or change the tone."
        }
        ParagraphSuggestionAction::ImproveConcise => {
            "Make the paragraph more concise by removing redundancy and tightening phrasing. Preserve meaning and tone, and do not remove important details or add new ideas."
        }
        ParagraphSuggestionAction::ImproveExpandDetail => {
            "Expand the paragraph with specific, on-topic supporting detail that deepens existing ideas. Preserve the original claims and tone, and do not add unrelated content or change the topic."
        }
        ParagraphSuggestionAction::ImproveAcademicStyle => {
            "Strengthen the academic style by making the wording more precise, formal, and discipline-appropriate. Preserve meaning and evidence level, and do not add or remove content beyond stylistic refinement."
        }
        ParagraphSuggestionAction::StructureCreateTopicSentence => {
            "Add or refine a topic sentence that clearly introduces the paragraph's main idea. Do not rewrite unrelated parts of the paragraph beyond minimal adjustments needed to fit the topic sentence."
        }
        ParagraphSuggestionAction::StructureReorderSentences => {
            "Reorder the existing sentences to improve logical progression. Do not add, remove, split, combine, or materially rewrite sentence content."
        }
        ParagraphSuggestionAction::StructureSplitIntoParagraphs => {
            "Split the content into multiple paragraphs at appropriate break points. Preserve wording and order, and do not add, remove, or rewrite content beyond paragraph breaks."
        }
        ParagraphSuggestionAction::StructureCombineIntoOne => {
            "Combine the content into a single well-formed paragraph. Preserve wording and order, and do not add, remove, or rewrite content beyond joining the paragraphs."
        }
        ParagraphSuggestionAction::StructureToBullets => {
            "Convert the content into bullet points while preserving the original information and order. Do not add, remove, or materially rewrite content beyond the format change."
        }
        ParagraphSuggestionAction::StructureFromBullets => {
            "Convert the bullet points into prose while preserving the original information and order. Do not add, remove, or materially rewrite content beyond the format change."
        }
        ParagraphSuggestionAction::LearningSimplifyBeginners => {
            "Simplify the explanation for beginners using clearer language and less assumed prior knowledge. Preserve factual accuracy, and do not add new concepts, tangents, or unrelated examples."
        }
        ParagraphSuggestionAction::LearningAddDefinitions => {
            "Add brief inline definitions for technical or unfamiliar terms at their first relevant mention. Keep the existing explanation intact, and do not rewrite unrelated parts of the paragraph."
        }
        ParagraphSuggestionAction::LearningAddAnalogy => {
            "Append one short, relevant analogy that clarifies the core concept. Keep the existing text unchanged, and do not introduce unrelated ideas or a separate topic."
        }
        ParagraphSuggestionAction::LearningAddPracticeQuestion => {
            "Append exactly one practice question that tests the paragraph's key idea. Do not include an answer, and keep the existing text unchanged."
        }
        ParagraphSuggestionAction::LearningAddCheckUnderstanding => {
            "Append exactly one quick check-for-understanding question followed by a one-sentence model answer. Keep the existing text unchanged, and do not add extra explanation beyond that."
        }
        ParagraphSuggestionAction::SummariesOneSentence => {
            "Summarize the paragraph in exactly one sentence. Preserve the central meaning, and do not add interpretation, advice, or extra detail."
        }
        ParagraphSuggestionAction::SummariesTwoThreeSentences => {
            "Summarize the paragraph in exactly two or three sentences. Preserve the central meaning, and do not add interpretation, advice, or extra detail."
        }
        ParagraphSuggestionAction::SummariesKeyTakeaway => {
            "State exactly one sentence describing the single most important takeaway for students. Do not add extra interpretation, advice, or supporting detail."
        }
        ParagraphSuggestionAction::ToneAcademicFormal
        | ParagraphSuggestionAction::ToneFriendlyConversational
        | ParagraphSuggestionAction::ToneEncouragingSupportive
        | ParagraphSuggestionAction::ToneNeutralObjective
        | ParagraphSuggestionAction::ToneConfident
        | ParagraphSuggestionAction::ToneSerious => {
            "Adjust wording only as needed to match the target tone. Preserve all facts, claims, detail level, and overall structure, and do not add, remove, or materially reframe content."
        }
        ParagraphSuggestionAction::TranslateEnglish
        | ParagraphSuggestionAction::TranslateFinnish
        | ParagraphSuggestionAction::TranslateSwedish => {
            "Translate the paragraph into the target language while preserving meaning, domain terminology, and inline formatting. Do not add, omit, simplify, paraphrase, or reinterpret the content."
        }
    };
    s.to_string()
}

/// System prompt for generating multiple alternative paragraph suggestions for CMS content.
const SYSTEM_PROMPT: &str = r#"You are helping course staff improve a single paragraph of course material.

Your task is to generate several alternative versions of the given paragraph based on the requested action.

Critical: Perform only the requested action. Do not make any additional edits beyond what is strictly necessary to complete that action. Preserve wording, structure, tone, detail level, and sentence order unless the requested action explicitly requires changing them. For example: if the action is spelling/grammar, only fix spelling and grammar; if it is translation, only translate; if it is tone, only change tone; if it is clarity, only improve clarity. Do not also summarize, expand, simplify, reorder, or otherwise rewrite unless the requested action requires it.

General rules:
- Always preserve the original meaning and important details unless the action explicitly asks to add or remove content.
- Maintain a clear, pedagogical tone appropriate for course materials.
- Do not invent facts that contradict the original paragraph.

About the suggestions:
- Produce multiple alternative rewrites of the same paragraph.
- Do not output duplicate or near-duplicate suggestions.
- Keep each suggestion self-contained and suitable for direct insertion into the material.

You will receive:
- The original paragraph text.
- The requested action (a precise instruction; follow it and do nothing else).
- Optional metadata such as target tone and target language.

Your output must follow the JSON schema exactly:
{
  "suggestions": ["...", "...", "..."]
}"#;

/// User prompt prefix; the concrete action instruction and paragraph will be appended.
const USER_PROMPT_PREFIX: &str = "Apply only the requested action to the paragraph below. Do not make any other changes. The paragraph may contain inline HTML markup valid inside a Gutenberg paragraph; preserve existing inline tags (links, emphasis, code, sub/superscripts) where possible, do not introduce block-level elements, and do not add new formatting to spans of text that were previously unformatted. Return JSON only.";

/// Input payload for CMS paragraph suggestions.
pub struct CmsParagraphSuggestionInput {
    pub action: ParagraphSuggestionAction,
    pub content: String,
    pub is_html: bool,
    pub meta_tone: Option<String>,
    pub meta_language: Option<String>,
    pub meta_setting_type: Option<String>,
}

/// Generate multiple paragraph suggestions for CMS using an LLM with structured JSON output.
pub async fn generate_paragraph_suggestions(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    input: &CmsParagraphSuggestionInput,
) -> ChatbotResult<Vec<String>> {
    let CmsParagraphSuggestionInput {
        action,
        content,
        is_html: _,
        meta_tone,
        meta_language,
        meta_setting_type,
    } = input;

    let action_instruction = action_instruction(*action);

    let mut system_instructions = SYSTEM_PROMPT.to_owned();
    system_instructions.push_str("\n\nRequested action: ");
    system_instructions.push_str(&action_instruction);
    if let Some(tone) = meta_tone {
        system_instructions.push_str("\nTarget tone: ");
        system_instructions.push_str(tone);
    }
    if let Some(lang) = meta_language {
        system_instructions.push_str("\nTarget language: ");
        system_instructions.push_str(lang);
    }
    if let Some(setting_type) = meta_setting_type {
        system_instructions.push_str("\nSetting type: ");
        system_instructions.push_str(setting_type);
    }

    let paragraph_source = content.as_str();

    let user_message_content = format!(
        "{prefix}\n\nRequested action: {action_instruction}\n\nOriginal paragraph (may include inline HTML):\n{paragraph}",
        prefix = USER_PROMPT_PREFIX,
        action_instruction = action_instruction,
        paragraph = paragraph_source
    );

    let used_tokens =
        estimate_tokens(&system_instructions) + estimate_tokens(&user_message_content);
    let token_budget =
        calculate_safe_token_limit(task_lm.context_size, task_lm.context_utilization);

    if used_tokens > token_budget {
        return Err(ChatbotError::new(
            ChatbotErrorType::ChatbotMessageSuggestError,
            "Input paragraph is too long for the CMS AI suggestion context window.".to_string(),
            None,
        ));
    }

    let system_message = APIMessage {
        role: MessageRole::System,
        fields: APIMessageKind::Text(APIMessageText {
            content: system_instructions,
        }),
    };

    let user_message = APIMessage {
        role: MessageRole::User,
        fields: APIMessageKind::Text(APIMessageText {
            content: user_message_content,
        }),
    };

    let params = if task_lm.thinking {
        LLMRequestParams::Thinking(ThinkingParams {
            max_completion_tokens: Some(4000),
            verbosity: None,
            reasoning_effort: None,
            tools: vec![],
            tool_choice: None,
        })
    } else {
        LLMRequestParams::NonThinking(NonThinkingParams {
            max_tokens: Some(2000),
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
        })
    };

    let chat_request = LLMRequest {
        messages: vec![system_message, user_message],
        data_sources: vec![],
        params,
        response_format: Some(LLMRequestResponseFormatParam {
            format_type: JSONType::JsonSchema,
            json_schema: JSONSchema {
                name: "CmsParagraphSuggestionResponse".to_string(),
                strict: true,
                schema: Schema {
                    type_field: JSONType::Object,
                    properties: HashMap::from([(
                        "suggestions".to_string(),
                        ArrayProperty {
                            type_field: JSONType::Array,
                            items: ArrayItem {
                                type_field: JSONType::String,
                            },
                        },
                    )]),
                    required: vec!["suggestions".to_string()],
                    additional_properties: false,
                },
            },
        }),
        stop: None,
    };

    let completion = make_blocking_llm_request(chat_request, app_config, &task_lm).await?;

    let completion_content: &String = &parse_text_completion(completion)?;
    let response: CmsParagraphSuggestionResponse = serde_json::from_str(completion_content)
        .map_err(|_| {
            ChatbotError::new(
                ChatbotErrorType::ChatbotMessageSuggestError,
                "The CMS paragraph suggestion LLM returned an incorrectly formatted response."
                    .to_string(),
                None,
            )
        })?;

    if response.suggestions.is_empty() {
        return Err(ChatbotError::new(
            ChatbotErrorType::ChatbotMessageSuggestError,
            "The CMS paragraph suggestion LLM returned an empty suggestions list.".to_string(),
            None,
        ));
    }

    Ok(response.suggestions)
}
