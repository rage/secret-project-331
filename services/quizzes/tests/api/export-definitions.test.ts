/**
 * @jest-environment node
 */
import request from "supertest"

import { POST } from "../../src/app/api/export-definitions/route"

import testClient from "./utils/appRouterTestClient"
import {
  generatePrivateSpecWithOneMatrixQuizItem,
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  generatePrivateSpecWithOneTimelineQuizItem,
} from "./utils/privateSpecGenerator"

describe("export-definitions", () => {
  it("exports multiple-choice definitions with only multiple-choice columns", async () => {
    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-definitions").send({
      items: [
        {
          private_spec: generatePrivateSpecWithOneMultipleChoiceQuizItem(),
        },
      ],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(
      expect.arrayContaining([
        "quiz_item_id",
        "quiz_item_type",
        "option_count",
        "option_titles",
        "allow_selecting_multiple_options",
      ]),
    )
    expect(columnKeys).not.toEqual(
      expect.arrayContaining(["timeline_item_1_year", "matrix_row_1_column_1", "min_words"]),
    )
    expect(response.body.results).toHaveLength(1)
    expect(response.body.results[0].rows).toHaveLength(1)
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_type: "multiple-choice",
        option_ids: "id-1 | id-2",
        option_titles: "Positive | Just no",
        correct_option_ids: "id-1",
        correct_option_titles: "Positive",
        allow_selecting_multiple_options: false,
      }),
    )
  })

  it("exports timeline definitions with type-specific data", async () => {
    const privateSpec = generatePrivateSpecWithOneTimelineQuizItem()
    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-definitions").send({
      items: [{ private_spec: privateSpec }],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(
      expect.arrayContaining([
        "timeline_item_count",
        "timeline_summary",
        "timeline_item_1_year",
        "timeline_item_1_correct_event",
      ]),
    )
    expect(columnKeys).not.toEqual(expect.arrayContaining(["timeline_items_json"]))
    expect(response.body.results).toHaveLength(1)
    expect(response.body.results[0].rows).toHaveLength(1)
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_type: "timeline",
        timeline_item_count: 1,
        timeline_summary: "2000: Event 1",
        timeline_item_1_year: "2000",
        timeline_item_1_correct_event: "Event 1",
      }),
    )
  })

  it("exports matrix definitions as dedicated cells instead of JSON", async () => {
    const privateSpec = generatePrivateSpecWithOneMatrixQuizItem()
    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-definitions").send({
      items: [{ private_spec: privateSpec }],
    })

    expect(response.status).toBe(200)
    const columnKeys = response.body.columns.map((column: { key: string }) => column.key)
    expect(columnKeys).toEqual(
      expect.arrayContaining([
        "matrix_active_rows",
        "matrix_active_columns",
        "matrix_summary",
        "matrix_row_1_column_1",
        "matrix_row_2_column_2",
      ]),
    )
    expect(columnKeys).not.toEqual(expect.arrayContaining(["matrix_option_cells_json"]))
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_type: "matrix",
        matrix_active_rows: 2,
        matrix_active_columns: 2,
        matrix_summary: "1 | 2 / 3 | 234223523",
        matrix_row_1_column_1: "1",
        matrix_row_1_column_2: "2",
        matrix_row_2_column_1: "3",
        matrix_row_2_column_2: "234223523",
      }),
    )
  })

  it("fails with invalid payload", async () => {
    const client = testClient(POST)
    await client.post("/api/export-definitions").send({ items: "invalid" }).expect(400)
  })
})
