use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgConnection;

use crate::azure_chatbot::ChatbotUserContext;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AzureLLMToolDefintion {
    #[serde(rename = "type")]
    pub tool_type: LLMToolType,
    pub function: LLMTool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMTool {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<LLMToolParams>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMToolParams {
    #[serde(rename = "type")]
    pub tool_type: LLMToolParamType,
    pub properties: HashMap<String, LLMToolParamProperties>,
    pub required: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMToolParamProperties {
    #[serde(rename = "type")]
    pub param_type: String,
    pub description: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolParamType {
    Object,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolType {
    Function,
}

pub fn chatbot_tools() -> Vec<AzureLLMToolDefintion> {
    vec![
        AzureLLMToolDefintion {
            tool_type: LLMToolType::Function,
            function: LLMTool {
                name: "foo".to_string(),
                description: "Get foo".to_string(),
                parameters: Some(LLMToolParams {
                    tool_type: LLMToolParamType::Object,
                    properties: {
                        HashMap::from([
                            (
                                "fooname".to_string(),
                                LLMToolParamProperties {
                                    param_type: "string".to_string(),
                                    description: "your fooname".to_string(),
                                },
                            ),
                        ]
                    )},
                    required: vec!["fooname".to_string()],
                }),
            },
        },
        AzureLLMToolDefintion {
            tool_type: LLMToolType::Function,
            function: LLMTool {
                name: "course_progress".to_string(),
                description: "Get the user's progress on this course, including information about exercises attempted, points gained, the passing criteria for the course and if the user meets the criteria.".to_string(),
                parameters: None
            }
        }
    ]
}

pub async fn call_chatbot_tool(
    conn: &mut PgConnection,
    fn_name: &str,
    fn_args: &Value,
    user_context: &ChatbotUserContext,
) -> anyhow::Result<String> {
    match fn_name {
        "foo" => {
            let fooname = fn_args["fooname"].as_str().unwrap_or("default");
            foo(fooname).await
        }
        "course_progress" => course_progress(conn, user_context).await,
        _ => Err(anyhow::Error::msg(
            "Incorrect or unknown function name".to_string(),
        )),
    }
}

pub async fn foo(fooname: &str) -> anyhow::Result<String> {
    Ok(format!("Hello {fooname}! Barrr"))
}

/// Return a string explaining the user's progress on the course that the chatbot is on
pub async fn course_progress(
    conn: &mut PgConnection,
    user_context: &ChatbotUserContext,
) -> anyhow::Result<String> {
    let mut progress = headless_lms_models::user_exercise_states::get_user_course_progress(
        conn,
        user_context.course_id,
        user_context.user_id,
    )
    .await?;
    let course_name = &user_context.course_name;
    let mut res = format!("The user is completing a course called {course_name}. ");

    if progress.len() == 1 {
        let module = &progress[0];
        res.push_str("Their progress on this course is the following: ");

        res = push_exercises_scores_progress(
            res,
            module.attempted_exercises,
            module.total_exercises,
            module.attempted_exercises_required,
            module.score_given,
            module.score_maximum,
            module.score_required,
        );
    } else {
        progress.sort_by_key(|m| m.course_module_order_number);
        let first_mod = progress.first();

        res = if let Some(module) = first_mod {
            let m_name = &module.course_module_name;
            res.push_str(&format!(
                "The user's progress on the base course module called {m_name} is the following: "
            ));
            push_exercises_scores_progress(
                res,
                module.attempted_exercises,
                module.total_exercises,
                module.attempted_exercises_required,
                module.score_given,
                module.score_maximum,
                module.score_required,
            )
        } else {
            res.push_str("There is no progress information for this user on this course. ");
            res
        };
        for module in progress.iter().skip(1) {
            let m_name = &module.course_module_name;
            res.push_str(&format!(
                "The user's progress on the course module called {m_name} is the following: "
            ));
            res = push_exercises_scores_progress(
                res,
                module.attempted_exercises,
                module.total_exercises,
                module.attempted_exercises_required,
                module.score_given,
                module.score_maximum,
                module.score_required,
            );
        }
    }
    Ok(res)
}

fn push_exercises_scores_progress(
    mut res: String,
    attempted_exercises: Option<i32>,
    total_exercises: Option<u32>,
    attempted_exercises_required: Option<i32>,
    score_given: f32,
    score_maximum: Option<u32>,
    score_required: Option<i32>,
) -> String {
    if let Some(a) = attempted_exercises {
        res.push_str(&format!("They have attempted {a} exercises. "));
    } else {
        res.push_str("They have not attempted any exercises. ");
    }
    if let Some(b) = total_exercises {
        res.push_str(&format!("There is a total of {b} exercises. "));
    }
    if let Some(c) = attempted_exercises_required {
        res.push_str(&format!(
            "To pass, it's required to attempt {c} exercises. "
        ));
    }
    res.push_str(&format!(
        "They have achieved a score of {score_given} points. "
    ));
    if let Some(d) = score_maximum {
        res.push_str(&format!("The maximum possible score is {d} points. "));
    }
    if let Some(e) = score_required {
        res.push_str(&format!("To pass, it's required to gain {e} points. "));
    }
    res
}
