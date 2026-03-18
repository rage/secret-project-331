/**
 * @jest-environment node
 */
import request from "supertest"

import { POST } from "../../src/app/api/export-answers/route"

import testClient from "./utils/appRouterTestClient"
import {
  generateEmptyPrivateSpecQuiz,
  generatePrivateSpecWithOneCheckboxQuizItem,
  generatePrivateSpecWithOneEssayQuizItem,
  generatePrivateSpecWithOneMatrixQuizItem,
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  generatePrivateSpecWithOneTimelineQuizItem,
} from "./utils/privateSpecGenerator"

describe("export-answers", () => {
  it("exports multiple-choice answers with the reduced answer columns", async () => {
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
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(
      expect.arrayContaining([
        "quiz_item_id",
        "quiz_item_body",
        "score_given",
        "selected_option_ids",
        "selected_option_titles",
      ]),
    )
    expect(columnKeys).not.toEqual(
      expect.arrayContaining([
        "quiz_title",
        "quiz_item_order",
        "quiz_item_type",
        "quiz_item_title",
        "quiz_item_feedback",
        "correctness_coefficient",
        "grading_progress",
        "selected_option_count",
        "selected_option_correctness",
        "selected_option_feedbacks",
      ]),
    )
    expect(response.body.results).toHaveLength(1)
    expect(response.body.results[0].rows).toHaveLength(1)
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: quizItemId,
        quiz_item_body: null,
        score_given: 1,
        selected_option_ids: "id-1",
        selected_option_titles: "Positive",
      }),
    )
  })

  it("exports timeline answers without summary columns", async () => {
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
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(
      expect.arrayContaining([
        "quiz_item_id",
        "score_given",
        "timeline_item_1_year",
        "timeline_item_1_selected_event",
        "timeline_item_1_was_correct",
      ]),
    )
    expect(columnKeys).not.toEqual(
      expect.arrayContaining(["timeline_item_count", "timeline_answer_summary"]),
    )
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: quizItemId,
        score_given: 1,
        timeline_item_1_year: "2000",
        timeline_item_1_selected_event: "Event 1",
        timeline_item_1_was_correct: true,
      }),
    )
  })

  it("exports essay answers without word counts", async () => {
    const privateSpec = generatePrivateSpecWithOneEssayQuizItem()
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
                type: "essay",
                valid: true,
                quizItemId,
                textData: "Blue because of Rayleigh scattering.",
              },
            ],
          },
          grading: {
            score_given: 1,
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(expect.arrayContaining(["answer_text"]))
    expect(columnKeys).not.toEqual(expect.arrayContaining(["answer_word_count"]))
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: quizItemId,
        score_given: 1,
        answer_text: "Blue because of Rayleigh scattering.",
      }),
    )
  })

  it("exports the task score only once for multi-item quiz submissions", async () => {
    const privateSpec = generateEmptyPrivateSpecQuiz()
    privateSpec.items = [
      {
        type: "essay",
        id: "essay-1",
        order: 0,
        title: "Question 1",
        body: null,
        successMessage: null,
        failureMessage: null,
        messageOnModelSolution: null,
        minWords: null,
        maxWords: null,
      },
      {
        type: "essay",
        id: "essay-2",
        order: 1,
        title: "Question 2",
        body: null,
        successMessage: null,
        failureMessage: null,
        messageOnModelSolution: null,
        minWords: null,
        maxWords: null,
      },
    ]

    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-answers").send({
      items: [
        {
          private_spec: privateSpec,
          answer: {
            version: "2",
            itemAnswers: [
              {
                type: "essay",
                valid: true,
                quizItemId: "essay-1",
                textData: "First",
              },
              {
                type: "essay",
                valid: true,
                quizItemId: "essay-2",
                textData: "Second",
              },
            ],
          },
          grading: {
            score_given: 2,
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    expect(response.body.results[0].rows).toHaveLength(2)
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: "essay-1",
        score_given: 2,
        answer_text: "First",
      }),
    )
    expect(response.body.results[0].rows[1]).toEqual(
      expect.objectContaining({
        quiz_item_id: "essay-2",
        score_given: null,
        answer_text: "Second",
      }),
    )
  })

  it("exports checkbox answers without the readable helper column", async () => {
    const privateSpec = generatePrivateSpecWithOneCheckboxQuizItem()
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
                type: "checkbox",
                valid: true,
                quizItemId,
                checked: true,
              },
            ],
          },
          grading: {
            score_given: 1,
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(expect.arrayContaining(["checked"]))
    expect(columnKeys).not.toEqual(expect.arrayContaining(["checked_readable"]))
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: quizItemId,
        score_given: 1,
        checked: true,
      }),
    )
  })

  it("exports matrix answers as dedicated cells without summary columns", async () => {
    const privateSpec = generatePrivateSpecWithOneMatrixQuizItem()
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
                type: "matrix",
                valid: true,
                quizItemId,
                matrix: [
                  ["A", "B"],
                  ["C", "D"],
                ],
              },
            ],
          },
          grading: {
            score_given: 1,
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(
      expect.arrayContaining([
        "quiz_item_id",
        "score_given",
        "matrix_row_1_column_1",
        "matrix_row_2_column_2",
      ]),
    )
    expect(columnKeys).not.toEqual(
      expect.arrayContaining(["matrix_active_rows", "matrix_active_columns", "matrix_summary"]),
    )
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: quizItemId,
        score_given: 1,
        matrix_row_1_column_1: "A",
        matrix_row_1_column_2: "B",
        matrix_row_2_column_1: "C",
        matrix_row_2_column_2: "D",
      }),
    )
  })

  it("includes answer columns needed by historical submissions even if the current spec changed", async () => {
    const privateSpec = generateEmptyPrivateSpecQuiz()

    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-answers").send({
      items: [
        {
          private_spec: privateSpec,
          answer: {
            version: "2",
            itemAnswers: [
              {
                type: "essay",
                valid: true,
                quizItemId: "removed-item",
                textData: "Legacy answer",
              },
            ],
          },
          grading: {
            score_given: 1,
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(expect.arrayContaining(["answer_text"]))
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_id: "removed-item",
        quiz_item_body: null,
        score_given: 1,
        answer_text: "Legacy answer",
      }),
    )
  })

  it("treats null answer payloads as empty submissions", async () => {
    const privateSpec = generatePrivateSpecWithOneEssayQuizItem()

    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-answers").send({
      items: [
        {
          private_spec: privateSpec,
          answer: null,
          grading: {
            score_given: 0,
          },
          model_solution_spec: null,
        },
      ],
    })

    expect(response.status).toBe(200)
    expect(response.body.results).toHaveLength(1)
    expect(response.body.results[0].rows).toEqual([])
  })

  it("fails with invalid payload", async () => {
    const client = testClient(POST)
    await client.post("/api/export-answers").send({}).expect(400)
  })
})
