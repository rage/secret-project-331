use chrono::{TimeZone, Utc};
use headless_lms_models::playground_examples::{self, PlaygroundExampleData};

use sqlx::{Pool, Postgres};

pub async fn seed_playground_examples(db_pool: Pool<Postgres>) -> anyhow::Result<()> {
    info!("playground examples");
    let mut conn = db_pool.acquire().await?;
    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes, example, checkbox".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
                "id": "57f03d8e-e768-485c-b0c3-a3e485a3e18a",
                "title": "Internet safety quizz",
                "body": "Answer the following guestions about staying safe on the internet.",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "items": [
                    {
                        "id": "5f09bd92-6e33-415b-b356-227563a02816",
                        "body": "",
                        "type": "checkbox",
                        "multi": false,
                        "order": 1,
                        "title": "The s in https stands for secure.",
                        "quizId": "57f03d8e-e768-485c-b0c3-a3e485a3e18a",
                        "options": [],
                        "maxValue": null,
                        "maxWords": null,
                        "minValue": null,
                        "minWords": null,
                        "direction": "row"
                    },
                    {
                        "id": "818fc326-ed38-4fe5-95d3-0f9d15032d01",
                        "body": "",
                        "type": "checkbox",
                        "multi": false,
                        "order": 2,
                        "title": "I use a strong, unique password that can't easily be guessed by those who knows me.",
                        "quizId": "57f03d8e-e768-485c-b0c3-a3e485a3e18a",
                        "options": [],
                        "maxValue": null,
                        "maxWords": null,
                        "minValue": null,
                        "minWords": null,
                        "direction": "row"
                    },
                ],
                "tries": 1,
                "courseId": "51ee97a7-684f-4cba-8a01-8c558803c4f7",
                "triesLimited": true,
            }),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, row".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
              {
                "id": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
                "body": "Something about CSS and color codes",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about CSS and color codes",
                "tries": 1,
                "triesLimited": false,
                "items": [
                    {
                        "id": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                        "body": "[markdown]Which of the color codes represent the color **red**?[/markdown]",
                        "direction": "row",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": false,
                        "order": 1,
                        "quizId": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                        "title": "Hexadecimal color codes",
                        "type": "multiple-choice",
                        "options": [
                            {
                                "id": "8d17a216-9655-4558-adfb-cf66fb3e08ba",
                                "body": "#00ff00",
                                "order": 1,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "11e0f3ac-fe21-4524-93e6-27efd4a92595",
                                "body": "#0000ff",
                                "order": 2,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "e0033168-9f92-4d71-9c23-7698de9ea3b0",
                                "body": "#663300",
                                "order": 3,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "2931180f-827f-468c-a616-a8df6e94f717",
                                "body": "#ff0000",
                                "order": 4,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "9f5a09d7-c03f-44dd-85db-38065600c2c3",
                                "body": "#ffffff",
                                "order": 5,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                        ]
                    }
                ]
              }
            ),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, column".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
              {
                "id": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
                "body": "Something about CSS and color codes",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about CSS and color codes",
                "tries": 1,
                "triesLimited": false,
                "items": [
                    {
                        "id": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                        "body": "[markdown]Which of the color codes represent the color **red**?[/markdown]",
                        "direction": "column",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": false,
                        "order": 1,
                        "quizId": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                        "title": "Hexadecimal color codes",
                        "type": "multiple-choice",
                        "options": [
                            {
                                "id": "8d17a216-9655-4558-adfb-cf66fb3e08ba",
                                "body": "#00ff00",
                                "order": 1,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "11e0f3ac-fe21-4524-93e6-27efd4a92595",
                                "body": "#0000ff",
                                "order": 2,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "e0033168-9f92-4d71-9c23-7698de9ea3b0",
                                "body": "#663300",
                                "order": 3,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "2931180f-827f-468c-a616-a8df6e94f717",
                                "body": "#ff0000",
                                "order": 4,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "9f5a09d7-c03f-44dd-85db-38065600c2c3",
                                "body": "#ffffff",
                                "order": 5,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                        ]
                    }
                ]
              }
            ),
        },
    )
    .await?;
    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, long text".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
            {
              "id": "fd0221d1-a205-42d0-b187-3ead6a1a0e6e",
              "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
              "body": "Short questions, long answers",
              "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
              "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
              "part": 1,
              "section": 1,
              "title": "General questions",
              "tries": 1,
              "triesLimited": false,
              "items": [
                  {
                      "id": "88ff824f-8aa2-4629-b727-86f98092ab22",
                      "body": "select shortest answer",
                      "direction": "row",
                      "formatRegex": null,
                      "maxLabel": null,
                      "maxValue": null,
                      "maxWords": null,
                      "minLabel": null,
                      "minValue": null,
                      "minWords": null,
                      "multi": false,
                      "order": 1,
                      "quizId": "6160b703-0c27-448b-84aa-1f0d23a037a7",
                      "title": "Choose the short answer",
                      "type": "multiple-choice",
                      "options": [
                          {
                              "id": "d174aecf-bb77-467f-b1e7-92a0e54af29f",
                              "body": "short answer",
                              "order": 1,
                              "title": null,
                              "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                          },
                          {
                              "id": "45a3c513-5dd9-4239-96f1-3dd1f53379cc",
                              "body": "very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long answer",
                              "order": 2,
                              "title": null,
                              "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                          },
                          {
                              "id": "2176ea44-46c6-48d6-a2be-1f8188b06545",
                              "body": "very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long answer",
                              "order": 3,
                              "title": null,
                              "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                          },
                          ]
                      }
                  ]
                }
              ),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice, multi".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
              {
                "id": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                "courseId": "5209f752-9db9-4daf-a7bc-64e21987b719",
                "body": "Something about CSS and color codes",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about CSS and color codes",
                "tries": 1,
                "triesLimited": false,
                "items": [
                    {
                        "id": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                        "body": "[markdown]Which of the color codes represent the color **red**?[/markdown]",
                        "direction": "row",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": true,
                        "order": 1,
                        "quizId": "3ee47b02-ba13-46a7-957e-fd4f21fc290b",
                        "title": "Hexadecimal color codes",
                        "type": "multiple-choice",
                        "options": [
                            {
                                "id": "8d17a216-9655-4558-adfb-cf66fb3e08ba",
                                "body": "#00ff00",
                                "order": 1,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "11e0f3ac-fe21-4524-93e6-27efd4a92595",
                                "body": "#0000ff",
                                "order": 2,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "e0033168-9f92-4d71-9c23-7698de9ea3b0",
                                "body": "#663300",
                                "order": 3,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "2931180f-827f-468c-a616-a8df6e94f717",
                                "body": "#ff0000",
                                "order": 4,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                            {
                                "id": "9f5a09d7-c03f-44dd-85db-38065600c2c3",
                                "body": "#ffffff",
                                "order": 5,
                                "title": null,
                                "quizItemId": "a6bc7e17-dc82-409e-b0d4-08bb8d24dc76",
                            },
                        ]
                    }
                ]
              }
            ),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, essay".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(              {
              "id": "47cbd36c-0c32-41f2-8a4a-b008de7d3494",
              "courseId": "fdf0fed9-7665-4712-9cca-652d5bfe5233",
              "body": "Of CSS and system design of the Noldor",
              "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
              "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
              "part": 1,
              "section": 1,
              "title": "Of CSS and system design of the Noldor",
              "tries": 1,
              "triesLimited": false,
              "items": [
                  {
                      "id": "371b59cb-735d-4202-b8cb-bed967945ffd",
                      "body": "Which color did the Fëanorian lamps emit when Tuor met Gelmir and Arminas at the gate of Annon-in-Gelydh? Give your answer in colors colorname, hexadecimal color code and in RGB color code. Could this have deeper contextual meaning considering the events of the previous chapter? Explain in 500 words.",
                      "direction": "row",
                      "maxLabel": null,
                      "maxValue": null,
                      "maxWords": 600,
                      "minLabel": null,
                      "minValue": null,
                      "minWords": 500,
                      "multi": false,
                      "order": 1,
                      "quizId": "47cbd36c-0c32-41f2-8a4a-b008de7d3494",
                      "title": "Of the lamps of Fëanor",
                      "type": "essay",
                      "options": []
                  }
              ]
            })
        }).await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice dropdown".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
            "id": "1af3cc18-d8d8-4cc6-9bf9-be63d79e19a4",
            "courseId": "32b060d5-78e8-4b97-a933-7458319f30a2",
            "body": null,
            "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
            "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
            "part": 1,
            "section": 1,
            "title": "Questions about CSS and color codes",
            "tries": 1,
            "triesLimited": false,
            "items": [
                {
                    "id": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                    "body": "How many different CSS hexadecimal color codes there are?",
                    "direction": "row",
                    "formatRegex": null,
                    "maxLabel": null,
                    "maxValue": null,
                    "maxWords": null,
                    "minLabel": null,
                    "minValue": null,
                    "minWords": null,
                    "multi": false,
                    "order": 1,
                    "quizId": "1af3cc18-d8d8-4cc6-9bf9-be63d79e19a4",
                    "title": null,
                    "type": "multiple-choice-dropdown",
                    "options": [
                        {
                            "id": "d0514fbb-1081-4602-b564-22dd5374dd46",
                            "body": "at least two",
                            "order": 1,
                            "title": null,
                            "quizItemId": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                        },
                        {
                            "id": "a7a58b81-bd76-4b9a-9060-1516597cb9b7",
                            "body": "more than 2.546 * 10^56",
                            "order": 2,
                            "title": null,
                            "quizItemId": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                        },
                        {
                            "id": "255ff119-1705-4f79-baed-cf8f0c3ca214",
                            "body": "I don't believe in hexadecimal color codes",
                            "order": 3,
                            "title": null,
                            "quizItemId": "37469182-8220-46d3-b3c2-7d215a1bfc03",
                        },
                    ]
                },
                {
                    "id": "da705796-f8e3-420c-a717-a3064e351eed",
                    "body": "What other ways there are to represent colors in CSS?",
                    "direction": "row",
                    "formatRegex": null,
                    "maxLabel": null,
                    "maxValue": null,
                    "maxWords": null,
                    "minLabel": null,
                    "minValue": null,
                    "minWords": null,
                    "multi": false,
                    "order": 1,
                    "quizId": "1af3cc18-d8d8-4cc6-9bf9-be63d79e19a4",
                    "title": null,
                    "type": "multiple-choice-dropdown",
                    "options": [
                        {
                            "id": "dd31dfda-2bf0-4f66-af45-de6ee8ded54a",
                            "body": "RGB -color system",
                            "order": 1,
                            "title": null,
                            "quizItemId": "da705796-f8e3-420c-a717-a3064e351eed",
                        },
                        {
                            "id": "af864a7e-46d5-46c4-b027-413cb4e5fa68",
                            "body": "Human readable text representation",
                            "order": 2,
                            "title": null,
                            "quizItemId": "da705796-f8e3-420c-a717-a3064e351eed",
                        },
                        {
                            "id": "66df5778-f80c-42b4-a544-4fb35d44a80f",
                            "body": "I'm colorblind, so I don't really care :/",
                            "order": 3,
                            "title": null,
                            "quizItemId": "da705796-f8e3-420c-a717-a3064e351eed",
                        },
                    ]
                }
            ]}),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,

        PlaygroundExampleData {
            name: "Quizzes example, open".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
                "id": "801b9275-5034-438d-922f-104af517468a",
                "title": "Open answer question",
                "body": "",
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "items": [
                    {
                        "id": "30cc054a-8efb-4242-9a0d-9acc6ae2ca57",
                        "body": "Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD).",
                        "type": "open",
                        "multi": false,
                        "order": 0,
                        "title": "Date formats",
                        "quizId": "801b9275-5034-438d-922f-104af517468a",
                        "options": [],
                        "maxValue": null,
                        "maxWords": null,
                        "minValue": null,
                        "minWords": null,
                        "direction": "row",
                        "formatRegex": "\\d{4}-\\d{2}-\\d{2}",
                    }
                ],
                "tries": 1,
                "section": 1,
                "courseId": "f6b6a606-e1f8-4ded-a458-01f541c06019",
                "triesLimited": true,
            }),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, scale".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
                "id": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                "title": "The regex quiz",
                "body": "Please answer to the following guestions based on your feelings about using regex. Use the scale 1 = completely disagree, 7 = completely agree",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "items": [
                  {
                    "id": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    "body": "",
                    "type": "scale",
                    "multi": false,
                    "order": 1,
                    "title": "Regex is generally readable.",
                    "quizId": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                    "options": [],
                    "maxValue": 4,
                    "maxWords": null,
                    "minValue": 1,
                    "minWords": null,
                    "direction": "row",
                    "formatRegex": null,
                  },
                  {
                    "id": "b3ce858c-a5ed-4cf7-a9ee-62ef91d1a75a",
                    "body": "",
                    "type": "scale",
                    "multi": false,
                    "order": 2,
                    "title": "Regex is what some people consider to be a 'write-only' language.",
                    "quizId": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                    "options": [],
                    "maxValue": 7,
                    "maxWords": null,
                    "minValue": 1,
                    "minWords": null,
                    "direction": "row",
                    "formatRegex": null,
                  },
                  {
                    "id": "eb7f6898-7ba5-4f89-8e24-a17f57381131",
                    "body": "",
                    "type": "scale",
                    "multi": false,
                    "order": 3,
                    "title": "Regex can be useful when parsing HTML.",
                    "quizId": "3d3c633d-ea60-412f-8c85-8cab7742a5b8",
                    "options": [],
                    "maxValue": 15,
                    "maxWords": null,
                    "minValue": 1,
                    "minWords": null,
                    "direction": "row",
                    "formatRegex": null,
                  }
                ],
                "tries": 1,
                "section": 1,
                "courseId": "f5bed4ff-63ec-44cd-9056-86eb00df84ca",
                "triesLimited": true
              }),
        },
    )
    .await?;

    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, multiple-choice clickable".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!({
              "id": "3562f83c-4d5d-41a9-aceb-a8f98511dd5d",
              "title": "Of favorite colors",
              "body": null,
              "deadline": Utc.ymd(2121,9,1).and_hms(23,59,59).to_string(),
              "open": Utc.ymd(2021,9,1).and_hms(23,59,59).to_string(),
              "part": 1,
              "items": [
                {
                  "id": "d2422f0c-2378-4099-bde7-e1231ceac220",
                  "body": "",
                  "type": "clickable-multiple-choice",
                  "multi": true,
                  "order": 1,
                  "title": "Choose your favorite colors",
                  "quizId": "3562f83c-4d5d-41a9-aceb-a8f98511dd5d",
                  "options": [
                    {
                      "id": "f4ef5add-cfed-4819-b1a7-b1c7a72330ea",
                      "body": "AliceBlue",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "ee6535ca-fed6-4d22-9988-bed91e3decb4",
                      "body": "AntiqueWhite",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "404c62f0-44f2-492c-a6cf-522e5cff492b",
                      "body": "Aqua",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "74e09ced-233e-4db6-a67f-d4835a596956",
                      "body": "Cyan",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "797463cf-9592-46f8-9018-7d2b3d2c0882",
                      "body": "Cornsilk",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "f5e46e15-cb14-455f-8b72-472fed50d6f8",
                      "body": "LawnGreen",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "2bfea5dd-ad64-456a-8518-c6754bd40a90",
                      "body": "LightGoldenRodYellow",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "d045ec97-a89a-4964-9bea-a5baab69786f",
                      "body": "MediumSpringGreen",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "fc901148-7d65-4150-b077-5dc53947ee7a",
                      "body": "Sienna",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                    {
                      "id": "73a8f612-7bd4-48ca-9dae-2baa1a55a1da",
                      "body": "WhiteSmoke",
                      "order": 1,
                      "title": null,
                      "quizItemId": "d2422f0c-2378-4099-bde7-e1231ceac220",
                    },
                  ],
                  "maxValue": 4,
                  "maxWords": null,
                  "minValue": 1,
                  "minWords": null,
                  "direction": "row",
                  "formatRegex": null,
                },
              ],
              "tries": 1,
              "section": 1,
              "courseId": "f5bed4ff-63ec-44cd-9056-86eb00df84ca",
              "triesLimited": true
            }),
        },
    )
    .await?;

    let array = vec![vec![0; 6]; 6];
    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Quizzes example, matrix".to_string(),
            url: "http://project-331.local/quizzes/iframe".to_string(),
            width: 500,
            data: serde_json::json!(
            {
                "id": "91cf86bd-39f1-480f-a16c-5b0ad36dc787",
                "courseId": "2764d02f-bea3-47fe-9529-21c801bdf6f5",
                "body": "Something about matrices and numbers",
                "deadline": Utc.ymd(2121, 9, 1).and_hms(23, 59, 59).to_string(),
                "open": Utc.ymd(2021, 9, 1).and_hms(23, 59, 59).to_string(),
                "part": 1,
                "section": 1,
                "title": "Something about matrices and numbers",
                "tries": 1,
                "triesLimited": true,
                "items": [
                    {
                        "id": "b17f3965-2223-48c9-9063-50f1ebafcf08",
                        "body": "Create a matrix that represents 4x4",
                        "direction": "row",
                        "formatRegex": null,
                        "maxLabel": null,
                        "maxValue": null,
                        "maxWords": null,
                        "minLabel": null,
                        "minValue": null,
                        "minWords": null,
                        "multi": false,
                        "order": 1,
                        "quizId": "91cf86bd-39f1-480f-a16c-5b0ad36dc787",
                        "title": "Matrices are interesting",
                        "type": "matrix",
                        "options": [],
                        "optionCells": array,
                        }
                        ]}),
        },
    )
    .await?;
    Ok(())
}
