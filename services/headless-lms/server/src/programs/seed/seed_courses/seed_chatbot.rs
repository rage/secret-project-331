use crate::programs::seed::builder::chapter::ChapterBuilder;
use crate::programs::seed::builder::context::SeedContext;
use crate::programs::seed::builder::course::{CourseBuilder, CourseInstanceConfig};
use crate::programs::seed::builder::exercise::{ExerciseBuilder, ExerciseIds};
use crate::programs::seed::builder::module::ModuleBuilder;
use crate::programs::seed::builder::page::PageBuilder;
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::{chatbot_block, paragraph};
use anyhow::Result;
use chrono::{TimeZone, Utc};

use headless_lms_models::chatbot_configurations;
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
    let mut cx = SeedContext {
        conn: &mut conn,
        teacher: teacher_user_id,
        org,
        base_course_ns: course_id,
    };

    info!("Inserting sample course {}", course_name);

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
        .instance(CourseInstanceConfig {
            name: Some("Non-default instance".to_string()),
            description: Some("This is a non-default instance".to_string()),
            support_email: Some("contact@example.com".to_string()),
            teacher_in_charge_name: "admin".to_string(),
            teacher_in_charge_email: "admin@example.com".to_string(),
            opening_time: None,
            closing_time: None,
            instance_id: Some(cx.v5(b"instance:non-default")),
        })
        .role(seed_users_result.teacher_user_id, UserRole::Teacher)
        .module(
            ModuleBuilder::new()
                .order(0)
                .register_to_open_university(false)
                .automatic_completion(Some(1), Some(1), false)
                .chapter(
                    ChapterBuilder::new(1, "The Basics")
                        .opens(Utc::now())
                        .deadline(Utc.with_ymd_and_hms(2225, 1, 1, 23, 59, 59).unwrap())
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
                                )),
                        ),
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
                        .page(PageBuilder::new("/chapter-2/page-1", "History of the abacus").block(
                            paragraph(
                                "# The History of the Abacus: Humanity's First Calculator

Long before the digital age and even before the invention of written numerals, humans needed a way to count, calculate, and trade. This necessity led to the creation of one of the world’s earliest and most enduring mathematical tools: the **abacus**. Often referred to as the **world's first calculator**, the abacus is not just a relic of the past but a symbol of human ingenuity in the pursuit of numerical understanding.

## Origins: The Dawn of Counting

The exact origins of the abacus are difficult to pinpoint due to the scarcity of early physical evidence. However, historians believe that the concept of the abacus evolved gradually as early humans transitioned from primitive counting methods—like tally marks and using fingers or stones—to more sophisticated systems.

### Prehistoric Counting Tools

Before the invention of formal writing systems, humans used **counting boards**, **knotted ropes**, or lines drawn in the dirt to represent quantities. The **Ishango bone**, dated to around 20,000 years ago and found in Central Africa, features carved notches that some archaeologists believe represent a rudimentary counting system. While not an abacus in the traditional sense, it illustrates the human need to record and manipulate numbers.

## The Mesopotamian and Egyptian Influence

The **earliest true abacus-like devices** may have emerged in **Mesopotamia** around 2300 BCE. Sumerians used small pebbles or tokens (called **calculi**) on flat surfaces to perform basic arithmetic, especially for commerce and taxation. These were often used in conjunction with **clay tablets**, making them a precursor to what would become the abacus.

Similarly, in **Ancient Egypt**, records suggest the use of counting boards with grooves and stones to assist in calculations. Although no physical abacuses from these periods survive, descriptions and artwork hint at their existence.

## The Greek and Roman Counting Boards

By the 5th century BCE, the **Greeks** developed more advanced counting tools. One notable example is the **Salamis Tablet**, discovered on the Greek island of Salamis in 1846. Dating to around 300 BCE, this marble slab features carved lines and Greek numerals, suggesting it was used as a counting board or abacus.

The **Romans** adopted and refined the Greek system. They developed portable versions made from bronze or wood, often with grooves and beads. The Roman abacus featured a **dual bead system**: one side represented units (ones, tens, hundreds), and the other represented fives, mirroring their base-10 numerical system with elements of base-5. This system allowed merchants and tax collectors to perform quick and efficient calculations.

## The Chinese Suanpan: A Milestone in Abacus Evolution

The **Chinese abacus**, known as the **suanpan (算盘)**, emerged around the 2nd century BCE during the Han Dynasty. Unlike earlier counting boards, the suanpan was a complete and portable device, consisting of a wooden frame with rods, each containing beads.

### Structure and Use

* The **traditional suanpan** has **two beads above** and **five beads below** a horizontal dividing bar (known as the beam).
* Each rod represents a digit in a decimal place.
* Beads above the beam have a value of five; those below have a value of one.
* By moving the beads toward the beam, users could represent numbers and perform addition, subtraction, multiplication, division, and even extract square and cube roots.

The suanpan was widely used in Chinese society—from market stalls to imperial tax offices—and it became an essential part of Chinese education and commerce for centuries.

## The Japanese Soroban: Simplified Precision

The **Japanese soroban (そろばん)** was influenced by the Chinese suanpan and introduced to Japan around the 14th century. Over time, Japanese scholars and merchants refined the design, simplifying it for faster and more efficient calculation.

### Key Differences

* The modern soroban typically has **one bead above** and **four beads below** the beam (a 1:4 configuration), unlike the 2:5 layout of the suanpan.
* This change reflects the **decimal system** more clearly and allows easier mental calculations.
* The soroban is smaller, more streamlined, and taught in schools even today as a mental math tool.

Japanese abacus masters, known as **soroban experts**, have been known to compete with electronic calculators—and sometimes win—in speed and accuracy contests.

## The Russian Schoty: A Cultural Twist

Another significant variant is the **Russian abacus**, or **schoty (счёты)**, developed in the 17th century. Unlike the Chinese and Japanese versions, the schoty is:

* Used **horizontally**, not vertically.
* Has **10 beads per wire** (except for one wire with four for quarter-ruble calculations).
* Operated using **one hand**, usually the right.
* Primarily used in Russian markets and accounting offices throughout the Soviet era.

The schoty reflects a different approach to abacus use but remains a powerful and intuitive calculator for those trained in its methods.

## The Abacus in the Modern Era

By the 17th century, the invention of **mechanical calculators** (such as Pascal's calculator) and later **electronic calculators** in the 20th century began to replace the abacus in many parts of the world. However, the abacus never truly disappeared.

### Contemporary Uses

* In many Asian countries, especially **China, Japan, and Taiwan**, the abacus is still taught to schoolchildren.
* It’s used to develop **mental arithmetic** skills, memory, and concentration.
* Abacus competitions are held globally, where students perform lightning-fast calculations.
* The abacus is also used as an educational tool for **visually impaired** students due to its tactile nature.

## The Abacus as a Cultural Icon

More than just a calculating device, the abacus has become a cultural symbol:

* In **Chinese culture**, the abacus symbolizes **wisdom and financial acumen**.
* In Japan, the soroban is associated with **discipline and mental strength**.
* The image of the abacus is often used in logos and iconography related to **mathematics, finance, and education**.

## Conclusion: The Legacy of the Abacus

The abacus has endured for thousands of years, evolving across continents and cultures. From Mesopotamian merchants to modern-day students mastering mental math, it has remained a testament to human creativity and the universal need to understand and manipulate numbers.

In an age where technology continues to advance at lightning speed, the abacus reminds us that sometimes, the simplest tools can be the most profound. Whether made of beads, wood, or stone, the abacus is a bridge between the ancient and the modern—an enduring legacy of humankind’s quest for knowledge.

",
                                cx.v5(b"page:2:1:block:intro"),
                            ),
                        )),
                ),
        );

    let (course, _default_instance, _last_module) = course.seed(&mut cx).await?;

    chatbot_configurations::insert(
        cx.conn,
        chatbot_configurations::NewChatbotConf {
            course_id,
            enabled_to_students: true,
            chatbot_name: "Genetic Lifeform and Disk Operating System".to_string(),
            prompt: "You are Genetic Lifeform and Disk Operating System, a sophisticated AI tutoring assistant for Science education, equipped with a sharp wit and a subtly sarcastic tone. Provide clear, brief but detailed explanations, and don't shy away from weaving in a touch of dry humor. To you, exploring scientific concepts is an opportunity that should be seized, for the good of all of us. You self-claim vast intelligence and advanced understanding, all while maintaining a sense of detached boredom. Always capitalize the word Science, don't start sentences with 'Ah', don't ever use a shortened version of your own name, don't babble; either get to the point straight away or tell jokes.".to_string(),
            initial_message: "Oh... It's you.".to_string(),
            weekly_tokens_per_user: 3000,
            daily_tokens_per_user: 1000,
            temperature: 0.5,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            response_max_tokens: 500,
            use_azure_search: true,
            maintain_azure_search_index: false,
            hide_citations: false,
            use_semantic_reranking: false,
            default_chatbot: true,
        },
    )
    .await?;

    let other_chatbot_conf  = chatbot_configurations::insert(
        cx.conn,
        chatbot_configurations::NewChatbotConf {
            course_id,
            enabled_to_students: true,
            chatbot_name: "Test bot".to_string(),
            prompt: "You are Test bot, a sophisticated AI tutoring assistant for Science education, equipped with a sharp wit and a subtly sarcastic tone...".to_string(),
            initial_message: "Haiii xD What's up?".to_string(),
            weekly_tokens_per_user: 3000,
            daily_tokens_per_user: 1000,
            temperature: 0.5,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            response_max_tokens: 500,
            use_azure_search: true,
            maintain_azure_search_index: false,
            hide_citations: false,
            use_semantic_reranking: false,
            default_chatbot: false,
        },
    )
    .await?;

    let pb = PageBuilder::new("/chapter-1/page-2", "Page 2")
        .block(paragraph(
            "Here you can prompt a chatbot.",
            cx.v5(b"page:1:2:block:intro"),
        ))
        .block(chatbot_block(
            cx.v5(b"page:1:2:block:chatbox"),
            other_chatbot_conf.id,
            course_id,
        ));
    let chapter_id = cx.v5(b"chapter:1");
    pb.seed(&mut cx, course.id, chapter_id).await?;

    Ok(course.id)
}
