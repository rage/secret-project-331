/* oxlint-disable i18next/no-literal-string */

import { getBlockType, sanitizeBlockAttributes } from "@wordpress/blocks"

import {
  COURSE_FEATURE_GATED_BLOCKS,
  type CourseBlockFeatures,
  insertableBlockNames,
  PAGE_TYPES,
  type PageType,
} from "@/blocks/pageTypeBlocks"
import { removeUncommonSpacesFromBlocks } from "@/utils/Gutenberg/modifyBlocks"
import type { BlockInstance, BlockType, Template, TemplateLock } from "@/utils/Gutenberg/types"

import { blockAttributeSchemas, type BlockAttributeSchemas } from "./attributeSchemas"
import { type AttributePath, checkAttributeValue } from "./attributeValues"

export type ValidationErrorCode =
  | "invalid_block"
  | "duplicate_client_id"
  | "unknown_block"
  | "not_allowed_here"
  | "invalid_nesting"
  | "invalid_attribute"
  | "forbidden_attribute"
  | "disallowed_markup"

export interface ValidationError {
  /** Null only when the block itself has no usable clientId; `path` then starts at the request. */
  clientId: string | null
  path: AttributePath
  code: ValidationErrorCode
  message: string
  fix: string
}

export interface ValidateBlocksResponse {
  valid: boolean
  blocks: unknown[]
  errors: ValidationError[]
}

export type ValidateBlocksResult =
  | { status: 200; body: ValidateBlocksResponse }
  | { status: 400; body: { error: string } }

/** Blocks the page allow-lists contain that agents still may not write, with the fix to give. */
const BLOCKS_AGENTS_MAY_NOT_WRITE: Record<string, string> = {
  "core/html":
    "Raw HTML blocks aren't accepted. Use paragraphs, headings, lists, tables or other blocks instead.",
  "core/block":
    "Reusable blocks have nothing to refer to in this system. Write the content as normal blocks.",
  ...Object.fromEntries(
    [
      "moocfi/exercise-settings",
      "moocfi/exercise-slides",
      "moocfi/exercise-slide",
      "moocfi/exercise-task",
    ].map((name) => [
      name,
      "Exercise contents live outside the page; a page holds only the moocfi/exercise block with its id.",
    ]),
  ),
  "moocfi/unsupported-block-type":
    "This is the editor's placeholder for unknown blocks and is never stored. Remove it.",
}

const EXERCISE_BLOCK = "moocfi/exercise"
const ROOT_PARENT = "core/post-content"

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const BLOCK_KEYS = new Set(["clientId", "name", "isValid", "attributes", "innerBlocks"])

const attributeSchemaCache = new Map<string, BlockAttributeSchemas>()

const attributeSchemasFor = (blockType: BlockType): BlockAttributeSchemas => {
  let schemas = attributeSchemaCache.get(blockType.name)
  if (!schemas) {
    schemas = blockAttributeSchemas(blockType)
    attributeSchemaCache.set(blockType.name, schemas)
  }
  return schemas
}

/** Gutenberg's allow-list check, as in the block editor's `checkAllowList`. */
const checkAllowList = (list: unknown, item: string | null): boolean | null => {
  if (typeof list === "boolean") {
    return list
  }
  if (Array.isArray(list)) {
    if (list.includes(ROOT_PARENT) && item === null) {
      return true
    }
    return item !== null && list.includes(item)
  }
  return null
}

/** Whether a block has an InnerBlocks area at all; a block without one can't hold children. */
const hasInnerBlocksArea = (blockType: BlockType): boolean =>
  Array.isArray(blockType.allowedBlocks) ||
  blockType.innerBlocksArea !== undefined ||
  (blockType.supports as Record<string, unknown> | undefined)?.allowedBlocks === true

const ownTemplateLock = (
  blockType: BlockType,
  attributes: Record<string, unknown>,
): TemplateLock | undefined => {
  if (blockType.innerBlocksArea?.templateLock !== undefined) {
    return blockType.innerBlocksArea.templateLock
  }
  const attributeLock = attributes.templateLock
  return attributeLock === false || typeof attributeLock === "string"
    ? (attributeLock as TemplateLock)
    : undefined
}

const describeTemplate = (template: Template[]): string =>
  template
    .map(([name, , innerTemplate]) =>
      innerTemplate && innerTemplate.length > 0
        ? `${name} [${describeTemplate(innerTemplate as Template[])}]`
        : name,
    )
    .join(", ")

