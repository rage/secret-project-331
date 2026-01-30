use headless_lms_models::{
    course_modules::{CompletionPolicy, CourseModule},
    user_exercise_states::UserCourseProgress,
};
use headless_lms_utils::prelude::BackendError;
use sqlx::PgConnection;

use crate::{
    azure_chatbot::ChatbotUserContext,
    chatbot_tools::{AzureLLMToolDefinition, ChatbotTool, LLMTool, LLMToolType, ToolProperties},
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};

pub type CourseProgressTool = ToolProperties<CourseProgressState, CourseProgressArguments>;

impl ChatbotTool for CourseProgressTool {
    type State = CourseProgressState;
    type Arguments = CourseProgressArguments;

    fn parse_arguments(_args_string: String) -> ChatbotResult<Self::Arguments> {
        Ok(CourseProgressArguments {})
    }

    /// Create a CourseProgressTool instance
    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self> {
        let user_progress = headless_lms_models::user_exercise_states::get_user_course_progress(
            conn,
            user_context.course_id,
            user_context.user_id,
            true,
        )
        .await?;
        let modules =
            headless_lms_models::course_modules::get_by_course_id(conn, user_context.course_id)
                .await?;
        let progress = progress_info(user_progress, modules, &user_context.course_name)?;
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
            let progress_info = &progress[0];
            let module_progress = &progress_info.progress;

            res += "Their progress on this course is the following:";

            res += &push_exercises_scores_progress(
                module_progress,
                progress_info.automatic_completion,
                progress_info.requires_exam,
                "course",
            );
        } else {
            // If there are multiple modules in this course, then each module has its
            // own progress
            progress.sort_by_key(|m| m.order_number);
            let first_mod = progress.first();

            // the first in the sorted list is the base module
            let s = if let Some(progress_info) = first_mod {
                let module_progress = &progress_info.progress;
                let m_name = &module_progress.course_module_name;
                format!(
                    "The course has one base module, and additional modules. The user's progress on the base course module called {m_name} is the following:"
                ) + &push_exercises_scores_progress(
                    module_progress,
                    progress_info.automatic_completion,
                    progress_info.requires_exam,
                    "module",
                ) + "To pass the course, it's required to pass the base module. The following modules are additional to the course and to complete them, it's required to first complete the base module.\n"
            } else {
                // If the `progress` vec is empty, then:
                "There is no progress information for this user on this course. ".to_string()
            };
            res += &s;

            // skip first because we processed it earlier and add the progress for
            // each module
            for progress_info in progress.iter().skip(1) {
                let module_progress = &progress_info.progress;
                let m_name = &module_progress.course_module_name;
                res.push_str(&format!(
                    "The user's progress on the course module called {m_name} is the following:"
                ));
                res += &push_exercises_scores_progress(
                    module_progress,
                    progress_info.automatic_completion,
                    progress_info.requires_exam,
                    "module",
                );
            }
        }
        res
    }

    fn output_description_instructions(&self) -> Option<String> {
        if self.state.progress.len() > 1 {
            Some(
            "Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. If the user asks something like 'how to pass the course', describe the passing criteria and requirements of the base module. Encourage the user to ask further questions about other modules if needed.".to_string(),
        )
        } else {
            Some(
            "Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.".to_string(),
        )
        }
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

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CourseProgressArguments {}

pub struct CourseProgressState {
    course_name: String,
    progress: Vec<CourseProgressInfo>,
}

/// Contains the info needed to create course progress outputs for a user
#[derive(Debug, PartialEq, Clone)]
pub struct CourseProgressInfo {
    order_number: i32,
    progress: UserCourseProgress,
    automatic_completion: bool,
    requires_exam: bool,
}

fn push_exercises_scores_progress(
    module_progress: &UserCourseProgress,
    automatic_completion: bool,
    requires_exam: bool,
    course_or_module: &str,
) -> String {
    let attempted_exercises = module_progress.attempted_exercises;
    let total_exercises = module_progress.total_exercises;
    let attempted_exercises_required = module_progress.attempted_exercises_required;
    let score_given = module_progress.score_given;
    let score_maximum = module_progress.score_maximum;
    let score_required = module_progress.score_required;

    let mut res = "".to_string();
    if total_exercises.is_some() || score_maximum.is_some() {
        if let (Some(a), Some(b)) = (total_exercises, score_maximum)
            && a == 0
            && b == 0
        {
            res += &format!(
                " This {course_or_module} has no exercises and no points. It cannot be completed by doing exercises."
            );
            if requires_exam {
                res += " Passing an exam is required for completion.";
            } else {
                res += &format!(
                    " The user should look for information about completing the {course_or_module} in the course material or contact the teacher.\n"
                );
            }
            return res;
        }
        res += &format!(" On this {course_or_module}, there are available a total of ");

        if let Some(a) = total_exercises {
            res += &format!("{a} exercises");
        }
        if let Some(b) = score_maximum {
            if total_exercises.is_some() {
                res += " and ";
            }
            res += &format!("{b} exercise points");
        }
        res += ".";
    }
    if automatic_completion && score_required.is_none() && attempted_exercises_required.is_none() {
        res += &format!(
            " It's not required to attempt exercises or gain points to pass this {course_or_module}."
        );
    }

    if requires_exam {
        res += &format!(" To pass this {course_or_module}, it's required to complete an exam.");
    }
    if !automatic_completion {
        res += &format!(
            " This {course_or_module} is graded by a teacher and can't be automatically passed by completing exercises. The user should look for information about completing the {course_or_module} in the course material or contact the teacher."
        );
    }

    if attempted_exercises_required.is_some() || score_required.is_some() {
        if requires_exam {
            res += " To be qualified to take the exam, it's required to ";
        } else {
            res += &format!(" To pass this {course_or_module}, it's required to ");
        }

        if let Some(a) = attempted_exercises_required {
            res += &format!("attempt {a} exercises");
        }
        if let Some(b) = score_required {
            if attempted_exercises_required.is_some() {
                res += " and ";
            }
            res += &format!("gain {b} exercise points");
        }
        res += ".";
    } else if requires_exam {
        res += " The user can attempt the exam regardless of their progress on the course."
    }

    if let Some(b) = attempted_exercises {
        res += &format!(" The user has attempted {b} exercises.");
    } else {
        res += " The user has not attempted any exercises.";
    }
    let attempted_exercises_n = attempted_exercises.unwrap_or(0);

    let pass = if requires_exam {
        "be qualified to take the exam".to_string()
    } else {
        format!("pass this {course_or_module}")
    };

    if let Some(c) = attempted_exercises_required {
        let ex_left = c - attempted_exercises_n;
        if ex_left <= 0 {
            res += &format!(
                " They meet the criteria to {pass} if they have also received enough points."
            );
        } else {
            res += &format!(" To {pass}, they need to attempt {ex_left} more exercises.");
        }
    }

    // round down to one digit
    let score = (score_given * 10.0).floor() / 10.0;
    res += &format!(" The user has gained {:.1} points.", score);
    if let Some(e) = score_required {
        let pts_left = e as f32 - score;
        if pts_left <= 0 as f32 {
            res += &format!(" The user has gained enough points to {pass}.")
        } else {
            res += &format!(
                " To {pass}, the user needs to gain {:.1} more points.",
                pts_left
            )
        }
    }
    res + "\n"
}

/// Combine UserCourseProgress with the CompletionPolicy from an associated CourseModule.
fn progress_info(
    user_progress: Vec<UserCourseProgress>,
    modules: Vec<CourseModule>,
    course_name: &str,
) -> ChatbotResult<Vec<CourseProgressInfo>> {
    user_progress
        .into_iter()
        .map(|u| {
            let module = modules
                .iter()
                .find(|x| x.order_number == u.course_module_order_number);
            if let Some(m) = module {
                let (automatic_completion, requires_exam) = match &m.completion_policy {
                    CompletionPolicy::Automatic(policy) => (true, policy.requires_exam),
                    CompletionPolicy::Manual => (false, false),
                };
                Ok(CourseProgressInfo {
                    order_number: u.course_module_order_number,
                    progress: u,
                    automatic_completion,
                    requires_exam,
                })
            } else {
                Err(ChatbotError::new(ChatbotErrorType::Other, format!("There was an error fetching the user's course progress information. Couldn't find course module {} of course {}.", u.course_module_name, course_name), None))
            }
        })
        .collect::<ChatbotResult<Vec<CourseProgressInfo>>>()
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;

    impl CourseProgressTool {
        fn new_mock(course_name: String, progress: Vec<CourseProgressInfo>) -> Self {
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
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 3.3,
                score_required: Some(4),
                score_maximum: Some(5),
                total_exercises: Some(11),
                attempted_exercises: Some(4),
                attempted_exercises_required: Some(10),
            },
            automatic_completion: true,
            requires_exam: false,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are available a total of 11 exercises and 5 exercise points. To pass this course, it's required to attempt 10 exercises and gain 4 exercise points. The user has attempted 4 exercises. To pass this course, they need to attempt 6 more exercises. The user has gained 3.3 points. To pass this course, the user needs to gain 0.7 more points.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_many_modules() {
        let progress = vec![
            CourseProgressInfo {
                order_number: 3,
                progress: UserCourseProgress {
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
                automatic_completion: true,
                requires_exam: false,
            },
            CourseProgressInfo {
                order_number: 1,
                progress: UserCourseProgress {
                    course_module_id: Uuid::nil(),
                    course_module_name: "Advanced Chatbot Course".to_string(),
                    course_module_order_number: 1,
                    score_given: 8.056,
                    score_required: Some(8),
                    score_maximum: Some(10),
                    total_exercises: Some(5),
                    attempted_exercises: Some(5),
                    attempted_exercises_required: Some(5),
                },
                automatic_completion: true,
                requires_exam: false,
            },
            CourseProgressInfo {
                order_number: 2,
                progress: UserCourseProgress {
                    course_module_id: Uuid::nil(),
                    course_module_name: "First extra module".to_string(),
                    course_module_order_number: 2,
                    score_given: 3.94,
                    score_required: Some(5),
                    score_maximum: Some(6),
                    total_exercises: Some(6),
                    attempted_exercises: Some(4),
                    attempted_exercises_required: Some(5),
                },
                automatic_completion: true,
                requires_exam: false,
            },
            CourseProgressInfo {
                order_number: 4,
                progress: UserCourseProgress {
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
                automatic_completion: true,
                requires_exam: false,
            },
        ];

        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. The course has one base module, and additional modules. The user's progress on the base course module called Advanced Chatbot Course is the following: On this module, there are available a total of 5 exercises and 10 exercise points. To pass this module, it's required to attempt 5 exercises and gain 8 exercise points. The user has attempted 5 exercises. They meet the criteria to pass this module if they have also received enough points. The user has gained 8.0 points. The user has gained enough points to pass this module.
To pass the course, it's required to pass the base module. The following modules are additional to the course and to complete them, it's required to first complete the base module.
The user's progress on the course module called First extra module is the following: On this module, there are available a total of 6 exercises and 6 exercise points. To pass this module, it's required to attempt 5 exercises and gain 5 exercise points. The user has attempted 4 exercises. To pass this module, they need to attempt 1 more exercises. The user has gained 3.9 points. To pass this module, the user needs to gain 1.1 more points.
The user's progress on the course module called Second extra module is the following: On this module, there are available a total of 6 exercises and 5 exercise points. To pass this module, it's required to attempt 5 exercises and gain 4 exercise points. The user has not attempted any exercises. To pass this module, they need to attempt 5 more exercises. The user has gained 0.0 points. To pass this module, the user needs to gain 4.0 more points.
The user's progress on the course module called Chatbot advanced topics is the following: On this module, there are available a total of 2 exercises. It's not required to attempt exercises or gain points to pass this module. The user has attempted 2 exercises. The user has gained 2.0 points.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. If the user asks something like 'how to pass the course', describe the passing criteria and requirements of the base module. Encourage the user to ask further questions about other modules if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_no_progress() {
        let progress: Vec<CourseProgressInfo> = vec![];

        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. There is no progress information for this user on this course. [/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_no_course_points_exercises() {
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 0.0,
                score_required: None,
                score_maximum: Some(0),
                total_exercises: Some(0),
                attempted_exercises: None,
                attempted_exercises_required: None,
            },
            automatic_completion: true,
            requires_exam: false,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: This course has no exercises and no points. It cannot be completed by doing exercises. The user should look for information about completing the course in the course material or contact the teacher.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_cant_be_completed() {
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 0.0,
                score_required: Some(9),
                score_maximum: Some(10),
                total_exercises: Some(10),
                attempted_exercises: None,
                attempted_exercises_required: Some(10),
            },
            // cannot be completed automatically
            automatic_completion: false,
            requires_exam: false,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are available a total of 10 exercises and 10 exercise points. This course is graded by a teacher and can't be automatically passed by completing exercises. The user should look for information about completing the course in the course material or contact the teacher. To pass this course, it's required to attempt 10 exercises and gain 9 exercise points. The user has not attempted any exercises. To pass this course, they need to attempt 10 more exercises. The user has gained 0.0 points. To pass this course, the user needs to gain 9.0 more points.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_exercises_required_none() {
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 0.0,
                score_required: Some(9),
                score_maximum: Some(10),
                total_exercises: Some(10),
                attempted_exercises: None,
                attempted_exercises_required: None,
            },
            automatic_completion: true,
            requires_exam: false,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are available a total of 10 exercises and 10 exercise points. To pass this course, it's required to gain 9 exercise points. The user has not attempted any exercises. The user has gained 0.0 points. To pass this course, the user needs to gain 9.0 more points.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_pts_required_none() {
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 0.0,
                score_required: None,
                score_maximum: Some(10),
                total_exercises: Some(10),
                attempted_exercises: None,
                attempted_exercises_required: Some(10),
            },
            automatic_completion: true,
            requires_exam: false,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are available a total of 10 exercises and 10 exercise points. To pass this course, it's required to attempt 10 exercises. The user has not attempted any exercises. To pass this course, they need to attempt 10 more exercises. The user has gained 0.0 points.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_exam_required() {
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 0.0780006,
                score_required: Some(9),
                score_maximum: Some(10),
                total_exercises: Some(10),
                attempted_exercises: None,
                attempted_exercises_required: Some(10),
            },
            automatic_completion: true,
            requires_exam: true,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are available a total of 10 exercises and 10 exercise points. To pass this course, it's required to complete an exam. To be qualified to take the exam, it's required to attempt 10 exercises and gain 9 exercise points. The user has not attempted any exercises. To be qualified to take the exam, they need to attempt 10 more exercises. The user has gained 0.0 points. To be qualified to take the exam, the user needs to gain 9.0 more points.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_exam_required_can_do_exam() {
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 9.00006,
                score_required: Some(9),
                score_maximum: Some(10),
                total_exercises: Some(10),
                attempted_exercises: Some(10),
                attempted_exercises_required: Some(10),
            },
            automatic_completion: true,
            requires_exam: true,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are available a total of 10 exercises and 10 exercise points. To pass this course, it's required to complete an exam. To be qualified to take the exam, it's required to attempt 10 exercises and gain 9 exercise points. The user has attempted 10 exercises. They meet the criteria to be qualified to take the exam if they have also received enough points. The user has gained 9.0 points. The user has gained enough points to be qualified to take the exam.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }

    #[test]
    fn test_course_progress_output_exam_only_required() {
        let progress = vec![CourseProgressInfo {
            order_number: 1,
            progress: UserCourseProgress {
                course_module_id: Uuid::nil(),
                course_module_name: "Example base module".to_string(),
                course_module_order_number: 1,
                score_given: 9.0,
                score_required: None,
                score_maximum: Some(10),
                total_exercises: Some(10),
                attempted_exercises: Some(10),
                attempted_exercises_required: None,
            },
            automatic_completion: true,
            requires_exam: true,
        }];
        let tool = CourseProgressTool::new_mock("Advanced Chatbot Course".to_string(), progress);
        let output = tool.get_tool_output();

        let expected_output =
"Result: [output]The user is completing a course called Advanced Chatbot Course. Their progress on this course is the following: On this course, there are available a total of 10 exercises and 10 exercise points. It's not required to attempt exercises or gain points to pass this course. To pass this course, it's required to complete an exam. The user can attempt the exam regardless of their progress on the course. The user has attempted 10 exercises. The user has gained 9.0 points.\n[/output]

Instructions for describing the output: [instructions]Describe this information in a short, clear way with no or minimal bullet points. Only give information that is relevant to the user's question. Encourage the user to ask further questions if needed.[/instructions]".to_string();

        assert_eq!(output, expected_output);
    }
}
