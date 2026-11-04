/* oxlint-disable i18next/no-literal-string */

import { createHash } from "crypto"

import { getBlockType, getBlockTypes } from "@wordpress/blocks"

import { insertableBlockNames } from "@/blocks/pageTypeBlocks"
import {
  ALL_COURSE_FEATURES,
  COURSE_FEATURE_GATES,
  PAGE_TYPES,
  type PageType,
} from "@/blocks/pageTypes"
import type { BlockSchemas, CourseBlockFeature } from "@/generated/api/types.generated"
import type { AttributeSchema, RichTextFormat } from "@/utils/Gutenberg/agentSchema"
import { hasInnerBlocksArea } from "@/utils/Gutenberg/innerBlocksArea"
import type { BlockType, Template, TemplateLock } from "@/utils/Gutenberg/types"

import { blockAttributeSchemas } from "./attributeSchemas"
import { type ExampleBlock, pageTypeOf, withClientIds, withoutClientIds } from "./exampleBlocks"
import { RICH_TEXT_FORMATS, TOOLBAR_FORMATS } from "./richText"
import {
  BLOCKS_AGENTS_MAY_NOT_WRITE,
  EXERCISE_BLOCK,
  MAX_REQUEST_BYTES,
  ROOT_PARENT,
  validateBlocks,
} from "./validateBlocks"

export interface BlockSchema {
  title: string
  description: string
  attributes: Record<string, AttributeSchema>
  /** Null: anywhere the parent allows. "root" means the top level of the page. */
  allowed_parents: string[] | null
  /** Null: any block the page allows; []: no inner blocks. */
  allowed_children: string[] | null
  template: ExampleBlock[] | null
  template_lock: TemplateLock | null
  example: ExampleBlock
}

/** The block schema export as built here; extending the protocol type keeps them in agreement. */
export interface BlockSchemasDocument extends BlockSchemas {
  page_types: Record<PageType, string[]>
  course_feature_gated_blocks: Record<string, CourseBlockFeature>
  rich_text_formats: { name: RichTextFormat; tag: string; description: string }[]
  blocks: Record<string, BlockSchema>
}

const EXAMPLE_TEXT = "Example text."

/** Pages hold only an exercise reference; the editor's template is for the exercise editor. */
const EXERCISE_BLOCK_SCHEMA: BlockSchema = {
  title: "Exercise",
  description:
    "A reference to an exercise stored outside the page. Agents can't create or edit exercises yet; they can only move, copy or remove an existing exercise block, kept exactly as read.",
  attributes: { id: { type: "string", description: "The exercise's id, as read from the page." } },
  allowed_parents: ["root"],
  allowed_children: [],
  template: null,
  template_lock: null,
  example: {
    name: EXERCISE_BLOCK,
    attributes: { id: "00000000-0000-4000-8000-000000000000" },
    innerBlocks: [],
  },
}

/** Template attributes the registration knows; createBlock drops the rest, so the editor does too. */
const registeredAttributes = (
  name: string,
  attributes: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const registered = (getBlockType(name) as BlockType | undefined)?.attributes ?? {}
  return Object.fromEntries(Object.entries(attributes ?? {}).filter(([key]) => key in registered))
}

/** A template as blocks; `leaf` builds the entries that have no inner template. */
const templateBlocks = (
  template: Template[],
  leaf = (name: string, attributes: Record<string, unknown>): ExampleBlock => ({
    name,
    attributes,
    innerBlocks: [],
  }),
): ExampleBlock[] =>
  template.map(([name, templateAttributes, innerTemplate]) => {
    const attributes = registeredAttributes(name, templateAttributes)
    return innerTemplate && innerTemplate.length > 0
      ? { name, attributes, innerBlocks: templateBlocks(innerTemplate as Template[], leaf) }
      : leaf(name, attributes)
  })

const exampleAttributes = (attributes: Record<string, AttributeSchema>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(attributes)
      .filter(([, schema]) => schema["x-rich-text"] && schema.default === undefined)
      .map(([key]) => [key, EXAMPLE_TEXT]),
  )