interface ValidationContext {
  pageType: PageType
  features: CourseBlockFeatures
  insertable: Set<string>
  errors: ValidationError[]
  seenClientIds: Set<string>
}

interface ParentContext {
  name: string | null
  ancestors: string[]
}

const addError = (
  context: ValidationContext,
  clientId: string | null,
  path: AttributePath,
  code: ValidationErrorCode,
  message: string,
  fix: string,
) => {
  context.errors.push({ clientId, path, code, message, fix })
}

/**
 * The editor's insertion rule: the block must be offered on the page, any `parent`/`ancestor` must
 * match, and either the parent's allow-list or the block's own `parent` must name the other.
 */
const nestingProblem = (
  blockType: BlockType,
  parent: ParentContext,
): { message: string; fix: string } | null => {
  const parentType = parent.name === null ? undefined : (getBlockType(parent.name) as BlockType)
  const where = parent.name === null ? "at the top level of the page" : `inside ${parent.name}`
  const allowedParents = [...(blockType.parent ?? []), ...(blockType.ancestor ?? [])]
  const parentsText = allowedParents
    .map((name) => (name === ROOT_PARENT ? "the top level of the page" : name))
    .join(" or ")

  if (
    allowedParents.length > 0 &&
    !allowedParents.includes(ROOT_PARENT) &&
    !parent.ancestors.some((ancestor) => allowedParents.includes(ancestor))
  ) {
    return {
      message: `${blockType.name} can't be placed ${where}.`,
      fix: `Place it inside ${parentsText}.`,
    }
  }
  const isAllowedByParent = checkAllowList(parentType?.allowedBlocks, blockType.name)
  const isAllowedByOwnParent = checkAllowList(blockType.parent, parent.name)
  const hasAllowedAncestor =
    !blockType.ancestor ||
    parent.ancestors.some((ancestor) => blockType.ancestor?.includes(ancestor))
  const canInsert =
    hasAllowedAncestor &&
    ((isAllowedByParent === null && isAllowedByOwnParent === null) ||
      isAllowedByParent === true ||
      isAllowedByOwnParent === true)
  if (canInsert) {
    return null
  }
  if (parentType?.allowedBlocks && isAllowedByParent === false) {
    return {
      message: `${blockType.name} can't be placed ${where}.`,
      fix: `${parent.name} accepts only ${parentType.allowedBlocks.join(", ")}${allowedParents.length > 0 ? `; ${blockType.name} goes inside ${parentsText}` : ""}.`,
    }
  }
  return {
    message: `${blockType.name} can't be placed ${where}.`,
    fix: allowedParents.length > 0 ? `Place it inside ${parentsText}.` : "Move it elsewhere.",
  }
}

/**
 * Checks that children match a locked template: "all" fixes names and order, "insert" fixes which
 * blocks there are. Nested template entries are checked too while the lock is inherited.
 */
const checkLockedTemplate = (
  context: ValidationContext,
  clientId: string,
  blockName: string,
  children: BlockInstance[],
  template: Template[],
  lock: TemplateLock,
) => {
  const childNames = children.map((child) => child.name)
  const templateNames = template.map(([name]) => name)
  const matches =
    lock === "all"
      ? childNames.join("\n") === templateNames.join("\n")
      : childNames.toSorted().join("\n") === templateNames.toSorted().join("\n")
  if (!matches) {
    addError(
      context,
      clientId,
      ["innerBlocks"],
      "invalid_nesting",
      `${blockName} has a locked layout (${lock}); its inner blocks are ${childNames.join(", ") || "empty"}.`,
      `Give it exactly these inner blocks${lock === "all" ? ", in this order" : ""}: ${describeTemplate(template)}.`,
    )
    return
  }
  const unmatched = [...template]
  for (const child of children) {
    const entryIndex = unmatched.findIndex(([name]) => name === child.name)
    const [entry] = unmatched.splice(entryIndex, 1)
    const innerTemplate = entry?.[2] as Template[] | undefined
    const childType = getBlockType(child.name) as BlockType | undefined
    if (
      innerTemplate &&
      childType &&
      ownTemplateLock(childType, isPlainObject(child.attributes) ? child.attributes : {}) ===
        undefined
    ) {
      checkLockedTemplate(
        context,
        child.clientId,
        child.name,
        Array.isArray(child.innerBlocks) ? child.innerBlocks : [],
        innerTemplate,
        lock,
      )
    }
  }
}

