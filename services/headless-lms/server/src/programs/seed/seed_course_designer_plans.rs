use chrono::NaiveDate;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    course_designer_plan_members,
    course_designer_plans::{self, CourseDesignerCourseSize, CourseDesignerStage},
    course_designer_stage_workspace::{
        AnalysisCourseType, AnalysisWorkspaceV1, CourseDesignerStageWorkspace, DesignChapter,
        DesignChapterTopic, DesignPlannedContentFormats, DesignStyleGuide, DesignWorkloadActivity,
        DesignWorkloadActivityType, DesignWorkspaceV1,
    },
    library::course_designer::{
        self, ChapterDraft, CourseDraft, CourseFromPlanDrafts, CourseFromPlanOptions, TopicOutline,
        TopicOutlineSection,
    },
    user_details,
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

use super::{seed_helpers::get_seed_spec_fetcher, seed_users::SeedUsersResult};

/// Seeds two course design plans in Development, one still waiting for its course and one with
/// a course created from it, and an empty draft plan.
pub async fn seed_course_designer_plans(
    db_pool: Pool<Postgres>,
    app_config: ApplicationConfiguration,
    seed_users_result: SeedUsersResult,
    organization_id: Uuid,
) -> anyhow::Result<()> {
    info!("inserting course design plans");
    let mut conn = db_pool.acquire().await?;
    let SeedUsersResult {
        teacher_user_id,
        language_teacher_user_id,
        ..
    } = seed_users_result;

    let plan = course_designer_plans::create_plan(
        &mut conn,
        teacher_user_id,
        Some("Introduction to Sustainability".to_string()),
    )
    .await?;
    let member_email =
        user_details::get_user_details_by_user_id(&mut conn, language_teacher_user_id)
            .await?
            .email;
    course_designer_plan_members::add_plan_member_by_email(
        &mut conn,
        plan.id,
        teacher_user_id,
        &member_email,
    )
    .await?;

    let schedule = course_designer_plans::build_schedule_suggestion(
        CourseDesignerCourseSize::Medium,
        NaiveDate::from_ymd_opt(2026, 10, 1).expect("valid date"),
    )?;
    course_designer_plan_members::replace_schedule_for_user(
        &mut conn,
        plan.id,
        teacher_user_id,
        plan.name.clone(),
        &schedule,
    )
    .await?;
    course_designer_plan_members::finalize_schedule_for_user(&mut conn, plan.id, teacher_user_id)
        .await?;

    course_designer_plans::update_stage_workspace_for_user(
        &mut conn,
        plan.id,
        teacher_user_id,
        CourseDesignerStage::Analysis,
        CourseDesignerStageWorkspace::AnalysisV1(AnalysisWorkspaceV1 {
            course_title: Some("Introduction to Sustainability".to_string()),
            credits: Some(2.0),
            language: Some("en".to_string()),
            target_group: Some("Open university students and the general public".to_string()),
            mode_asynchronous: true,
            open_period_all: true,
            responsible_teachers: Some("Teacher Example".to_string()),
            contributors_subject_matter_experts: Some(
                "Teacher Example\nLanguage Teacher Example".to_string(),
            ),
            course_type: Some(AnalysisCourseType::Elective),
            wishes_topics: Some("Climate, biodiversity and everyday choices".to_string()),
            wishes_content_format_text: true,
            wishes_content_format_video: true,
            ..Default::default()
        }),
        0,
    )
    .await?;
    let details = course_designer_plans::update_stage_workspace_for_user(
        &mut conn,
        plan.id,
        teacher_user_id,
        CourseDesignerStage::Design,
        CourseDesignerStageWorkspace::DesignV1(DesignWorkspaceV1 {
            learning_goals: vec![
                "Explain the main dimensions of sustainability".to_string(),
                "Evaluate everyday choices by their environmental impact".to_string(),
                String::new(),
            ],
            core_content_must_know:
                "Planetary boundaries and the three dimensions of sustainability.".to_string(),
            core_content_should_know: "Life cycle assessment basics.".to_string(),
            core_content_nice_to_know: "History of the sustainability movement.".to_string(),
            chapters: vec![
                DesignChapter {
                    id: Uuid::parse_str("4f0b8a62-5d3e-4c51-9a3b-6f1e2d7c8b90")?,
                    title: "What is sustainability?".to_string(),
                    learning_objectives: vec!["Define sustainability".to_string()],
                    topics: vec![
                        DesignChapterTopic {
                            id: Uuid::parse_str("a1c2e3f4-0b1d-4e5f-8a9b-0c1d2e3f4a5b")?,
                            title: "Planetary boundaries".to_string(),
                        },
                        DesignChapterTopic {
                            id: Uuid::parse_str("b2d3f4a5-1c2e-4f60-9b0c-1d2e3f4a5b6c")?,
                            title: "Social sustainability".to_string(),
                        },
                    ],
                },
                DesignChapter {
                    id: Uuid::parse_str("5a1c9b73-6e4f-4d62-8b4c-7a2f3e8d9ca1")?,
                    title: "Sustainable everyday life".to_string(),
                    learning_objectives: vec!["Compare the impact of everyday choices".to_string()],
                    topics: vec![DesignChapterTopic {
                        id: Uuid::parse_str("c3e4a5b6-2d3f-4071-8c1d-2e3f4a5b6c7d")?,
                        title: "Food and mobility".to_string(),
                    }],
                },
            ],
            planned_content_formats: DesignPlannedContentFormats {
                text: true,
                videos: true,
                infographics: true,
                ..Default::default()
            },
            style_guide: DesignStyleGuide {
                writing_style: "Friendly and direct; address the reader as you.".to_string(),
                colour_palette: "Primary #1F5C3A, accent #8FD694, text #222222".to_string(),
                terminology_and_acronyms:
                    "LCA = life cycle assessment\nSDG: Sustainable Development Goal\nWrite CO2, not carbon dioxide, after the first mention"
                        .to_string(),
                ..Default::default()
            },
            workload_activities: vec![
                DesignWorkloadActivity {
                    id: Uuid::parse_str("d4f5b6c7-3e40-4182-9d2e-3f4a5b6c7d8e")?,
                    title: "Reading".to_string(),
                    activity_type: DesignWorkloadActivityType::AcquisitionReading,
                    count: 20,
                    minutes_each: 8,
                },
                DesignWorkloadActivity {
                    id: Uuid::parse_str("e5a6c7d8-4f51-4293-8e3f-4a5b6c7d8e9f")?,
                    title: "Short videos".to_string(),
                    activity_type: DesignWorkloadActivityType::AcquisitionVideo,
                    count: 10,
                    minutes_each: 5,
                },
            ],
            ..Default::default()
        }),
        0,
    )
    .await?;

    course_designer_plans::set_great_mooc_vision_for_user(
        &mut conn,
        plan.id,
        teacher_user_id,
        Some("Short, practical chapters that students can apply to their own lives.".to_string()),
    )
    .await?;

    let analysis_stage = details
        .stages
        .iter()
        .find(|s| s.stage.stage == CourseDesignerStage::Analysis)
        .ok_or_else(|| anyhow::anyhow!("seeded plan has no analysis stage"))?;
    if let Some(first_task) = analysis_stage.tasks.first() {
        course_designer_plan_members::update_stage_task_for_user(
            &mut conn,
            plan.id,
            first_task.id,
            teacher_user_id,
            None,
            None,
            Some(true),
        )
        .await?;
    }
    if let Some(second_task) = analysis_stage.tasks.get(1) {
        course_designer_plan_members::set_task_assignee_for_user(
            &mut conn,
            plan.id,
            second_task.id,
            teacher_user_id,
            Some(language_teacher_user_id),
        )
        .await?;
    }
    course_designer_plan_members::create_stage_task_for_user(
        &mut conn,
        plan.id,
        analysis_stage.stage.id,
        teacher_user_id,
        "Interview two former students".to_string(),
        Some("Ask what they missed in the old course.".to_string()),
    )
    .await?;

    // Completes Analysis and Design.
    for _ in 0..2 {
        course_designer_plan_members::advance_to_next_stage_for_user(
            &mut conn,
            plan.id,
            teacher_user_id,
        )
        .await?;
    }

    seed_plan_with_course(
        &mut conn,
        &app_config,
        teacher_user_id,
        language_teacher_user_id,
        organization_id,
    )
    .await?;

    course_designer_plans::create_plan(&mut conn, teacher_user_id, Some("Draft plan".to_string()))
        .await?;
    Ok(())
}

