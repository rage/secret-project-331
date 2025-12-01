use headless_lms_models::{ModelError, user_exercise_states::UserCourseProgress};
use sqlx::PgConnection;

use crate::{
    azure_chatbot::ChatbotUserContext,
    chatbot_tools::{AzureLLMToolDefinition, ChatbotTool, LLMTool, LLMToolType, ToolProperties},
};

pub type CourseProgressTool = ToolProperties<CourseProgressState, CourseProgressArguments>;

impl ChatbotTool for CourseProgressTool {
    type State = CourseProgressState;
    type Arguments = CourseProgressArguments;

    fn parse_arguments(_args_string: String) -> Self::Arguments {
        CourseProgressArguments {}
    }

    /// Create a CourseProgressTool instance
    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> Result<Self, ModelError> {
        let progress = headless_lms_models::user_exercise_states::get_user_course_progress(
            conn,
            user_context.course_id,
            user_context.user_id,
        )
        .await?;
        Result::Ok(CourseProgressTool {
            state: CourseProgressState {
                course_name: user_context.course_name.clone(),
                progress,
            },
            arguments,
        })
    }

    /// Return a string explaining the user's progress on the course that the chatbot is on
    fn output(&self) -> String {
        let mut progress = self.state.progress.to_owned();
        let course_name = &self.state.course_name;
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
        res
    }

    fn get_arguments(&self) -> &Self::Arguments {
        &self.arguments
    }

    fn get_tool_definition() -> AzureLLMToolDefinition {
        AzureLLMToolDefinition {
            tool_type: LLMToolType::Function,
            function: LLMTool {
                name: "course_progress".to_string(),
                description: "Get the user's progress on this course, including information about exercises attempted, points gained, the passing criteria for the course and if the user meets the criteria.".to_string(),
                parameters: None
            }
        }
    }
}

#[derive(serde::Serialize)]
pub struct CourseProgressArguments {}

pub struct CourseProgressState {
    course_name: String,
    progress: Vec<UserCourseProgress>,
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