/** A block with every rich-text field filled and the inner blocks the editor would create. */
const minimalExample = (blockType: BlockType, enclosingNames: string[] = []): ExampleBlock => {
  const attributes = blockAttributeSchemas(blockType).writable
  const childExample = (name: string, childAttributes: Record<string, unknown> = {}) => {
    const childType = getBlockType(name) as BlockType | undefined
    const example =
      childType && !enclosingNames.includes(name)
        ? minimalExample(childType, [blockType.name, ...enclosingNames])
        : { name, attributes: {}, innerBlocks: [] }
    return { ...example, attributes: { ...example.attributes, ...childAttributes } }
  }
  const template = blockType.innerBlocksArea?.template
  const firstAllowedChild = blockType.allowedBlocks?.[0]
  return {
    name: blockType.name,
    attributes: exampleAttributes(attributes),
    innerBlocks: template
      ? templateBlocks(template, childExample)
      : firstAllowedChild
        ? [childExample(firstAllowedChild)]
        : [],
  }
}

/** An example as stored, normalised through the validator, wrapped in a parent where it must be. */
const validatedExample = (
  example: ExampleBlock,
  blockType: BlockType,
  pageTypes: Record<PageType, string[]>,
): ExampleBlock => {
  const pageType = pageTypeOf(pageTypes, example.name)
  const parentName = blockType.parent?.find((name) => name !== ROOT_PARENT)
  const wrapped = parentName
    ? { name: parentName, attributes: {}, innerBlocks: [example] }
    : example
  const result = validateBlocks({
    pages: [{ page_type: pageType, blocks: withClientIds([wrapped], "example") }],
    course_features: ALL_COURSE_FEATURES,
  })
  const page = result.status === 200 ? result.body.pages[0] : undefined
  if (!page || page.errors.length > 0) {
    return example
  }
  const [normalised] = withoutClientIds(page.blocks)
  if (!normalised) {
    return example
  }
  return parentName ? (normalised.innerBlocks[0] ?? example) : normalised
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .toSorted()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

/** The block schema export: attribute schemas and nesting rules from the live registrations. */
export const buildBlockSchemas = (): BlockSchemasDocument => {
  const pageTypes = Object.fromEntries(
    PAGE_TYPES.map((pageType) => [
      pageType,
      insertableBlockNames(pageType, ALL_COURSE_FEATURES).filter(
        (name) => !BLOCKS_AGENTS_MAY_NOT_WRITE.has(name),
      ),
    ]),
  ) as Record<PageType, string[]>
  const writableNames = new Set(Object.values(pageTypes).flat())

  const blocks: Record<string, BlockSchema> = {}
  for (const blockType of (getBlockTypes() as BlockType[]).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!writableNames.has(blockType.name)) {
      continue
    }
    if (blockType.name === EXERCISE_BLOCK) {
      blocks[EXERCISE_BLOCK] = EXERCISE_BLOCK_SCHEMA
      continue
    }
    const { writable } = blockAttributeSchemas(blockType)
    const template = blockType.innerBlocksArea?.template
    blocks[blockType.name] = {
      title: blockType.title,
      description: typeof blockType.description === "string" ? blockType.description : "",
      attributes: writable,
      allowed_parents: blockType.parent
        ? blockType.parent.map((name) => (name === ROOT_PARENT ? "root" : name))
        : null,
      allowed_children: Array.isArray(blockType.allowedBlocks)
        ? blockType.allowedBlocks
        : hasInnerBlocksArea(blockType)
          ? null
          : [],
      template: template ? templateBlocks(template) : null,
      template_lock: blockType.innerBlocksArea?.templateLock ?? null,
      example: validatedExample(minimalExample(blockType), blockType, pageTypes),
    }
  }

  const content = {
    page_types: pageTypes,
    course_feature_gated_blocks: Object.fromEntries(
      Object.entries(COURSE_FEATURE_GATES).map(([name, { setting }]) => [name, setting]),
    ),
    rich_text_formats: TOOLBAR_FORMATS.map((name) => ({
      name,
      tag: RICH_TEXT_FORMATS[name].tag,
      description: RICH_TEXT_FORMATS[name].markup,
    })),
    blocks,
    max_request_bytes: MAX_REQUEST_BYTES,
  }
  return {
    version: createHash("sha256").update(stableStringify(content)).digest("hex").slice(0, 16),
    ...content,
  }
}
