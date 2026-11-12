use anyhow::Result;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::{self, NewChatbotConf, ToolCategory};
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
use headless_lms_utils::document_schema_processor::GutenbergBlock;

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
            enabled_tool_categories: vec![
                ToolCategory::CourseMaterial,
                ToolCategory::Interaction,
                ToolCategory::CoursePlanning,
            ],
            model_id: llm.id,
            ..Default::default()
        })
        .role(teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new()
                .order(0)
                .chapter(
                    ChapterBuilder::new(1, "What a MOOC is")
                        .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:front-page"))
                        .pages([
                            guide_page(&cx, "/chapter-1/what-is-a-mooc", "What is a MOOC?", WHAT_IS_A_MOOC),
                            guide_page(&cx, "/chapter-1/addie", "The MOOC development process", ADDIE),
                            guide_page(&cx, "/chapter-1/course-structure", "Course structure on mooc.fi", COURSE_STRUCTURE),
                            guide_page(&cx, "/chapter-1/chapter-and-page-structure", "Chapter and page structure", CHAPTER_AND_PAGE_STRUCTURE),
                        ]),
                )
                .chapter(
                    ChapterBuilder::new(2, "Designing the course")
                        .fixed_ids(cx.v5(b"chapter:2"), cx.v5(b"chapter:2:front-page"))
                        .pages([
                            guide_page(&cx, "/chapter-2/learning-goals", "Learning goals and learning objectives", LEARNING_GOALS),
                            guide_page(&cx, "/chapter-2/core-content", "Course core content and structure", CORE_CONTENT),
                            guide_page(&cx, "/chapter-2/content-formats", "Content formats", CONTENT_FORMATS),
                            guide_page(&cx, "/chapter-2/exercises", "Exercises and student workload", EXERCISES),
                            guide_page(&cx, "/chapter-2/style-guide", "Style guide", STYLE_GUIDE),
                        ]),
                )
                .chapter(
                    ChapterBuilder::new(3, "Implementing and evaluating the course")
                        .fixed_ids(cx.v5(b"chapter:3"), cx.v5(b"chapter:3:front-page"))
                        .pages([
                            guide_page(&cx, "/chapter-3/implementation", "Implementation", IMPLEMENTATION),
                            guide_page(&cx, "/chapter-3/evaluation", "Evaluation", EVALUATION),
                        ]),
                ),
        );
    let (course, _default_instance, _last_module) = course.seed(&mut conn, app_config, &cx).await?;
    chatbot_configurations::set_course_designer_assistant(&mut conn, assistant_configuration_id)
        .await?;
    Ok(course.id)
}

