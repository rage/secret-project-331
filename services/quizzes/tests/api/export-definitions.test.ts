/**
 * @jest-environment node
 */
import request from "supertest"

import { POST } from "../../src/app/api/export-definitions/route"

import testClient from "./utils/appRouterTestClient"
import {
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  generatePrivateSpecWithOneTimelineQuizItem,
} from "./utils/privateSpecGenerator"

describe("export-definitions", () => {
  it("exports quiz definitions", async () => {
    const client = testClient(POST)
    const response: request.Response = await client.post("/api/export-definitions").send({
      items: [
        {
          private_spec: generatePrivateSpecWithOneMultipleChoiceQuizItem(),
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
        quiz_item_type: "multiple-choice",
        option_ids: "id-1; id-2",
        option_titles: "Positive; Just no",
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
    expect(response.body.results).toHaveLength(1)
    expect(response.body.results[0].rows).toHaveLength(1)
    expect(response.body.results[0].rows[0]).toEqual(
      expect.objectContaining({
        quiz_item_type: "timeline",
        timeline_items_json: JSON.stringify(
          (privateSpec.items[0].type === "timeline" && privateSpec.items[0].timelineItems) || [],
        ),
      }),
    )
  })

  it("fails with invalid payload", async () => {
    const client = testClient(POST)
    await client.post("/api/export-definitions").send({ items: "invalid" }).expect(400)
  })
})