const validateExerciseBlock = (
  context: ValidationContext,
  clientId: string,
  attributes: Record<string, unknown>,
  innerBlocks: unknown[],
) => {
  const extraKeys = Object.keys(attributes).filter((key) => key !== "id")
  if (typeof attributes.id !== "string" || extraKeys.length > 0 || innerBlocks.length > 0) {
    addError(
      context,
      clientId,
      ["attributes"],
      "invalid_attribute",
      "An exercise block on a page holds only its exercise id; exercises are edited elsewhere.",
      'Keep the exercise block exactly as read: {"attributes": {"id": "<exercise id>"}, "innerBlocks": []}.',
    )
  }
}

const validateAttributes = (
  context: ValidationContext,
  clientId: string,
  blockType: BlockType,
  attributes: Record<string, unknown>,
): Record<string, unknown> => {
  const { writable, forbidden } = attributeSchemasFor(blockType)
  const normalised: Record<string, unknown> = {}
  const errorCountBefore = context.errors.length
  for (const [key, value] of Object.entries(attributes)) {
    const forbiddenFix = forbidden[key]
    if (forbiddenFix !== undefined) {
      addError(
        context,
        clientId,
        ["attributes", key],
        "forbidden_attribute",
        `${blockType.name} attribute ${key} isn't accepted from agents.`,
        forbiddenFix,
      )
      continue
    }
    const schema = writable[key]
    if (!schema) {
      addError(
        context,
        clientId,
        ["attributes", key],
        "invalid_attribute",
        `${blockType.name} has no attribute ${key}.`,
        `Remove it. ${blockType.name} attributes: ${Object.keys(writable).join(", ") || "none"}.`,
      )
      continue
    }
    if (value === undefined || value === null) {
      if (value === null && [schema.type].flat().includes("null")) {
        normalised[key] = value
      }
      continue
    }
    const checked = checkAttributeValue(schema, value, ["attributes", key])
    for (const problem of checked.issues) {
      addError(context, clientId, problem.path, problem.code, problem.message, problem.fix)
    }
    normalised[key] = checked.value
  }
  if (context.errors.length > errorCountBefore) {
    return attributes
  }
  // Fills defaults and orders keys exactly as the editor's createBlock does.
  return JSON.parse(JSON.stringify(sanitizeBlockAttributes(blockType.name, normalised))) as Record<
    string,
    unknown
  >
}

