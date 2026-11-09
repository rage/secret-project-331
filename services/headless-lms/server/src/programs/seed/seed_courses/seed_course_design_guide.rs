use anyhow::Result;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::{self, NewChatbotConf};
use headless_lms_models::chatbot_configurations_models;
use headless_lms_models::roles::UserRole;
use tracing::info;
use uuid::Uuid;

use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::{heading, list, list_item, paragraph};

/// Seeds the guide course that the course design assistant searches, and makes its chatbot the
/// assistant.
pub async fn seed_course_design_guide(
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    common_course_data: CommonCourseData,
) -> Result<Uuid> {
    let CommonCourseData {
        db_pool,
        organization_id: org,
        teacher_user_id,
        ..
    } = common_course_data;
    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };
    info!("Inserting the course design guide course");

    let llm = chatbot_configurations_models::get_default(&mut conn).await?;
    let assistant_configuration_id = cx.v5(b"chatbot_config:course_designer_assistant");

    let course = CourseBuilder::new("MOOC design guide", "mooc-design-guide")
        .desc("Guidance for teams designing a MOOC with the course design planner.")
        .chatbot(true)
        .course_id(course_id)
        .instance(CourseInstanceConfig {
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"instance:default")),
        })
        .chatbot_config(NewChatbotConf {
            course_id: Some(course_id),
            chatbotconf_id: Some(assistant_configuration_id),
            enabled_to_students: false,
            chatbot_name: "Course design assistant".to_string(),
            prompt: "You help teams design MOOCs. Base your advice on the guide course and on the team's plan, and keep it practical and brief.".to_string(),
            initial_message: "Hi! I can review your plan, answer questions about MOOC design and suggest changes for you to approve.".to_string(),
            use_azure_search: true,
            model_id: llm.id,
            ..Default::default()
        })
        .role(teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new().order(0).chapter(
                ChapterBuilder::new(1, "Designing a MOOC")
                    .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:front-page"))
                    .page(
                        PageBuilder::new("/chapter-1/addie", "The ADDIE process")
                            .block(heading(
                                "The ADDIE process",
                                cx.v5(b"page:addie:heading"),
                                2,
                            ))
                            .block(paragraph(
                                "Designing a MOOC moves through five phases: Analysis, Design, Development, Implementation and Evaluation. Each phase builds on the decisions made in the previous one.",
                                cx.v5(b"page:addie:intro"),
                            ))
                            .block(list(
                                cx.v5(b"page:addie:list"),
                                false,
                                vec![
                                    list_item(
                                        cx.v5(b"page:addie:list:analysis"),
                                        "Analysis: who the course is for, what they need and what resources you have.",
                                    ),
                                    list_item(
                                        cx.v5(b"page:addie:list:design"),
                                        "Design: learning goals, core content, course structure, content formats and exercises.",
                                    ),
                                    list_item(
                                        cx.v5(b"page:addie:list:development"),
                                        "Development: producing the content and exercises.",
                                    ),
                                    list_item(
                                        cx.v5(b"page:addie:list:implementation"),
                                        "Implementation: adding the content to the platform and testing it.",
                                    ),
                                    list_item(
                                        cx.v5(b"page:addie:list:evaluation"),
                                        "Evaluation: piloting the course with a test group and improving it.",
                                    ),
                                ],
                            )),
                    )
                    .page(
                        PageBuilder::new("/chapter-1/core-content", "Core content")
                            .block(heading(
                                "Prioritising core content",
                                cx.v5(b"page:core:heading"),
                                2,
                            ))
                            .block(paragraph(
                                "Divide the content into what students must know (about 80 %), should know (about 15 %) and would be nice to know (about 5 %). Build each chapter from an introduction, a few topics and a conclusion.",
                                cx.v5(b"page:core:body"),
                            )),
                    ),
            ),
        );
    let (course, _default_instance, _last_module) = course.seed(&mut conn, app_config, &cx).await?;
    chatbot_configurations::set_course_designer_assistant(&mut conn, assistant_configuration_id)
        .await?;
    Ok(course.id)
}
