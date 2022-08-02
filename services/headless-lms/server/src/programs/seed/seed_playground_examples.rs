use chrono::{TimeZone, Utc};
use headless_lms_models::playground_examples::{self, PlaygroundExampleData};

use crate::programs::seed::seed_helpers::seed_connect_to_db;

pub async fn seed_playground_examples() -> anyhow::Result<()> {
    info!("playground examples");
    let mut conn = seed_connect_to_db().await?;
    playground_examples::insert_playground_example(
        &mut conn,
        PlaygroundExampleData {
            name: "Example exercise".to_string(),
            url: "http://project-331.local/example-exercise/iframe".to_string(),
            width: 500,
            data: serde_json::json!([
              {
                "id": "cbf2f43c-dc89-4de5-9b23-688a76b838cd",
                "name": "a"
              },
              {
                "id": "f6386ed9-9bfa-46cf-82b9-77646a9721c6",
                "name": "b"
              },
              {
                "id": "c988be91-caf7-4196-8cf6-18e1ae113a69",
                "name": "c"
              }
            ]),
        },
    )
    .await?;

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
                        "body": "Which of the color codes represent the color **red**?",
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
                        "body": "Which of the color codes represent the color **red**?",
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
                        "body": "Which of the color codes represent the color **red**?",
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
    Ok(())
}