/// A plan whose Design is done and whose course was created from it with fixed drafts, so the
/// Development stage shows a course status and automatic tasks.
async fn seed_plan_with_course(
    conn: &mut sqlx::PgConnection,
    app_config: &ApplicationConfiguration,
    teacher_user_id: Uuid,
    language_teacher_user_id: Uuid,
    organization_id: Uuid,
) -> anyhow::Result<()> {
    let plan = course_designer_plans::create_plan(
        conn,
        teacher_user_id,
        Some("Data Literacy Basics".to_string()),
    )
    .await?;
    let member_email = user_details::get_user_details_by_user_id(conn, language_teacher_user_id)
        .await?
        .email;
    course_designer_plan_members::add_plan_member_by_email(
        conn,
        plan.id,
        teacher_user_id,
        &member_email,
    )
    .await?;
    let schedule = course_designer_plans::build_schedule_suggestion(
        CourseDesignerCourseSize::Small,
        NaiveDate::from_ymd_opt(2026, 9, 1).expect("valid date"),
    )?;
    course_designer_plan_members::replace_schedule_for_user(
        conn,
        plan.id,
        teacher_user_id,
        plan.name.clone(),
        &schedule,
    )
    .await?;
    course_designer_plan_members::finalize_schedule_for_user(conn, plan.id, teacher_user_id)
        .await?;
    course_designer_plans::update_stage_workspace_for_user(
        conn,
        plan.id,
        teacher_user_id,
        CourseDesignerStage::Analysis,
        CourseDesignerStageWorkspace::AnalysisV1(AnalysisWorkspaceV1 {
            course_title: Some("Data Literacy Basics".to_string()),
            credits: Some(1.0),
            language: Some("en".to_string()),
            target_group: Some("Anyone who reads news with numbers in it".to_string()),
            mode_asynchronous: true,
            contributors_instructional_designer: Some("Teacher Example".to_string()),
            ..Default::default()
        }),
        0,
    )
    .await?;
    course_designer_plans::update_stage_workspace_for_user(
        conn,
        plan.id,
        teacher_user_id,
        CourseDesignerStage::Design,
        CourseDesignerStageWorkspace::DesignV1(DesignWorkspaceV1 {
            learning_goals: vec!["Read charts critically".to_string()],
            chapters: vec![DesignChapter {
                id: Uuid::parse_str("6b2d0c84-7f5a-4e73-9c5d-8b3a4f9e0db2")?,
                title: "Reading charts".to_string(),
                learning_objectives: vec!["Spot a misleading axis".to_string()],
                topics: vec![DesignChapterTopic {
                    id: Uuid::parse_str("d4e5f6a7-3e4f-4182-9d2e-3f4a5b6c7d8f")?,
                    title: "Axes and scales".to_string(),
                }],
            }],
            planned_content_formats: DesignPlannedContentFormats {
                text: true,
                ..Default::default()
            },
            ..Default::default()
        }),
        0,
    )
    .await?;
    // Completes Analysis and Design.
    for _ in 0..2 {
        course_designer_plan_members::advance_to_next_stage_for_user(
            conn,
            plan.id,
            teacher_user_id,
        )
        .await?;
    }

    let options = CourseFromPlanOptions {
        organization_id,
        name: None,
        language_code: None,
        should_give_members_course_roles: true,
    };
    let source =
        course_designer::get_course_from_plan_source(conn, plan.id, teacher_user_id, &options)
            .await?;
    let drafts = CourseFromPlanDrafts {
        course: CourseDraft {
            description: "Learn to read the numbers and charts in the news critically.".to_string(),
            hero_subtitle: "Read the numbers in the news with confidence.".to_string(),
            about_text: "A short course on reading charts and statistics critically.".to_string(),
            learning_goal_headings: vec!["Critical chart reading".to_string()],
            how_to_study_paragraphs: vec![
                "The course has one chapter that you can study at your own pace.".to_string(),
            ],
            chatbot: None,
        },
        chapters: vec![ChapterDraft {
            prior_learning_heading: "Charts you have seen".to_string(),
            prior_learning_questions: vec![
                "Which chart in the news last surprised you?".to_string(),
            ],
            topic_outlines: vec![TopicOutline {
                sections: vec![TopicOutlineSection {
                    heading: "Truncated axes".to_string(),
                    points: vec!["How a cut y-axis exaggerates differences".to_string()],
                }],
            }],
        }],
    };
    course_designer::create_course_from_plan(
        conn,
        app_config,
        teacher_user_id,
        &options,
        &source,
        &drafts,
        get_seed_spec_fetcher(),
        crate::domain::models_requests::fetch_service_info,
    )
    .await?;
    Ok(())
}
