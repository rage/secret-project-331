use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

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
    pub parameters: LLMToolParams,
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
    vec![AzureLLMToolDefintion {
        tool_type: LLMToolType::Function,
        function: LLMTool {
            name: "foo".to_string(),
            description: "Get foo".to_string(),
            parameters: LLMToolParams {
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
                        // (,)...
                    ])
                },
                required: vec!["fooname".to_string()],
            },
        },
    }]
}

pub fn call_chatbot_tool(fn_name: &str, fn_args: &Value) -> String {
    // returns a string that contains the info the chatbot should use.
    // in reality, the chatbot might want to use json data.
    match fn_name {
        "foo" => {
            let fooname = fn_args["fooname"].as_str().unwrap_or("default");
            foo(fooname)
        }
        _ => "Incorrect function name".to_string(),
    }
}

pub fn foo(fooname: &str) -> String {
    format!("Hello {fooname}! Barrr")
}
