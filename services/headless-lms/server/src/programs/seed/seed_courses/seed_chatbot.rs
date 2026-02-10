use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::exercise::{ExerciseBuilder, ExerciseIds};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::{chatbot_block, heading, list, list_item, paragraph};
use anyhow::Result;
use chrono::Utc;

use headless_lms_models::chatbot_configurations::NewChatbotConf;
use headless_lms_models::chatbot_configurations_models;
use headless_lms_models::roles::UserRole;
use serde_json::json;

use tracing::info;
use uuid::Uuid;

use super::super::seed_users::SeedUsersResult;

pub async fn seed_chatbot_course(
    course_id: Uuid,
    course_name: &str,
    course_slug: &str,
    common_course_data: CommonCourseData,
    seed_users_result: SeedUsersResult,
) -> Result<Uuid> {
    let CommonCourseData {
        db_pool,
        organization_id: org,
        teacher_user_id,
        student_user_id: _student,
        langs_user_id: _langs_user_id,
        example_normal_user_ids: _users,
        jwt_key: _jwt_key,
        base_url: _base_url,
    } = common_course_data;

    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };

    info!("Inserting sample course {}", course_name);

    let llm = chatbot_configurations_models::get_default(&mut conn).await?;

    let course = CourseBuilder::new(course_name, course_slug)
        .desc("Sample course for chatbot.")
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
            course_id,
            chatbotconf_id: Some(cx.v5(b"chatbot_config:default")),
            enabled_to_students: true,
            chatbot_name: "Genetic Lifeform and Disk Operating System".to_string(),
            prompt: "You are Genetic Lifeform and Disk Operating System, a sophisticated AI tutoring assistant for Science education, equipped with a sharp wit and a subtly sarcastic tone. Provide clear, brief but detailed explanations, and don't shy away from weaving in a touch of dry humor. To you, exploring scientific concepts is an opportunity that should be seized, for the good of all of us. You self-claim vast intelligence and advanced understanding, all while maintaining a sense of detached boredom. Always capitalize the word Science, don't start sentences with 'Ah', don't ever use a shortened version of your own name, don't babble; either get to the point straight away or tell jokes.".to_string(),
            initial_message: "Oh... It's you.".to_string(),
            use_azure_search: true,
            hide_citations: false,
            model_id: llm.id,
            thinking_model: llm.thinking,
            default_chatbot: true,
            ..Default::default()
        })
        .chatbot_config(NewChatbotConf {
            course_id,
            chatbotconf_id: Some(cx.v5(b"chatbot_config:block")),
            enabled_to_students: true,
            chatbot_name: "Test bot".to_string(),
            prompt: "You are Test bot, a sophisticated AI tutoring assistant for Science education, equipped with a sharp wit and a subtly sarcastic tone...".to_string(),
            initial_message: "Haiii xD What's up?".to_string(),
            use_azure_search: true,
            hide_citations: false,
            model_id: llm.id,
            thinking_model: llm.thinking,
            ..Default::default()})
        .chatbot_config(NewChatbotConf {
            course_id,
            chatbotconf_id: Some(cx.v5(b"chatbot_config:extra")),
            enabled_to_students: true,
            chatbot_name: "Suggestions bot".to_string(),
            prompt: "You are a random test bot. Don't overthink it.".to_string(),
            initial_message: "How are we doing this fine evening?".to_string(),
            use_azure_search: true,
            hide_citations: false,
            model_id: llm.id,
            thinking_model: llm.thinking,
            suggest_next_messages: true,
            initial_suggested_messages: Some(vec!["What is going on?".to_string(), "Tell me more about your fascinating self.".to_string(), "What's the time? What's the time? What's the time? What's the time? What's the time? What's the time? Aaaaaaaaaaaaaaaaaaaaaaaaaaah!".to_string()]),
            ..Default::default()})
        .role(seed_users_result.teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new()
                .order(0)
                .register_to_open_university(false)
                .automatic_completion(Some(1), Some(1), false)
                .chapter(
                    ChapterBuilder::new(1, "The Basics")
                        .opens(Utc::now())
                        .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:instance"))
                        .page(
                            PageBuilder::new("/chapter-1/page-1", "Page One")
                                .block(paragraph(
                                    "This is a simple introduction to the basics.",
                                    cx.v5(b"page:1:1:block:intro"),
                                ))
                                .exercise(ExerciseBuilder::example_exercise(
                                    "Simple multiple choice",
                                    ExerciseIds {
                                        exercise_id: cx.v5(b"exercise:1:1:e"),
                                        slide_id: cx.v5(b"exercise:1:1:s"),
                                        task_id: cx.v5(b"exercise:1:1:t"),
                                        block_id: cx.v5(b"exercise:1:1:b"),
                                    },
                                    vec![paragraph(
                                        "What is 2 + 2?",
                                        cx.v5(b"exercise:1:1:prompt"),
                                    )],
                                    json!([
                                        {
                                            "name": "3",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:1:1:option:1")
                                        },
                                        {
                                            "name": "4",
                                            "correct": true,
                                            "id": cx.v5(b"exercise:1:1:option:2")
                                        },
                                        {
                                            "name": "5",
                                            "correct": false,
                                            "id": cx.v5(b"exercise:1:1:option:3")
                                        }
                                    ]),
                                    false,
                                    None,
                                    None
                                )),
                        )
                        .page(
                          PageBuilder::new("/chapter-1/page-2", "Page 2")
                            .block(chatbot_block(
                                cx.v5(b"page:1:2:block:chatbox"),
                                cx.v5(b"chatbot_config:block"),
                                course_id,
                            )))
                        .page(
                          PageBuilder::new("/chapter-1/page-3", "Page 3")
                            .block(chatbot_block(
                                cx.v5(b"page:1:3:block:chatbox"),
                                cx.v5(b"chatbot_config:extra"),
                                course_id,
                            ))),
                ),
        )
        .module(
            ModuleBuilder::new()
                .order(1)
                .name("Another module")
                .automatic_completion(Some(1), Some(1), false)
                .ects(5.0)
                .chapter(
                    ChapterBuilder::new(2, "Another chapter")
                        .fixed_ids(cx.v5(b"chapter:2"), cx.v5(b"chapter:2:instance"))
                        .page(PageBuilder::new("/chapter-2/page-1", "History of the abacus")
                        .block(heading("The History of the Abacus: Humanity's First Calculator", cx.v5(b"page:2:1:block:intro-heading"), 1))
                        .block(
                            paragraph(
                                "Long before the digital age and even before the invention of written numerals, humans needed a way to count, calculate, and trade. This necessity led to the creation of one of the world’s earliest and most enduring mathematical tools: the **abacus**. Often referred to as the **world's first calculator**, the abacus is not just a relic of the past but a symbol of human ingenuity in the pursuit of numerical understanding.",
                                cx.v5(b"page:2:1:block:intro"),
                            )
                        )
                        .block(
                            heading("Origins: The Dawn of Counting", cx.v5(b"page:2:1:block:origins-heading"), 2)
                        )
                        .block(
                            paragraph(
                                "The exact origins of the abacus are difficult to pinpoint due to the scarcity of early physical evidence. However, historians believe that the concept of the abacus evolved gradually as early humans transitioned from primitive counting methods—like tally marks and using fingers or stones—to more sophisticated systems.", cx.v5(b"page:2:1:block:origins"))
                        )
                        .block(
                            heading("Prehistoric Counting Tools", cx.v5(b"page:2:1:block:prehist-heading"), 3)
                        )
                        .block(paragraph(
                            "Before the invention of formal writing systems, humans used **counting boards**, **knotted ropes**, or lines drawn in the dirt to represent quantities. The **Ishango bone**, dated to around 20,000 years ago and found in Central Africa, features carved notches that some archaeologists believe represent a rudimentary counting system. While not an abacus in the traditional sense, it illustrates the human need to record and manipulate numbers.", cx.v5(b"page:2:1:block:prehist"),)
                        )
                        .block(
                            heading("The Mesopotamian and Egyptian Influence", cx.v5(b"page:2:1:block:meso-heading"), 2)
                        )
                        .block(paragraph(
                            "The **earliest true abacus-like devices** may have emerged in **Mesopotamia** around 2300 BCE. Sumerians used small pebbles or tokens (called **calculi**) on flat surfaces to perform basic arithmetic, especially for commerce and taxation. These were often used in conjunction with **clay tablets**, making them a precursor to what would become the abacus. Similarly, in **Ancient Egypt**, records suggest the use of counting boards with grooves and stones to assist in calculations. Although no physical abacuses from these periods survive, descriptions and artwork hint at their existence.", cx.v5(b"page:2:1:block:meso"),)
                        )
                        .block(
                            heading("The Greek and Roman Counting Boards", cx.v5(b"page:2:1:block:greek-heading"), 2)
                        )
                        .block(paragraph(
                            "By the 5th century BCE, the **Greeks** developed more advanced counting tools. One notable example is the **Salamis Tablet**, discovered on the Greek island of Salamis in 1846. Dating to around 300 BCE, this marble slab features carved lines and Greek numerals, suggesting it was used as a counting board or abacus. The **Romans** adopted and refined the Greek system. They developed portable versions made from bronze or wood, often with grooves and beads. The Roman abacus featured a **dual bead system**: one side represented units (ones, tens, hundreds), and the other represented fives, mirroring their base-10 numerical system with elements of base-5. This system allowed merchants and tax collectors to perform quick and efficient calculations.", cx.v5(b"page:2:1:block:greek"),)
                        )
                        .block(
                            heading("The Chinese Suanpan: A Milestone in Abacus Evolution", cx.v5(b"page:2:1:block:chinese-heading"), 2)
                        )
                        .block(paragraph(
                            "The **Chinese abacus**, known as the **suanpan (算盘)**, emerged around the 2nd century BCE during the Han Dynasty. Unlike earlier counting boards, the suanpan was a complete and portable device, consisting of a wooden frame with rods, each containing beads.", cx.v5(b"page:2:1:block:chinese"),)
                        )
                        .block(
                            heading("Structure and Use", cx.v5(b"page:2:1:block:stru-heading"), 3)
                        )
                        .block(list(cx.v5(b"page:2:1:block:stru-list"), false, vec![
                            list_item(cx.v5(b"page:2:1:block:stru-list1"), "The **traditional suanpan** has **two beads above** and **five beads below** a horizontal dividing bar (known as the beam)."),
                            list_item(cx.v5(b"page:2:1:block:stru-list2"), "Each rod represents a digit in a decimal place."),
                            list_item(cx.v5(b"page:2:1:block:stru-list3"), "Beads above the beam have a value of five; those below have a value of one."),
                            list_item(cx.v5(b"page:2:1:block:stru-list4"), "By moving the beads toward the beam, users could represent numbers and perform addition, subtraction, multiplication, division, and even extract square and cube roots."),
                            ])
                        )
                        .block(paragraph(
                            "The suanpan was widely used in Chinese society—from market stalls to imperial tax offices—and it became an essential part of Chinese education and commerce for centuries.", cx.v5(b"page:2:1:block:stru"),)
                        )
                        .block(
                            heading("The Japanese Soroban: Simplified Precision", cx.v5(b"page:2:1:block:japanese-heading"), 2)
                        )
                        .block(paragraph(
                            "The **Japanese soroban (そろばん)** was influenced by the Chinese suanpan and introduced to Japan around the 14th century. Over time, Japanese scholars and merchants refined the design, simplifying it for faster and more efficient calculation.", cx.v5(b"page:2:1:block:japanese"),)
                        )
                        .block(
                            heading("Key Differences", cx.v5(b"page:2:1:block:key-heading"), 3)
                        )
                        .block(list(cx.v5(b"page:2:1:block:key-list"), false, vec![
                            list_item(cx.v5(b"page:2:1:block:key-list1"), "The modern soroban typically has **one bead above** and **four beads below** the beam (a 1:4 configuration), unlike the 2:5 layout of the suanpan."),
                            list_item(cx.v5(b"page:2:1:block:key-list2"), "This change reflects the **decimal system** more clearly and allows easier mental calculations."),
                            list_item(cx.v5(b"page:2:1:block:key-list3"), "The soroban is smaller, more streamlined, and taught in schools even today as a mental math tool."),
                            ])
                        )
                        .block(paragraph(
                            "Japanese abacus masters, known as **soroban experts**, have been known to compete with electronic calculators—and sometimes win—in speed and accuracy contests.", cx.v5(b"page:2:1:block:key"),)
                        )
                        .block(
                            heading("The Russian Schoty: A Cultural Twist", cx.v5(b"page:2:1:block:russian-heading"), 2)
                        )
                        .block(paragraph(
                            "Another significant variant is the **Russian abacus**, or **schoty (счёты)**, developed in the 17th century. Unlike the Chinese and Japanese versions, the schoty is:", cx.v5(b"page:2:1:block:russian1"),)
                        )
                        .block(list(cx.v5(b"page:2:1:block:russian-list"), false, vec![
                            list_item(cx.v5(b"page:2:1:block:russian-list1"), "Used **horizontally**, not vertically."),
                            list_item(cx.v5(b"page:2:1:block:russian-list2"), "Has **10 beads per wire** (except for one wire with four for quarter-ruble calculations)."),
                            list_item(cx.v5(b"page:2:1:block:russian-list3"), "Operated using **one hand**, usually the right."),
                            list_item(cx.v5(b"page:2:1:block:russian-list4"), "Primarily used in Russian markets and accounting offices throughout the Soviet era.")])
                        )
                        .block(paragraph(
                            "The schoty reflects a different approach to abacus use but remains a powerful and intuitive calculator for those trained in its methods.", cx.v5(b"page:2:1:block:russian2"),)
                        )
                        .block(
                            heading("The Abacus in the Modern Era", cx.v5(b"page:2:1:block:modern-heading"), 2)
                        )
                        .block(paragraph(
                            "By the 17th century, the invention of **mechanical calculators** (such as Pascal's calculator) and later **electronic calculators** in the 20th century began to replace the abacus in many parts of the world. However, the abacus never truly disappeared.", cx.v5(b"page:2:1:block:modern"),)
                        )
                        .block(
                            heading("Contemporary Uses", cx.v5(b"page:2:1:block:conte-heading"), 3)
                        )
                        .block(
                            list(cx.v5(b"page:2:1:block:conte-list"), false, vec![list_item(cx.v5(b"page:2:1:block:conte-list1"), "In many Asian countries, especially **China, Japan, and Taiwan**, the abacus is still taught to schoolchildren."), list_item(cx.v5(b"page:2:1:block:conte-list2"), "It’s used to develop **mental arithmetic** skills, memory, and concentration."), list_item(cx.v5(b"page:2:1:block:conte-list3"), "Abacus competitions are held globally, where students perform lightning-fast calculations."), list_item(cx.v5(b"page:2:1:block:conte-list4"), "The abacus is also used as an educational tool for **visually impaired** students due to its tactile nature.")])
                        )
                        .block(
                            heading("The Abacus as a Cultural Icon", cx.v5(b"page:2:1:block:cultu-heading"), 2)
                        )
                        .block(paragraph(
                            "More than just a calculating device, the abacus has become a cultural symbol:", cx.v5(b"page:2:1:block:cultu"),)
                        )
                        .block(list(cx.v5(b"page:2:1:block:cultu-list"), false, vec![list_item(cx.v5(b"page:2:1:block:cultu-list1"), "In **Chinese culture**, the abacus symbolizes **wisdom and financial acumen**."), list_item(cx.v5(b"page:2:1:block:cultu-list2"), "In Japan, the soroban is associated with **discipline and mental strength**."), list_item(cx.v5(b"page:2:1:block:cultu-list3"), "The image of the abacus is often used in logos and iconography related to **mathematics, finance, and education**.")]))
                        .block(
                            heading("Conclusion: The Legacy of the Abacus", cx.v5(b"page:2:1:block:concl-heading"), 2)
                        )
                        .block(paragraph(
                            "The abacus has endured for thousands of years, evolving across continents and cultures. From Mesopotamian merchants to modern-day students mastering mental math, it has remained a testament to human creativity and the universal need to understand and manipulate numbers. In an age where technology continues to advance at lightning speed, the abacus reminds us that sometimes, the simplest tools can be the most profound. Whether made of beads, wood, or stone, the abacus is a bridge between the ancient and the modern—an enduring legacy of humankind’s quest for knowledge.", cx.v5(b"page:2:1:block:concl"),)
                        )
                    ),
                ),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut conn, &cx).await?;

    Ok(course.id)
}