enum GuideBlock {
    Heading(&'static str),
    Paragraph(&'static str),
    BulletList(&'static [&'static str]),
}

use GuideBlock::{BulletList, Heading, Paragraph};

/// A guide page whose block ids derive from its path, so reseeding keeps them stable.
fn guide_page(cx: &SeedContext, path: &str, title: &str, blocks: &[GuideBlock]) -> PageBuilder {
    let id = |suffix: String| cx.v5(format!("page:{path}:{suffix}").as_bytes());
    PageBuilder::new(path, title).blocks(blocks.iter().enumerate().map(|(index, block)| {
        match block {
            Heading(text) => heading(text, id(index.to_string()), 2),
            Paragraph(text) => paragraph(text, id(index.to_string())),
            BulletList(items) => list(
                id(index.to_string()),
                false,
                items
                    .iter()
                    .enumerate()
                    .map(|(item_index, item)| list_item(id(format!("{index}:{item_index}")), item))
                    .collect::<Vec<GutenbergBlock>>(),
            ),
        }
    }))
}

const WHAT_IS_A_MOOC: &[GuideBlock] = &[
    Paragraph(
        "MOOC stands for Massive Open Online Course. Each of the four letters describes something the course has to be.",
    ),
    Heading("M = Massive"),
    BulletList(&[
        "The number of participants is unlimited: there is no upper limit to course admission.",
        "The course is scaled to a large number of students, which means, for example, that assignments are checked automatically.",
        "The course subject is considered to be of interest to several target groups.",
    ]),
    Heading("O = Open"),
    BulletList(&[
        "The course is open to all: anyone can take part in it.",
        "There are no entry requirements. You can still recommend prior knowledge for the course.",
        "The right to participate is not limited to specific groups, such as students of one university or teachers.",
        "All learning materials can be viewed without logging in. Students log in only when they want to return assignments or take part in a discussion, and they can create their own account with an email address.",
    ]),
    Heading("O = Online"),
    BulletList(&[
        "The course can be completed fully online. For example, possible lectures are recorded for remote participants.",
        "The start of studies is as flexible as possible: students may start at any point during a set period of time.",
        "Registration to the Open University takes place only after the course.",
        "The study schedule is as flexible as possible, and assignments have flexible return deadlines.",
        "The material is open access and does not require a university account.",
    ]),
    Heading("C = Course"),
    BulletList(&[
        "It is not just material but an actual course, with assignments that must be completed to complete the course.",
        "The course awards credits and is included in the university's curriculum.",
        "Students who wish to can get official credits by registering in the Open University at the end of the course and paying the course fee. The fee is never paid before the course starts.",
        "Students who wish to can include the course in their degree, at least in optional studies.",
    ]),
    Heading("What makes a MOOC great?"),
    Paragraph(
        "Take a moment to think about the features of a great MOOC. Look at other MOOCs you consider well designed. Write down the features you want your course to have: this is your vision of a great MOOC, and it guides your design process.",
    ),
];

const ADDIE: &[GuideBlock] = &[
    Paragraph(
        "There are five stages of MOOC development, based on the ADDIE model: Analysis, Design, Development, Implementation and Evaluation. Each stage builds on the decisions made in the previous one, and the course design planner follows the same process to help you keep track of what needs to be done to finish the MOOC in the desired timeline.",
    ),
    BulletList(&[
        "Analysis: who the course is for, what they need, what resources you have and who contributes to the course.",
        "Design: learning goals and objectives, core content, course structure, content formats, style guide, exercises and student workload.",
        "Development: producing the content and exercises.",
        "Implementation: adding the content to the platform, setting up activities and testing the learner experience.",
        "Evaluation: piloting the course with a test group and improving it based on their feedback.",
    ]),
    Paragraph(
        "The course design planner focuses on the design stage. Through the timeline and its guidance, it also helps in the other stages.",
    ),
    Heading("Analysis"),
    Paragraph(
        "A students' needs analysis can be collected through a questionnaire, focus groups, interviews or feedback from an existing course on the same topic: the students' demographic data, the topics they want to learn about, the content formats and types of assessment they prefer and their other suggestions. A market analysis can show whether there is a need for the course.",
    ),
    Paragraph(
        "Find out which resources are already available at your university and which services you need to buy, and make a budget estimate for them.",
    ),
    Paragraph(
        "MOOC development has several key contributors. The instructional designer is responsible for the pedagogical design, project management and coordinating the development. Subject matter experts develop the syllabus and the core content. Editors make sure there is no content overlap across the course. Support staff help with video and audio editing and other tasks. Often one of the subject matter experts also acts as the instructional designer and editor, so decide who takes responsibility for each task.",
    ),
];

const COURSE_STRUCTURE: &[GuideBlock] = &[
    Paragraph(
        "Before you start designing your MOOC, get familiar with the course structure on mooc.fi.",
    ),
    Paragraph(
        "In mooc.fi, a course can include one or several modules. Each module can be registered as a separate course. University of Helsinki staff can get support with registering a course from the Open University services: avoinyo-mooc@helsinki.fi.",
    ),
    Paragraph(
        "A module includes top-level pages: the front page of the course, the chapters and other top-level pages. The top-level pages give general and administrative information about the course, such as How to study the course, Frequently asked questions and Contributors. They tell students everything they need to know before they start learning. You can add other top-level pages if needed.",
    ),
];

const CHAPTER_AND_PAGE_STRUCTURE: &[GuideBlock] = &[
    Paragraph(
        "A chapter includes several pages, and the pages follow a certain structure. This creates a good flow for the course. Adjust the suggested structure to fit your course, but always include pedagogical elements such as stimulation of prior learning, examples and scaffolding when you arrange the content.",
    ),
    Heading("Chapter structure"),
    BulletList(&[
        "Introduction: a short summary of the chapter's topics. Make it catching, like a hook that gets students interested.",
        "Stimulation of prior learning: a simple reflection exercise that does not need to be graded. A few questions activate the students' prior knowledge of the chapter's topics. Usually one per chapter is enough; a course with a lot of content can have one on every page.",
        "Pages, usually 3 to 4, each covering one topic.",
        "Conclusion: a short summary of the chapter, sometimes with a chapter-level assignment.",
    ]),
    Paragraph(
        "You can think of each chapter as a written lecture: the introduction briefly tells what the chapter covers, a short prior learning exercise follows, and then the topics are introduced, each followed by a short exercise.",
    ),
    Heading("Page structure"),
    BulletList(&[
        "Introduction: a paragraph or two about why the content is important.",
        "Content, with headings and subheadings.",
        "Case in point: an example or a highlight. This is usually a good place for a video or a podcast exercise.",
        "Exercise: one short assignment.",
        "Conclusion: a short wrap-up paragraph with suggestions for further reading.",
        "References.",
    ]),
];

const LEARNING_GOALS: &[GuideBlock] = &[
    Paragraph(
        "Based on the needs analysis and a preliminary idea of the course content, formulate three learning goals for your course. Learning goals communicate the big picture of the course to students, and they guide you in selecting suitable content.",
    ),
    Paragraph(
        "The course also needs learning objectives, preferably three to four for each chapter, or even for each topic if the course has a lot of content. Learning objectives direct the teaching and learning methods as well as the assessment methods, so take your time to formulate them. Exercises must be aligned with the intended learning outcomes.",
    ),
];

const CORE_CONTENT: &[GuideBlock] = &[
    Paragraph(
        "Think about what content your MOOC will include and how to structure it into a cohesive whole. Use the principle of scaffolding when you decide the order of the topics.",
    ),
    Paragraph(
        "Before you work on the course structure, plan which content is relevant to include by dividing it into three groups:",
    ),
    BulletList(&[
        "Must know, about 80 % of the content: what every student has to learn.",
        "Should know, about 15 % of the content.",
        "Nice to know, about 5 % of the content.",
    ]),
    Paragraph(
        "Then plan the chapters. Each chapter has an introduction, a few topics and a conclusion. When the course structure is ready, the planner can create the course on mooc.fi with one chapter per planned chapter and one page per topic. You can edit the structure in the editor afterwards.",
    ),
];

const CONTENT_FORMATS: &[GuideBlock] = &[
    Heading("Multimodality"),
    Paragraph(
        "Multimodality in a MOOC means supporting learning through multiple formats, such as text, video, audio, visuals, quizzes, discussions, simulations and downloadable resources. Using more than one mode can make complex ideas clearer, improve engagement and accessibility, and let learners review content in ways that suit their needs, devices, languages and internet access.",
    ),
    Paragraph(
        "Choose each format for a clear pedagogical purpose: videos for explanation or demonstration, text for detail and reference, visuals for structure or relationships, and activities for practice and feedback. Keep materials concise, consistent, accessible and aligned with the learning outcomes. Avoid adding media only for variety or repeating the same information in several formats.",
    ),
    Heading("Text"),
    Paragraph(
        "Use a writing style that suits the target group and avoid unnecessary jargon. Explain key concepts briefly or use the glossary feature of mooc.fi. Keep pages concise and easy to read, with clear headings and only relevant information. As a general guideline, aim for about 1,500 to 2,000 words per page. Check the language and consistency before publishing.",
    ),
    Heading("Infographics"),
    Paragraph(
        "Use infographics to visualise key information, relationships or processes. Keep them simple, readable and consistent with the course's visual identity.",
    ),
    Heading("Photos"),
    Paragraph(
        "Use photos only when they support learning or clarify the content, not as decoration.",
    ),
    Heading("Videos"),
    Paragraph(
        "MOOC videos should be short, focused and clearly connected to the learning outcomes. Aim for 5 to 10 minutes and one main idea per video. Use videos when they add pedagogical value: explaining key concepts, demonstrating processes, presenting expert perspectives or supporting engagement. Common types are interviews, panel discussions and short animations. Plan the purpose, format, script, length, visuals and accessibility, including captions and transcripts, and edit longer discussions into shorter thematic parts.",
    ),
    Heading("Podcast"),
    Paragraph(
        "MOOC podcasts should be focused, well structured and connected to the learning outcomes. Aim for episodes of about 20 to 30 minutes. Use podcasts for expert conversations, learner reflections, case examples, stories, debates or summaries of key themes. Plan each episode with a clear topic, introduction, main points and key takeaways.",
    ),
    Heading("ThingLink"),
    Paragraph(
        "Use ThingLink to create interactive visual learning experiences, such as annotated images, maps, timelines, diagrams, virtual tours or case environments. It is most useful when interactivity helps learners understand relationships, contexts or layered information better than a static image or long text. Keep the structure simple, use clear labels and avoid overloading one image with tags. Make sure the activity is accessible and works on mobile devices.",
    ),
    Heading("Simulations"),
    Paragraph(
        "Use simulations when learners need to experiment, make decisions, practise skills or observe consequences in a safe environment, for example for complex processes, professional scenarios, lab work or cause-and-effect relationships. A simulation needs a clear purpose, a realistic task, instructions, context, learning goals, feedback and room for reflection. Avoid unnecessary complexity.",
    ),
    Heading("AI chatbots"),
    Paragraph(
        "You can add chatbots to courses on mooc.fi. Before adding one, define a clear learning objective and align the chatbot activity with the course content and other assignments.",
    ),
    Heading("Accessibility"),
    Paragraph(
        "Design content and activities so that all learners can participate, regardless of disability, device, location, language skills or internet connection. Provide captions and transcripts for videos and podcasts, alt text for images, a clear structure, readable fonts and colours, keyboard-friendly navigation and materials that work on mobile devices and low bandwidth. Consider accessibility from the beginning rather than adding it at the end. Use clear language, consistent layouts and descriptive links, and never rely only on colour, audio, images or complex interactive tools to communicate important content.",
    ),
];

const EXERCISES: &[GuideBlock] = &[
    Paragraph(
        "There are several types of exercises on mooc.fi, such as essay, multiple choice, closed-ended question, scale and timeline. Depending on the task, each can support different learning types of the ABC framework: acquisition, practice, collaboration, investigation, discussion and production. Exercises need to be aligned with the intended learning outcomes.",
    ),
    Heading("Essay"),
    Paragraph(
        "Essays are highly versatile. Depending on the task, students can practise collaboration, discussion with an AI chatbot, hands-on practice or investigation. Aim for tasks that need skills from the upper levels of Bloom's taxonomy, which also makes them harder to complete with AI alone. You can enable peer review so that students review each other's answers.",
    ),
    Heading("Multiple choice"),
    Paragraph(
        "Multiple-choice exercises are easy to scale, graded automatically and give students immediate feedback. They help learners check their understanding, reinforce key concepts and stay engaged, and they show teachers common misunderstandings, even with a large number of participants.",
    ),
    Heading("Student workload"),
    Paragraph(
        "When you plan the learning types of your course, consider the students' workload, and leave room for thinking and reflection, which the estimates below do not include. Typical time for one activity:",
    ),
    BulletList(&[
        "Acquisition, listening to audio: 10 minutes",
        "Acquisition, watching a video: 5 minutes",
        "Acquisition, reading: 8 minutes (5 to 10)",
        "Discussion: 20 minutes",
        "Collaboration: 30 minutes",
        "Investigation: 45 minutes",
        "Practice: 20 minutes",
        "Production: 60 minutes",
    ]),
    Paragraph(
        "One ECTS credit corresponds to about 27 hours of student work. Compare the total workload of your planned activities to the credits of the course.",
    ),
];

const STYLE_GUIDE: &[GuideBlock] = &[
    Paragraph(
        "To create cohesion and flow, the whole course follows the same style. Decide design details such as when to use italics or bold and which block to use for what. As a rule of thumb, do not use too many types of blocks, and keep each page as simple as possible: too many visual elements cause over-stimulation.",
    ),
    Paragraph("A style guide covers the following items. The examples show one possible choice."),
    BulletList(&[
        "File naming conventions. Example: title, chapter number, page number.",
        "Videos: choose about three styles. Example: short clips of at most 5 minutes, interviews of at most 10 minutes with visual support, panel discussions against a green screen, short animations.",
        "Podcast. Example: about 20 to 30 minutes, 1 or 2 guests, 6 episodes, intro and outro.",
        "Graphics background. Example: transparent. If possible, all graphics are (re)done in the course's colour palette.",
        "Colour palette. Example: #083E61, #66C3FF, #99D7FF, #CCEBFF, #D9F0FF, #E8F6FF.",
        "Punctuation. Example: quotation marks for all quotes.",
        "Font. Example: the platform's default font, Arial elsewhere.",
        "Bulleted lists. Example: items begin with a capital letter and have no punctuation marks.",
        "Capitalization. Example: only the first word of a title is capitalized.",
        "Active and passive voice. Example: active voice, addressing the learner in the second person: \"In this chapter, you will learn about...\"",
        "Writing style. Example: italics for titles of articles, books and films, bold for key words.",
        "References and citations. Example: APA.",
        "Terminology, acronyms and abbreviations. Example: UI = user interface.",
        "Blocks. Example: infobox for stimulation of prior learning, quote for quotes, separator before and after an example, heading 1 for main titles, heading 2 for subtitles, audio for podcasts.",
    ]),
];

const IMPLEMENTATION: &[GuideBlock] = &[
    Paragraph(
        "In the implementation stage, the course design and the developed materials are put into practice: you add the content to the course platform and prepare it for learners. This includes uploading materials, setting up activities and assessments, checking links and media, testing the learner experience and making sure the course works as intended.",
    ),
    Paragraph(
        "You can begin as soon as some content is ready. Follow the style guide. This is especially important when several people add content, as it keeps every part of the course consistent.",
    ),
];

const EVALUATION: &[GuideBlock] = &[
    Paragraph(
        "Plan the evaluation stage well in advance. Once most of the content is on the platform, invite a group of people to take the course and give feedback, and use their feedback to improve the course.",
    ),
    Paragraph(
        "Select the test group carefully. Send them a comprehensive email well in advance, with a registration form for the testing phase, the testing period and clear information about what is expected of them.",
    ),
    Paragraph(
        "Prepare a focused feedback form with only the necessary questions. Also guide the participants to use the feedback button on the platform to report content issues and suggestions.",
    ),
];
