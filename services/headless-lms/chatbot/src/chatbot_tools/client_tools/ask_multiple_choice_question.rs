use indexmap::IndexMap;

use serde::Deserialize;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, ClientToolAnswer, JSONType, JsonItem, Schema, SchemaPropertyType,
    },
    chatbot_tools::{
        AzureLLMFunctionToolDefinition, ChatbotToolDeclaration, ClientChatbotTool, LLMToolType,
        client_answer_data, tool_permission::ToolPermission,
    },
    conversation_context::ChatbotSurface,
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
};

/// Fewer than two choices is not a question. Both bounds are enforced in
/// [AskMultipleChoiceQuestionTool::parse_arguments] because Azure's strict schema subset has no
/// array length keywords to put them in.
const MIN_CHOICES: usize = 2;
/// A list long enough to scroll is worse for the learner than being asked in prose.
const MAX_CHOICES: usize = 6;

/// Puts a question with a small set of answers to the learner and waits for them to pick one.
pub struct AskMultipleChoiceQuestionTool;

/// The question as the LLM asked it, with the choices trimmed and checked.
pub struct AskMultipleChoiceQuestionArguments {
    question: String,
    choices: Vec<String>,
}

/// The arguments as the LLM emitted them, before the checks that
/// [AskMultipleChoiceQuestionTool::parse_arguments] makes.
#[derive(Deserialize)]
struct RawArguments {
    question: String,
    choices: Vec<String>,
}

/// What the client sends back: which of the offered choices the learner picked, by position in
/// the list they were offered in.
#[derive(Deserialize)]
struct MultipleChoiceAnswer {
    choice_index: u32,
}

/// A picked choice, resolved against the offered list.
pub struct MultipleChoiceSelection {
    /// The choice text as the LLM wrote it, rather than as the client echoed it back, so that the
    /// model only ever reads an answer it could have offered.
    choice: String,
}

impl ChatbotToolDeclaration for AskMultipleChoiceQuestionTool {
    const NAME: &'static str = "ask_multiple_choice_question";

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Ask the user a question with a short list of answers and wait for them to pick one. Use it when one specific piece of information from the user decides how you answer and the sensible answers are few and known in advance, for example which of several topics they mean or which language they want. Do not use it for open questions, for anything you can find out with another tool, or to ask for permission. Ask one question at a time.".to_string(),
            parameters: Schema {
                type_field: JSONType::Object,
                description: None,
                properties: IndexMap::from([
                    (
                        "question".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "The question, in the language the user is writing in. One sentence, answerable by picking one of the choices.".to_string(),
                            ),
                        }),
                    ),
                    (
                        "choices".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                            type_field: JSONType::Array,
                            description: Some(format!(
                                "The answers to offer, between {MIN_CHOICES} and {MAX_CHOICES} of them. Each is a short label the user picks by clicking, distinct from the others, in the language of the question. Do not number them and do not add an 'other' choice: the user can always reply in their own words instead."
                            )),
                            items: ArrayItem::JsonItem(JsonItem {
                                type_field: JSONType::String,
                                description: None,
                            }),
                        }),
                    ),
                ]),
                required: vec!["question".to_string(), "choices".to_string()],
                additional_properties: false,
            },
            strict: true,
        }
    }
}

impl ClientChatbotTool for AskMultipleChoiceQuestionTool {
    type Arguments = AskMultipleChoiceQuestionArguments;
    type Response = MultipleChoiceSelection;