const validateBlock = (
  context: ValidationContext,
  input: unknown,
  requestPath: AttributePath,
  parent: ParentContext,
): unknown => {
  if (!isPlainObject(input)) {
    addError(
      context,
      null,
      requestPath,
      "invalid_block",
      "A block must be an object.",
      "Send blocks as objects with clientId, name, attributes and innerBlocks.",
    )
    return input
  }
  const clientId =
    typeof input.clientId === "string" && input.clientId !== "" ? input.clientId : null
  if (clientId === null) {
    addError(
      context,
      null,
      requestPath,
      "invalid_block",
      "The block has no clientId.",
      "Give every block the clientId it was read with, or send it to the server without one so that it assigns one.",
    )
    return input
  }
  if (context.seenClientIds.has(clientId)) {
    addError(
      context,
      clientId,
      [],
      "duplicate_client_id",
      `clientId ${clientId} appears more than once.`,
      "Give each block its own clientId.",
    )
  }
  context.seenClientIds.add(clientId)

  const unknownKeys = Object.keys(input).filter((key) => !BLOCK_KEYS.has(key))
  if (unknownKeys.length > 0) {
    addError(
      context,
      clientId,
      [unknownKeys[0] ?? ""],
      "invalid_block",
      `The block has unknown keys: ${unknownKeys.join(", ")}.`,
      "Keep only clientId, name, isValid, attributes and innerBlocks.",
    )
  }
  const name = input.name
  const attributes = input.attributes ?? {}
  const innerBlocks = input.innerBlocks ?? []
  if (
    typeof name !== "string" ||
    !isPlainObject(attributes) ||
    !Array.isArray(innerBlocks) ||
    (input.isValid !== undefined && typeof input.isValid !== "boolean")
  ) {
    addError(
      context,
      clientId,
      [],
      "invalid_block",
      "name must be a string, attributes an object, innerBlocks an array and isValid a boolean.",
      "Fix the block's shape.",
    )
    return input
  }

  const blockType = getBlockType(name) as BlockType | undefined
  if (!blockType) {
    addError(
      context,
      clientId,
      ["name"],
      "unknown_block",
      `${name} isn't a known block.`,
      `Use a block from the ${context.pageType} list in the block schemas.`,
    )
    return input
  }
  const disallowedFix = BLOCKS_AGENTS_MAY_NOT_WRITE[name]
  if (disallowedFix !== undefined) {
    addError(
      context,
      clientId,
      ["name"],
      "not_allowed_here",
      `${name} isn't accepted from agents.`,
      disallowedFix,
    )
    return input
  }
  if (!context.insertable.has(name)) {
    const gate = COURSE_FEATURE_GATED_BLOCKS[name]
    addError(
      context,
      clientId,
      ["name"],
      "not_allowed_here",
      `${name} isn't available on a ${context.pageType}${gate ? " in this course" : ""}.`,
      gate === "chapterLockingEnabled"
        ? "It needs chapter locking turned on in the course settings; remove the block or ask the teacher."
        : gate === "canAddChatbot"
          ? "The course can't have a chatbot; remove the block."
          : `Remove it, or use a block listed for ${context.pageType}.`,
    )
    return input
  }
  const nesting = nestingProblem(blockType, parent)
  if (nesting) {
    addError(context, clientId, [], "invalid_nesting", nesting.message, nesting.fix)
  }

  if (name === EXERCISE_BLOCK) {
    validateExerciseBlock(context, clientId, attributes, innerBlocks)
    return { clientId, name, isValid: true, attributes, innerBlocks }
  }

  const normalisedAttributes = validateAttributes(context, clientId, blockType, attributes)

  if (innerBlocks.length > 0 && !hasInnerBlocksArea(blockType)) {
    addError(
      context,
      clientId,
      ["innerBlocks"],
      "invalid_nesting",
      `${name} can't contain other blocks.`,
      "Move the inner blocks out of it.",
    )
  }
  const template = blockType.innerBlocksArea?.template
  const lock = ownTemplateLock(blockType, attributes)
  if (template && template.length > 0) {
    if (lock === "all" || lock === "insert") {
      checkLockedTemplate(context, clientId, name, innerBlocks as BlockInstance[], template, lock)
    } else if (innerBlocks.length === 0) {
      addError(
        context,
        clientId,
        ["innerBlocks"],
        "invalid_nesting",
        `${name} is empty; the editor fills an empty ${name} with its template.`,
        `Give it inner blocks, for example: ${describeTemplate(template)}.`,
      )
    }
  }

  const childParent: ParentContext = { name, ancestors: [name, ...parent.ancestors] }
  const normalisedInnerBlocks = innerBlocks.map((child, index) =>
    validateBlock(context, child, [...requestPath, "innerBlocks", index], childParent),
  )
  return {
    clientId,
    name,
    isValid: true,
    attributes: normalisedAttributes,
    innerBlocks: normalisedInnerBlocks,
  }
}

const parseFeatures = (body: Record<string, unknown>): CourseBlockFeatures | string => {
  const chapterLockingEnabled = body.chapter_locking_enabled ?? false
  const canAddChatbot = body.can_add_chatbot ?? false
  if (typeof chapterLockingEnabled !== "boolean" || typeof canAddChatbot !== "boolean") {
    return "chapter_locking_enabled and can_add_chatbot must be booleans when given."
  }
  return { chapterLockingEnabled, canAddChatbot }
}

/**
 * Validates a batch of top-level page blocks (full trees) and returns them as the editor would
 * store them. Every block is checked strictly, including content that was already on the page.
 */
export const validateBlocks = (body: unknown): ValidateBlocksResult => {
  if (!isPlainObject(body)) {
    return { status: 400, body: { error: "The request body must be a JSON object." } }
  }
  const pageType = body.page_type
  if (typeof pageType !== "string" || !(PAGE_TYPES as readonly string[]).includes(pageType)) {
    return { status: 400, body: { error: `page_type must be one of ${PAGE_TYPES.join(", ")}.` } }
  }
  if (!Array.isArray(body.blocks)) {
    return { status: 400, body: { error: "blocks must be an array of blocks." } }
  }
  const features = parseFeatures(body)
  if (typeof features === "string") {
    return { status: 400, body: { error: features } }
  }
  const context: ValidationContext = {
    pageType: pageType as PageType,
    features,
    insertable: new Set(insertableBlockNames(pageType as PageType, features)),
    errors: [],
    seenClientIds: new Set(),
  }
  const root: ParentContext = { name: null, ancestors: [] }
  const blocks = body.blocks.map((block, index) =>
    validateBlock(context, block, ["blocks", index], root),
  )
  const valid = context.errors.length === 0
  return {
    status: 200,
    body: {
      valid,
      blocks: valid ? removeUncommonSpacesFromBlocks(blocks as BlockInstance[]) : blocks,
      errors: context.errors,
    },
  }
}
