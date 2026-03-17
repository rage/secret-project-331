/**
 * @jest-environment node
 */
import request from "supertest"

import { POST } from "../../src/app/api/export-answers/route"

import testClient from "./utils/appRouterTestClient"
import {
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  generatePrivateSpecWithOneTimelineQuizItem,
} from "./utils/privateSpecGenerator"

describe("export-answers", () => {
  it("exports quiz answers", async () => {
    const privateSpec = generatePrivateSpecWithOneMultipleChoiceQuizItem()
    const quizItemId = privateSpec.items[0].id

    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-answers").send({
      items: [
        {
          private_spec: privateSpec,
          answer: {
            version: "2",
            itemAnswers: [
              {
                type: "multiple-choice",
                valid: true,
                quizItemId,
                selectedOptionIds: ["id-1"],
              },
            ],
          },
          grading: {
            score_given: 1,
            grading_progress: "FullyGraded",
            feedback_json: [
              {
                quiz_item_id: quizItemId,
                correctnessCoefficient: 1,
              },
            ],
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    expect(response.body.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "quiz_item_id", header: "Quiz item id" }),
      ]),
    )
    expect(response.body.results).toHaveLength(1)
    expect(response.body.results[0].rows).toHaveLength(1)
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: quizItemId,
        quiz_item_title: null,
        answer_type: "multiple-choice",
        answer_value: "id-1",
        answer_value_human_readable: "Positive",
        selected_option_ids: "id-1",
        selected_option_titles: "Positive",
        selected_option_correctness: "correct",
        correctness_coefficient: 1,
        score_given: 1,
        grading_progress: "FullyGraded",
      }),
    )
  })

  it("exports human-readable timeline answers", async () => {
    const privateSpec = generatePrivateSpecWithOneTimelineQuizItem()
    const quizItemId = privateSpec.items[0].id

    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-answers").send({
      items: [
        {
          private_spec: privateSpec,
          answer: {
            version: "2",
            itemAnswers: [
              {
                type: "timeline",
                valid: true,
                quizItemId,
                timelineChoices: [{ timelineItemId: "1", chosenEventId: "event-1" }],
              },
            ],
          },
          grading: {
            score_given: 1,
            grading_progress: "FullyGraded",
            feedback_json: [
              {
                quiz_item_id: quizItemId,
                correctnessCoefficient: 1,
              },
            ],
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    expect(response.body.results).toHaveLength(1)
    expect(response.body.results[0].rows).toHaveLength(1)
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: quizItemId,
        answer_type: "timeline",
        answer_value: JSON.stringify([{ timelineItemId: "1", chosenEventId: "event-1" }]),
        answer_value_human_readable: "2000: Event 1",
        selected_option_ids: null,
        selected_option_titles: null,
        selected_option_correctness: null,
      }),
    )
  })

  it("fails with invalid payload", async () => {
    const client = testClient(POST)
    await client.post("/api/export-answers").send({}).expect(400)
  })
})
