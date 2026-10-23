/**
 * @jest-environment node
 */

import { ALL_COURSE_FEATURES } from "@/blocks/pageTypes"
import { BLOCK_REFINEMENTS } from "@/blockValidator/attributeRefinements"
import type { BlockSchemasDocument } from "@/blockValidator/blockSchemas"
import { pageTypeOf, withClientIds } from "@/blockValidator/exampleBlocks"
import { callBlockValidator } from "@/blockValidator/validatorWorker"
import type { AttributeSchema } from "@/utils/Gutenberg/agentSchema"

import { startBuiltValidator, stopBlockValidator, validate } from "./runValidator"

let schemas: BlockSchemasDocument

beforeAll(async () => {
  await startBuiltValidator()
  const response = await callBlockValidator({ kind: "block-schemas" })
  expect(response.status).toBe(200)
  schemas = response.body as BlockSchemasDocument
}, 120_000)
afterAll(stopBlockValidator)

/** Blocks that can be validated alone at the top level of a page. */
const topLevelBlocks = () =>
  Object.entries(schemas.blocks).filter(
    ([name, schema]) =>
      !schema.allowed_parents?.some((parent) => parent !== "root") && name !== "moocfi/exercise",
  )

describe("block schemas", () => {
  it("has a stable content version", async () => {
    const again = await callBlockValidator({ kind: "block-schemas" })
    expect((again.body as BlockSchemasDocument).version).toBe(schemas.version)
    expect(schemas.version).toMatch(/^[0-9a-f]{16}$/)
  })

  it("lists the blocks agents may write per page type", () => {
    expect(Object.keys(schemas.page_types).toSorted()).toEqual([
      "course-front-page",
      "course-page",
      "top-level-page",
    ])
    expect(schemas.page_types["course-page"]).toContain("moocfi/exercise")
    expect(schemas.page_types["course-front-page"]).toContain("moocfi/landing-page-hero-section")
    expect(schemas.page_types["top-level-page"]).toContain("moocfi/hero-section")
    for (const names of Object.values(schemas.page_types)) {
      expect(names).not.toContain("core/html")
      expect(names).not.toContain("moocfi/unsupported-block-type")
      expect(names).not.toContain("moocfi/exercise-task")
    }
    expect(schemas.course_feature_gated_blocks).toEqual({
      "moocfi/lock-chapter": "chapter_locking_enabled",
      "moocfi/chatbot": "can_add_chatbot",
    })
  })

  it("applies every core block refinement to a registered attribute", () => {
    // Query fields are keyed `<block>.<attribute>.<field>`, and sit under the array's items.
    const exportedSchema = (key: string): AttributeSchema | undefined => {
      const [blockName = "", attributeName = "", ...fields] = key.split(".")
      let schema = schemas.blocks[blockName]?.attributes[attributeName]
      for (const field of fields) {
        schema = schema?.items?.properties?.[field]
      }
      return schema
    }
    for (const [key, refinement] of Object.entries(BLOCK_REFINEMENTS)) {
      expect([key, exportedSchema(key)]).toEqual([key, expect.objectContaining(refinement)])
    }
  })

  it("describes rich-text formats and marks rich-text attributes", () => {
    expect(schemas.rich_text_formats.map(({ name, tag }) => [name, tag])).toContainEqual([
      "core/bold",
      "strong",
    ])
    expect(schemas.rich_text_formats.map(({ name }) => name)).not.toContain("core/image")
    expect(schemas.blocks["core/paragraph"]?.attributes.content).toMatchObject({
      type: "string",
      "x-rich-text": true,
    })
    expect(schemas.blocks["core/button"]?.attributes.text?.["x-rich-text-formats"]).not.toContain(
      "core/link",
    )
    expect(schemas.blocks["moocfi/hero-section"]?.attributes.label).toMatchObject({
      "x-rich-text": true,
    })
  })

  it("leaves out attributes agents may not write", () => {
    expect(schemas.blocks["core/paragraph"]?.attributes).not.toHaveProperty("style")
    expect(schemas.blocks["core/paragraph"]?.attributes).not.toHaveProperty("metadata")
    expect(schemas.blocks["core/image"]?.attributes).not.toHaveProperty("blob")
  })

  it("carries nesting rules from the registrations", () => {
    expect(schemas.blocks["moocfi/flip-card"]).toMatchObject({
      allowed_children: ["moocfi/front-card", "moocfi/back-card"],
      template_lock: "all",
    })
    expect(schemas.blocks["moocfi/exercise"]?.allowed_parents).toEqual(["root"])
    expect(schemas.blocks["core/list-item"]?.allowed_parents).toEqual(["core/list"])
    expect(schemas.blocks["core/paragraph"]?.allowed_children).toEqual([])
    expect(schemas.blocks["moocfi/aside"]?.allowed_children).toBeNull()
  })

  it("describes exercise blocks as the id-only reference agents may keep", () => {
    expect(schemas.blocks["moocfi/exercise"]).toMatchObject({
      attributes: { id: { type: "string" } },
      allowed_children: [],
      template: null,
      template_lock: null,
      example: { name: "moocfi/exercise", innerBlocks: [] },
    })
    expect(Object.keys(schemas.blocks["moocfi/exercise"]?.example.attributes ?? {})).toEqual(["id"])
    expect(schemas.blocks["moocfi/exercise"]?.description).toContain("can't create or edit")
  })

  it("gives examples that validate as they are", async () => {
    for (const [name, schema] of topLevelBlocks()) {
      const result = await validate(
        withClientIds([schema.example], "example"),
        pageTypeOf(schemas.page_types, name),
        {},
        { ...ALL_COURSE_FEATURES },
      )
      expect([name, result.errors]).toEqual([name, []])
    }
  })

  it("accepts every attribute's registered default when written out", async () => {
    for (const [name, schema] of topLevelBlocks()) {
      const defaults = Object.fromEntries(
        Object.entries(schema.attributes)
          .filter(([, attribute]) => attribute.default !== undefined)
          .map(([key, attribute]) => [key, attribute.default]),
      )
      const example = {
        ...schema.example,
        attributes: { ...schema.example.attributes, ...defaults },
      }
      const result = await validate(
        withClientIds([example], "defaults"),
        pageTypeOf(schemas.page_types, name),
        {},
        { ...ALL_COURSE_FEATURES },
      )
      expect([name, result.errors]).toEqual([name, []])
    }
  })
})
