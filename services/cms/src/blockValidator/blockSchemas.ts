/* oxlint-disable i18next/no-literal-string */

import { createHash } from "crypto"

import { getBlockType, getBlockTypes } from "@wordpress/blocks"

import {
  COURSE_FEATURE_GATED_BLOCKS,
  insertableBlockNames,
  PAGE_TYPES,
  type PageType,
} from "@/blocks/pageTypeBlocks"
import type { BlockType, Template, TemplateLock } from "@/utils/Gutenberg/types"

import { type AttributeSchema, blockAttributeSchemas } from "./attributeSchemas"
import { RICH_TEXT_FORMAT_MARKUP, type RichTextFormat, TOOLBAR_FORMATS } from "./richText"
import { validateBlocks } from "./validateBlocks"

interface ExampleBlock {
  name: string
  attributes: Record<string, unknown>
  innerBlocks: ExampleBlock[]
}

interface BlockSchema {
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

export interface BlockSchemasDocument {
  version: string
  page_types: Record<PageType, string[]>
  course_feature_gated_blocks: Record<string, string>
  rich_text_formats: { name: RichTextFormat; tag: string; description: string }[]
  blocks: Record<string, BlockSchema>
}

const FORMAT_TAGS: Record<RichTextFormat, string> = {
  "core/bold": "strong",
  "core/italic": "em",
  "core/link": "a",
  "core/code": "code",
  "core/strikethrough": "s",
  "core/underline": "span",
  "core/text-color": "mark",
  "core/subscript": "sub",
  "core/superscript": "sup",
  "core/keyboard": "kbd",
  "core/language": "bdo",
  "core/math": "math",
}

const FEATURE_SETTING_NAMES: Record<string, string> = {
  chapterLockingEnabled: "chapter_locking_enabled",
  canAddChatbot: "can_add_chatbot",
}

const EXAMPLE_TEXT = "Example text."

/** Template attributes the registration knows; createBlock drops the rest, so the editor does too. */
const registeredAttributes = (
  name: string,
  attributes: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const registered = (getBlockType(name) as BlockType | undefined)?.attributes ?? {}
  return Object.fromEntries(Object.entries(attributes ?? {}).filter(([key]) => key in registered))
}

const templateBlocks = (template: Template[]): ExampleBlock[] =>
  template.map(([name, attributes, innerTemplate]) => ({
    name,
    attributes: registeredAttributes(name, attributes),
    innerBlocks: templateBlocks((innerTemplate ?? []) as Template[]),
  }))

const exampleAttributes = (attributes: Record<string, AttributeSchema>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(attributes)
      .filter(([, schema]) => schema["x-rich-text"] && schema.default === undefined)
      .map(([key]) => [key, EXAMPLE_TEXT]),
  )

/** Pages where a block can be written, for picking a page type an example is valid on. */
const pageTypesOf = (pageTypes: Record<PageType, string[]>, name: string): PageType[] =>
  PAGE_TYPES.filter((pageType) => pageTypes[pageType].includes(name))

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
  const fromTemplate = (template: Template[]): ExampleBlock[] =>
    template.map(([name, templateAttributes, innerTemplate]) =>
      innerTemplate && innerTemplate.length > 0
        ? {
            name,
            attributes: registeredAttributes(name, templateAttributes),
            innerBlocks: fromTemplate(innerTemplate as Template[]),
          }
        : childExample(name, registeredAttributes(name, templateAttributes)),
    )
  const template = blockType.innerBlocksArea?.template
  const firstAllowedChild = blockType.allowedBlocks?.[0]
  return {
    name: blockType.name,
    attributes: exampleAttributes(attributes),
    innerBlocks: template
      ? fromTemplate(template)
      : firstAllowedChild
        ? [childExample(firstAllowedChild)]
        : [],
  }
}

const withClientIds = (blocks: ExampleBlock[], prefix: string): unknown[] =>
  blocks.map((block, index) => ({
    clientId: `${prefix}-${index}`,
    name: block.name,
    attributes: block.attributes,
    innerBlocks: withClientIds(block.innerBlocks, `${prefix}-${index}`),
  }))

const withoutClientIds = (blocks: unknown[]): ExampleBlock[] =>
  (blocks as (ExampleBlock & { clientId?: string; isValid?: boolean })[]).map((block) => ({
    name: block.name,
    attributes: block.attributes,
    innerBlocks: withoutClientIds(block.innerBlocks),
  }))

/** An example as stored, normalised through the validator, wrapped in a parent where it must be. */
const validatedExample = (
  example: ExampleBlock,
  blockType: BlockType,
  pageTypes: Record<PageType, string[]>,
): ExampleBlock => {
  const pageType = pageTypesOf(pageTypes, example.name)[0] ?? "course-page"
  const parentName = blockType.parent?.find((name) => name !== "core/post-content")
  const wrapped = parentName
    ? { name: parentName, attributes: {}, innerBlocks: [example] }
    : example
  const result = validateBlocks({
    page_type: pageType,
    blocks: withClientIds([wrapped], "example"),
    chapter_locking_enabled: true,
    can_add_chatbot: true,
  })
  if (result.status !== 200 || !result.body.valid) {
    return example
  }
  const [normalised] = withoutClientIds(result.body.blocks)
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
  const allFeatures = { chapterLockingEnabled: true, canAddChatbot: true }
  // Blocks agents may not write are dropped by asking the validator, not by keeping a second list.
  const pageTypes = Object.fromEntries(
    PAGE_TYPES.map((pageType) => [
      pageType,
      insertableBlockNames(pageType, allFeatures).filter((name) => {
        const result = validateBlocks({
          page_type: pageType,
          blocks: [{ clientId: "probe", name, attributes: {}, innerBlocks: [] }],
          chapter_locking_enabled: true,
          can_add_chatbot: true,
        })
        return (
          result.status === 200 &&
          !result.body.errors.some(
            (error) => error.code === "not_allowed_here" && error.path[0] === "name",
          )
        )
      }),
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
    const { writable } = blockAttributeSchemas(blockType)
    const template = blockType.innerBlocksArea?.template
    const hasArea =
      Array.isArray(blockType.allowedBlocks) ||
      blockType.innerBlocksArea !== undefined ||
      (blockType.supports as Record<string, unknown> | undefined)?.allowedBlocks === true
    blocks[blockType.name] = {
      title: blockType.title,
      description: typeof blockType.description === "string" ? blockType.description : "",
      attributes: writable,
      allowed_parents: blockType.parent
        ? blockType.parent.map((name) => (name === "core/post-content" ? "root" : name))
        : null,
      allowed_children: Array.isArray(blockType.allowedBlocks)
        ? blockType.allowedBlocks
        : hasArea
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
      Object.entries(COURSE_FEATURE_GATED_BLOCKS).map(([name, feature]) => [
        name,
        FEATURE_SETTING_NAMES[feature] ?? feature,
      ]),
    ),
    rich_text_formats: TOOLBAR_FORMATS.map((name) => ({
      name,
      tag: FORMAT_TAGS[name],
      description: RICH_TEXT_FORMAT_MARKUP[name],
    })),
    blocks,
  }
  return {
    version: createHash("sha256").update(stableStringify(content)).digest("hex").slice(0, 16),
    ...content,
  }
}
