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

        // If `progress` has one value, then this course has only one (default) module
        if progress.len() == 1 {
            let module = &progress[0];
            res += "Their progress on this course is the following: ";

            res += &push_exercises_scores_progress(
                module.attempted_exercises,
                module.total_exercises,
                module.attempted_exercises_required,
                module.score_given,
                module.score_maximum,
                module.score_required,
                "course",
            );
        } else {
            // If there are multiple modules in this course, then each module has its
            // own progress
            progress.sort_by_key(|m| m.course_module_order_number);
            let first_mod = progress.first();

            // the first in the sorted list is the base module
            let s = if let Some(module) = first_mod {
                let m_name = &module.course_module_name;
                format!(
                    "The user's progress on the base course module called {m_name} is the following: "
                ) + &push_exercises_scores_progress(
                    module.attempted_exercises,
                    module.total_exercises,
                    module.attempted_exercises_required,
                    module.score_given,
                    module.score_maximum,
                    module.score_required,
                    "module",
                ) + &format!(
                    "To pass the course, it's required to pass the base module. The following modules are additional to the course and to complete them, it's required to first complete the base module. \n"
                )
            } else {
                // If the `progress` vec is empty, then:
                "There is no progress information for this user on this course. ".to_string()
            };
            res += &s;

            // skip first because we processed it earlier and add the progress for
            // each module
            for module in progress.iter().skip(1) {
                let m_name = &module.course_module_name;
                res.push_str(&format!(
                    "The user's progress on the course module called {m_name} is the following: "
                ));
                res += &push_exercises_scores_progress(
                    module.attempted_exercises,
                    module.total_exercises,
                    module.attempted_exercises_required,
                    module.score_given,
                    module.score_maximum,
                    module.score_required,
                    "module",
                );
            }
        }
        res
    }

    fn output_description_instructions(&self) -> Option<&str> {
        Some(
            "Describe this information in a short, clear way with no or minimal bullent points. Only give information that is relevant to the user's question.",
        )
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
    attempted_exercises: Option<i32>,
    total_exercises: Option<u32>,
    attempted_exercises_required: Option<i32>,
    score_given: f32,
    score_maximum: Option<u32>,
    score_required: Option<i32>,
    course_or_module: &str,
) -> String {
    let mut res = "".to_string();
    if total_exercises.is_some() || score_maximum.is_some() {
        res += &format!("On this {course_or_module}, there are a total of ");

        if let Some(a) = total_exercises {
            res += &format!("{a} exercises");
        }
        if let Some(b) = score_maximum {
            if total_exercises.is_some() {
                res += &format!(" and ");
            }
            res += &format!("{b} exercise points");
        }
        res += &format!(". ");
    }

    if attempted_exercises_required.is_some() || score_required.is_some() {
        res += &format!("To pass this {course_or_module}, it's required to ");

        if let Some(a) = attempted_exercises_required {
            res += &format!("attempt {a} exercises");
        }
        if let Some(b) = score_required {
            if attempted_exercises_required.is_some() {
                res += &format!(" and ");
            }
            res += &format!("gain {b} exercise points");
        }
        res += &format!(". ");
    }

    if let Some(b) = attempted_exercises {
        res += &format!("The user has attempted {b} exercises. ");
    } else {
        res += "The user has not attempted any exercises. ";
    }
    let attempted_exercises_n = attempted_exercises.unwrap_or(0);

    if let Some(c) = attempted_exercises_required {
        let left = c - attempted_exercises_n;
        if left <= 0 {
            res += &format!(
                "They have attempted enough exercises to pass this {course_or_module} if they have also received enough points. "
            );
        } else {
            res += &format!(
                "To pass this {course_or_module}, they need to attempt {left} more exercises. "
            );
        }
    }

    res += &format!("The user has gained {:.1} points. ", score_given);

    if let Some(e) = score_required {
        let left = e as f32 - score_given;
        if left <= 0 as f32 {
            res += &format!("The user has gained enough points to pass this {course_or_module}. ")
        } else {
            res += &format!(
                "To pass this {course_or_module}, the user needs to gain {:.1} more points. ",
                left
            )
        }
    }
    res + "\n"
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;

    impl CourseProgressTool {
        fn new_mock(course_name: String, progress: Vec<UserCourseProgress>) -> Self {
            CourseProgressTool {
                state: CourseProgressState {
                    course_name,
                    progress,
                },
                arguments: CourseProgressArguments {},
            }
        }
    }

    #[test]
    fn test_course_progress_output_only_base_module() {
        let progress = vec![UserCourseProgress {
            course_module_id: Uuid::nil(),
            course_module_name: "Example base module".to_string(),
            course_module_order_number: 1,
            score_given: 3.3,
            score_required: Some(4),
            score_maximum: Some(5),
            total_exercises: Some(11),
            attempted_exercises: Some(4),
            attempted_exercises_required: Some(10),
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output = "Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are a total of 11 exercises and 5 exercise points. To pass this course, it's required to attempt 10 exercises and gain 4 exercise points. The user has attempted 4 exercises. To pass this course, they need to attempt 6 more exercises. The user has gained 3.3 points. To pass this course, the user needs to gain 0.7 more points. \n[/output] \n\nInstructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullent points. Only give information that is relevant to the user's question.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_many_modules() {
        let progress = vec![
            UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Second extra module".to_string(),
                course_module_order_number: 3,
                score_given: 0.0,
                score_required: Some(4),
                score_maximum: Some(5),
                total_exercises: Some(6),
                attempted_exercises: None,
                attempted_exercises_required: Some(5),
            },
            UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Advanced Chatbot Course".to_string(),
                course_module_order_number: 1,
                score_given: 8.0,
                score_required: Some(8),
                score_maximum: Some(10),
                total_exercises: Some(5),
                attempted_exercises: Some(5),
                attempted_exercises_required: Some(5),
            },
            UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "First extra module".to_string(),
                course_module_order_number: 2,
                score_given: 3.9,
                score_required: Some(5),
                score_maximum: Some(6),
                total_exercises: Some(6),
                attempted_exercises: Some(4),
                attempted_exercises_required: Some(5),
            },
            UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Chatbot advanced topics".to_string(),
                course_module_order_number: 4,
                score_given: 2.0,
                score_required: None,
                score_maximum: None,
                total_exercises: Some(2),
                attempted_exercises: Some(2),
                attempted_exercises_required: None,
            },
        ];

        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output = "Result: [output]The user is completing a course called Advanced Chatbot Course. The user's progress on the base course module called Advanced Chatbot Course is the following: On this module, there are a total of 5 exercises and 10 exercise points. To pass this module, it's required to attempt 5 exercises and gain 8 exercise points. The user has attempted 5 exercises. They have attempted enough exercises to pass this module if they have also received enough points. The user has gained 8.0 points. The user has gained enough points to pass this module. \nTo pass the course, it's required to pass the base module. The following modules are additional to the course and to complete them, it's required to first complete the base module. \nThe user's progress on the course module called First extra module is the following: On this module, there are a total of 6 exercises and 6 exercise points. To pass this module, it's required to attempt 5 exercises and gain 5 exercise points. The user has attempted 4 exercises. To pass this module, they need to attempt 1 more exercises. The user has gained 3.9 points. To pass this module, the user needs to gain 1.1 more points. \nThe user's progress on the course module called Second extra module is the following: On this module, there are a total of 6 exercises and 5 exercise points. To pass this module, it's required to attempt 5 exercises and gain 4 exercise points. The user has not attempted any exercises. To pass this module, they need to attempt 5 more exercises. The user has gained 0.0 points. To pass this module, the user needs to gain 4.0 more points. \nThe user's progress on the course module called Chatbot advanced topics is the following: On this module, there are a total of 2 exercises. The user has attempted 2 exercises. The user has gained 2.0 points. \n[/output] \n\nInstructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullent points. Only give information that is relevant to the user's question.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_no_progress() {
        let progress: Vec<UserCourseProgress> = vec![];

        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output = "Result: [output]The user is completing a course called Advanced Chatbot Course. There is no progress information for this user on this course. [/output] \n\nInstructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullent points. Only give information that is relevant to the user's question.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }
}