    /// Every surface has a person reading it who can answer.
    const SURFACES: &'static [ChatbotSurface] = &[
        ChatbotSurface::CourseMaterialDialog,
        ChatbotSurface::CourseMaterialBlock,
        ChatbotSurface::Embed,
        ChatbotSurface::ConfigurationPreview,
        ChatbotSurface::CommandCenter,
    ];

    /// A clarifying question reveals nothing the user did not write themselves.
    const PERMISSION: ToolPermission = ToolPermission::Anyone;

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let parsed: RawArguments = serde_json::from_str(arguments).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {arguments}"),
                e
            )
        })?;

        let question = parsed.question.trim().to_string();
        if question.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "The question is empty.".to_string()
            ));
        }

        let choices: Vec<String> = parsed
            .choices
            .iter()
            .map(|choice| choice.trim().to_string())
            .collect();
        if !(MIN_CHOICES..=MAX_CHOICES).contains(&choices.len()) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!(
                    "The question offers {} choices, but it has to offer between {MIN_CHOICES} and {MAX_CHOICES}.",
                    choices.len()
                )
            ));
        }
        if choices.iter().any(String::is_empty) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "One of the choices is empty, so the user could not tell what picking it means."
                    .to_string()
            ));
        }
        if (1..choices.len()).any(|i| choices[i..].contains(&choices[i - 1])) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "Two of the choices are the same, so picking one would not answer the question."
                    .to_string()
            ));
        }

        Ok(AskMultipleChoiceQuestionArguments { question, choices })
    }

    fn parse_response(
        arguments: &Self::Arguments,
        answer: &ClientToolAnswer,
    ) -> ChatbotResult<Self::Response> {
        let answer: MultipleChoiceAnswer = client_answer_data(answer)?;
        let choice = arguments
            .choices
            .get(answer.choice_index as usize)
            .ok_or_else(|| {
                chatbot_err!(
                    InvalidToolAnswer,
                    format!(
                        "Choice {} was not offered: the question has {} choices.",
                        answer.choice_index,
                        arguments.choices.len()
                    )
                )
            })?;

        Ok(MultipleChoiceSelection {
            choice: choice.clone(),
        })
    }

    fn output(arguments: &Self::Arguments, response: &Self::Response) -> String {
        format!(
            "Asked: {:?}. The user chose: {:?}.",
            arguments.question, response.choice
        )
    }

    fn output_description_instructions() -> Option<String> {
        Some(
            "This is the user's own answer to the question you asked them, so take it as what they meant and carry on answering. Don't ask it again, don't repeat the choices back to them, and don't thank them for choosing."
                .to_string(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(question: &str, choices: &[&str]) -> String {
        serde_json::json!({ "question": question, "choices": choices }).to_string()
    }

    fn valid_arguments() -> AskMultipleChoiceQuestionArguments {
        AskMultipleChoiceQuestionTool::parse_arguments(&arguments(
            "Which loop do you mean?",
            &["while", "for"],
        ))
        .expect("the arguments are valid")
    }

    fn data_answer(value: serde_json::Value) -> ClientToolAnswer {
        ClientToolAnswer::Data { result: value }
    }

    #[test]
    fn valid_arguments_are_trimmed() {
        let parsed = AskMultipleChoiceQuestionTool::parse_arguments(&arguments(
            "  Which loop do you mean? ",
            &[" while ", "for"],
        ))
        .expect("the arguments are valid");

        assert_eq!(parsed.question, "Which loop do you mean?");
        assert_eq!(parsed.choices, vec!["while", "for"]);
    }

    /// The LLM is free to emit choice lists the schema cannot forbid, and a question with nothing
    /// answerable in it would suspend the turn on a call the learner cannot answer.
    #[test]
    fn unanswerable_questions_are_rejected() {
        let too_few = arguments("Which loop?", &["while"]);
        let too_many = arguments("Which loop?", &["a", "b", "c", "d", "e", "f", "g"]);
        let empty_question = arguments("   ", &["while", "for"]);
        let empty_choice = arguments("Which loop?", &["while", " "]);
        let repeated_choice = arguments("Which loop?", &["while", "while"]);

        for rejected in [
            too_few,
            too_many,
            empty_question,
            empty_choice,
            repeated_choice,
        ] {
            let error = AskMultipleChoiceQuestionTool::parse_arguments(&rejected)
                .err()
                .unwrap_or_else(|| panic!("{rejected} was accepted"));
            assert_eq!(
                error.error_type(),
                &ChatbotErrorType::InvalidToolArguments,
                "{rejected}"
            );
        }
    }

    #[test]
    fn the_choice_the_learner_picked_is_resolved_to_the_offered_text() {
        let arguments = valid_arguments();
        let response = AskMultipleChoiceQuestionTool::parse_response(
            &arguments,
            &data_answer(serde_json::json!({ "choice_index": 1 })),
        )
        .expect("the answer is one of the choices");

        assert_eq!(response.choice, "for");
        let output = AskMultipleChoiceQuestionTool::get_tool_output(&arguments, &response);
        assert!(output.contains("[output]"), "{output}");
        assert!(output.contains("\"for\""), "{output}");
    }

    /// The answer becomes text the model acts on, so a client that answers with something that
    /// was never offered must be refused rather than believed.
    #[test]
    fn an_answer_outside_the_offered_choices_is_refused() {
        let arguments = valid_arguments();

        for refused in [
            serde_json::json!({ "choice_index": 2 }),
            serde_json::json!({ "choice_index": 4294967295u32 }),
        ] {
            let error =
                AskMultipleChoiceQuestionTool::parse_response(&arguments, &data_answer(refused))
                    .err()
                    .expect("the choice was not offered");
            assert_eq!(error.error_type(), &ChatbotErrorType::InvalidToolAnswer);
        }
    }

    #[test]
    fn a_malformed_answer_is_the_clients_mistake() {
        let arguments = valid_arguments();

        let malformed = [
            serde_json::json!({}),
            serde_json::json!({ "choice_index": "for" }),
            serde_json::json!({ "choice_index": -1 }),
            serde_json::json!("for"),
        ];
        for refused in malformed {
            let error = AskMultipleChoiceQuestionTool::parse_response(
                &arguments,
                &data_answer(refused.clone()),
            )
            .err()
            .unwrap_or_else(|| panic!("{refused} was accepted"));
            assert_eq!(
                error.error_type(),
                &ChatbotErrorType::InvalidToolAnswer,
                "{refused}"
            );
        }

        let decision = ClientToolAnswer::Decision {
            approved: true,
            note: None,
        };
        let error = AskMultipleChoiceQuestionTool::parse_response(&arguments, &decision)
            .err()
            .expect("a decision answers no question");
        assert_eq!(error.error_type(), &ChatbotErrorType::InvalidToolAnswer);
    }
}
