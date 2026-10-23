/**
 * @jest-environment node
 */

import { callBlockValidator } from "@/blockValidator/validatorWorker"

import { startBuiltValidator, stopBlockValidator, validate } from "./runValidator"

interface BlockSchemaBody {
  attributes: Record<string, Record<string, unknown>>
  allowed_parents: string[] | null
  allowed_children: string[] | null
  template: unknown[] | null
  template_lock: string | false | null
  example: { name: string; attributes: Record<string, unknown>; innerBlocks: unknown[] }
}

interface SchemasBody {
  version: string
  page_types: Record<string, string[]>
  course_feature_gated_blocks: Record<string, string>
  rich_text_formats: { name: string; tag: string; description: string }[]
  blocks: Record<string, BlockSchemaBody>
}

let schemas: SchemasBody

beforeAll(async () => {
  await startBuiltValidator()
  const response = await callBlockValidator({ kind: "block-schemas" })
  expect(response.status).toBe(200)
  schemas = response.body as SchemasBody
}, 120_000)
afterAll(stopBlockValidator)

const withClientIds = (example: BlockSchemaBody["example"], prefix: string): unknown => ({
  clientId: prefix,
  name: example.name,
  attributes: example.attributes,
  innerBlocks: (example.innerBlocks as BlockSchemaBody["example"][]).map((child, index) =>
    withClientIds(child, `${prefix}-${index}`),
  ),
})

describe("block schemas", () => {
  it("has a stable content version", async () => {
    const again = await callBlockValidator({ kind: "block-schemas" })
    expect((again.body as SchemasBody).version).toBe(schemas.version)
    expect(schemas.version).toMatch(/^[0-9a-f]{16}$/)
  })

  it("lists the blocks agents may write per page type", () => {
    expect(Object.keys(schemas.page_types).toSorted()).toEqual([
      "chapter-front-page",
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

  it("gives examples that validate as they are", async () => {
    const pageTypeOf = (name: string) =>
      Object.keys(schemas.page_types).find((pageType) =>
        schemas.page_types[pageType]?.includes(name),
      ) ?? "course-page"
    for (const [name, schema] of Object.entries(schemas.blocks)) {
      if (
        schema.allowed_parents?.some((parent) => parent !== "root") ||
        name === "moocfi/exercise"
      ) {
        continue
      }
      const result = await validate([withClientIds(schema.example, "example")], pageTypeOf(name), {
        chapter_locking_enabled: true,
        can_add_chatbot: true,
      })
      expect([name, result.errors]).toEqual([name, []])
    }
  })
})
