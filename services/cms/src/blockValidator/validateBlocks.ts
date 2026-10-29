/* oxlint-disable i18next/no-literal-string */

import { getBlockType, sanitizeBlockAttributes } from "@wordpress/blocks"
import { memoize } from "lodash"
import * as z from "zod"

import { insertableBlockNames } from "@/blocks/pageTypeBlocks"
import { COURSE_FEATURE_GATES, type CourseBlockFeatures } from "@/blocks/pageTypes"
import { supportedCoreBlocks } from "@/blocks/supportedGutenbergBlocks"
import type {
  BlockValidationError,
  ValidateBlocksResponse,
  ValidationOutcome,
} from "@/generated/api/types.generated"
import { type zPageValidationRequest, zValidateBlocksRequest } from "@/generated/api/zod.generated"
import { hasInnerBlocksArea } from "@/utils/Gutenberg/innerBlocksArea"
import { hasUncommonSpaces, UNCOMMON_SPACE_FIELDS } from "@/utils/Gutenberg/modifyBlocks"
import type { BlockType, Template, TemplateLock } from "@/utils/Gutenberg/types"

import { blockAttributeSchemas } from "./attributeSchemas"
import { type AttributePath, checkAttributeValue, isPlainObject } from "./attributeValues"

/**
 * The largest request body headless-lms may send, which it learns from the block schemas. The
 * largest body validates in about 6 s, inside the worker's processing timeout.
 */
export const MAX_REQUEST_BYTES = 1_000_000

export type ValidateBlocksResult =
  | { status: 200; body: ValidateBlocksResponse }
  | { status: 400; body: { error: string } }

/** Blocks the page allow-lists contain that agents still may not write, with the fix to give. */
export const BLOCKS_AGENTS_MAY_NOT_WRITE: ReadonlyMap<string, string> = new Map([
  [
    "core/html",
    "Raw HTML blocks aren't accepted. Use paragraphs, headings, lists, tables or other blocks instead.",
  ],
  [
    "core/block",
    "Reusable blocks have nothing to refer to in this system. Write the content as normal blocks.",
  ],
  ...[
    "moocfi/exercise-settings",
    "moocfi/exercise-slides",
    "moocfi/exercise-slide",
    "moocfi/exercise-task",
  ].map((name): [string, string] => [
    name,
    "Exercise contents live outside the page; a page holds only the moocfi/exercise block with its id.",
  ]),
  [
    "moocfi/unsupported-block-type",
    "This is the editor's placeholder for unknown blocks and is never stored. Remove it.",
  ],
])

/** Gutenberg's block name format; anything else, such as "constructor", is no block. */
const BLOCK_NAME = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/

export const EXERCISE_BLOCK = "moocfi/exercise"
/** The parent name Gutenberg uses for the top level of a page. */
export const ROOT_PARENT = "core/post-content"

const BLOCK_KEYS = new Set(["clientId", "name", "isValid", "attributes", "innerBlocks"])

const attributeSchemasFor = memoize(blockAttributeSchemas, (blockType: BlockType) => blockType.name)

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

const templateDepth = (template: Template[]): number =>
  Math.max(
    0,
    ...template.map(([, , innerTemplate]) =>
      innerTemplate && innerTemplate.length > 0
        ? 1 + templateDepth(innerTemplate as Template[])
        : 0,
    ),
  )

/** Names blocks the way `describeTemplate` names template entries, `depth` levels down. */
const describeBlocks = (blocks: unknown[], depth: number): string =>
  blocks
    .map((block) => {
      const name = isPlainObject(block) && typeof block.name === "string" ? block.name : "?"
      const innerBlocks =
        isPlainObject(block) && Array.isArray(block.innerBlocks) ? block.innerBlocks : []
      return depth > 0 && innerBlocks.length > 0
        ? `${name} [${describeBlocks(innerBlocks, depth - 1)}]`
        : name
    })
    .join(", ")

/** The exercise blocks whose children `exercise_context` validates, by context. */
const EXERCISE_CONTEXT_ROOTS = {
  task_instructions: "moocfi/exercise-task",
  review_instructions: "moocfi/exercise-settings",
} as const

interface ValidationContext {
  /** Where the blocks sit, as in "isn't available <where>". */
  where: string
  /** What the allow-list is named for: the page type or the exercise block. */
  listName: string
  insertable: Set<string>
  /** Blocks whose name and attributes are as on the live page, so a teacher wrote them. */
  unchangedClientIds: ReadonlySet<string>
  errors: BlockValidationError[]
  warnings: BlockValidationError[]
  seenClientIds: Set<string>
}

/**
 * The editor's insertion rule: the block must be offered on the page, any `parent`/`ancestor` must
 * match, and either the parent's allow-list or the block's own `parent` must name the other.
 * `ancestors` lists the enclosing blocks, nearest first.
 */
const nestingProblem = (
  blockType: BlockType,
  ancestors: string[],
): { message: string; fix: string } | null => {
  const parentName = ancestors[0] ?? null
  const parentType =
    parentName === null ? undefined : (getBlockType(parentName) as BlockType | undefined)
  const allowedParents = [...(blockType.parent ?? []), ...(blockType.ancestor ?? [])]
  // Stricter than the editor for `parent`: an allow-list naming the block doesn't excuse it.
  const hasAllowedAncestor =
    allowedParents.length === 0 ||
    allowedParents.includes(ROOT_PARENT) ||
    ancestors.some((ancestor) => allowedParents.includes(ancestor))
  const isAllowedByParent = checkAllowList(parentType?.allowedBlocks, blockType.name)
  const isAllowedByOwnParent = checkAllowList(blockType.parent, parentName)
  if (
    hasAllowedAncestor &&
    ((isAllowedByParent === null && isAllowedByOwnParent === null) ||
      isAllowedByParent === true ||
      isAllowedByOwnParent === true)
  ) {
    return null
  }
  const parentsText = allowedParents
    .map((name) => (name === ROOT_PARENT ? "the top level of the page" : name))
    .join(" or ")
  const fix =
    hasAllowedAncestor && parentType?.allowedBlocks && isAllowedByParent === false
      ? `${parentName} accepts only ${parentType.allowedBlocks.join(", ")}${allowedParents.length > 0 ? `; ${blockType.name} goes inside ${parentsText}` : ""}.`
      : allowedParents.length > 0
        ? `Place it inside ${parentsText}.`
        : "Move it elsewhere."
  return {
    message: `${blockType.name} can't be placed ${parentName === null ? "at the top level of the page" : `inside ${parentName}`}.`,
    fix,
  }
}

/**
 * Whether children fit a locked template: "all" fixes names and order, "insert" only which blocks
 * there are. Nested template entries apply too while the lock is inherited.
 */
const fitsLockedTemplate = (
  children: unknown[],
  template: Template[],
  lock: TemplateLock,
): boolean => {
  if (children.length !== template.length) {
    return false
  }
  if (lock === "all") {
    return children.every((child, index) => fitsTemplateEntry(child, template[index], lock))
  }
  // Insert lets the teacher reorder, so children match entries in any order.
  const isEntryTaken = template.map(() => false)
  const matchFrom = (childIndex: number): boolean =>
    childIndex === children.length ||
    template.some((entry, entryIndex) => {
      if (isEntryTaken[entryIndex] || !fitsTemplateEntry(children[childIndex], entry, lock)) {
        return false
      }
      isEntryTaken[entryIndex] = true
      if (matchFrom(childIndex + 1)) {
        return true
      }
      isEntryTaken[entryIndex] = false
      return false
    })
  return matchFrom(0)
}

const fitsTemplateEntry = (
  child: unknown,
  entry: Template | undefined,
  lock: TemplateLock,
): boolean => {
  if (entry === undefined || !isPlainObject(child) || child.name !== entry[0]) {
    return false
  }
  const innerTemplate = entry[2] as Template[] | undefined
  const childType = getBlockType(entry[0]) as BlockType | undefined
  if (
    !innerTemplate ||
    !childType ||
    ownTemplateLock(childType, isPlainObject(child.attributes) ? child.attributes : {}) !==
      undefined
  ) {
    return true
  }
  return fitsLockedTemplate(
    Array.isArray(child.innerBlocks) ? child.innerBlocks : [],
    innerTemplate,
    lock,
  )
}

// The exercise editor stores these beside the id; they come back in stored and copied blocks.
const EDITOR_STORED_EXERCISE_KEYS = new Set(["name", "dropCap"])

const validateExerciseBlock = (
  ownProblems: BlockValidationError[],
  clientId: string,
  isUnchanged: boolean,
  attributes: Record<string, unknown>,
  innerBlocks: unknown[],
) => {
  const extraKeys = Object.keys(attributes).filter(
    (key) => key !== "id" && !(isUnchanged && EDITOR_STORED_EXERCISE_KEYS.has(key)),
  )
  if (typeof attributes.id !== "string" || extraKeys.length > 0 || innerBlocks.length > 0) {
    ownProblems.push({
      clientId,
      path: ["attributes"],
      code: "invalid_attribute",
      message:
        "An exercise block on a page holds only its exercise id; exercises are edited elsewhere.",
      fix: 'Keep the exercise block with only its id: {"attributes": {"id": "<exercise id>"}, "innerBlocks": []}.',
    })
  }
}

const validateAttributes = (
  context: ValidationContext,
  clientId: string,
  isUnchanged: boolean,
  problems: BlockValidationError[],
  blockType: BlockType,
  attributes: Record<string, unknown>,
): Record<string, unknown> => {
  const { writable, forbidden } = attributeSchemasFor(blockType)
  const normalised: Record<string, unknown> = {}
  const problemCountBefore = problems.length
  for (const [key, value] of Object.entries(attributes)) {
    if (Object.hasOwn(forbidden, key)) {
      if (isUnchanged) {
        normalised[key] = value
        continue
      }
      context.errors.push({
        clientId,
        path: ["attributes", key],
        code: "forbidden_attribute",
        message: `${blockType.name} attribute ${key} isn't accepted from agents.`,
        fix: forbidden[key] ?? "Remove it.",
      })
      continue
    }
    const schema = Object.hasOwn(writable, key) ? writable[key] : undefined
    if (!schema) {
      problems.push({
        clientId,
        path: ["attributes", key],
        code: "invalid_attribute",
        message: `${blockType.name} has no attribute ${key}.`,
        fix: `Remove it. ${blockType.name} attributes: ${Object.keys(writable).join(", ") || "none"}.`,
      })
      continue
    }
    if (value === null && isUnchanged) {
      normalised[key] = value
      continue
    }
    const checked = checkAttributeValue(schema, value, ["attributes", key])
    problems.push(...checked.issues.map((problem) => ({ clientId, ...problem })))
    normalised[key] = checked.value
  }
  if (!isUnchanged) {
    for (const field of UNCOMMON_SPACE_FIELDS.get(blockType.name) ?? []) {
      const value = normalised[field]
      if (typeof value === "string" && hasUncommonSpaces(value)) {
        context.errors.push({
          clientId,
          path: ["attributes", field],
          code: "disallowed_markup",
          message: `${blockType.name} ${field} has a non-breaking or other special space, which the editor turns into a plain space.`,
          fix: "Use plain spaces.",
        })
      }
    }
  }
  if (problems.length > problemCountBefore) {
    return attributes
  }
  // Fills defaults and orders keys exactly as the editor's createBlock does. The JSON round trip
  // turns the RichTextData it holds rich-text attributes in back into HTML strings.
  return JSON.parse(JSON.stringify(sanitizeBlockAttributes(blockType.name, normalised))) as Record<
    string,
    unknown
  >
}

const validateBlock = (
  context: ValidationContext,
  input: unknown,
  requestPath: AttributePath,
  ancestors: string[],
): unknown => {
  if (!isPlainObject(input)) {
    context.errors.push({
      clientId: null,
      path: requestPath,
      code: "invalid_block",
      message: "A block must be an object.",
      fix: "Send blocks as objects with clientId, name, attributes and innerBlocks.",
    })
    return input
  }
  const clientId =
    typeof input.clientId === "string" && input.clientId !== "" ? input.clientId : null
  if (clientId === null) {
    context.errors.push({
      clientId: null,
      path: requestPath,
      code: "invalid_block",
      message: "The block has no clientId.",
      fix: "Give every block the clientId it was read with, or send it to the server without one so that it assigns one.",
    })
    return input
  }
  if (context.seenClientIds.has(clientId)) {
    context.errors.push({
      clientId,
      path: [],
      code: "duplicate_client_id",
      message: `clientId ${clientId} appears more than once.`,
      fix: "Give each block its own clientId.",
    })
  }
  context.seenClientIds.add(clientId)
  const isUnchanged = context.unchangedClientIds.has(clientId)
  // The teacher's blocks only warn about their own type, name and attributes: the agent didn't
  // write them. Problems with where a block sits stay errors, since the agent may have moved it.
  const ownProblems = isUnchanged ? context.warnings : context.errors

  const unknownKeys = Object.keys(input).filter((key) => !BLOCK_KEYS.has(key))
  if (unknownKeys.length > 0) {
    context.errors.push({
      clientId,
      path: [unknownKeys[0] ?? ""],
      code: "invalid_block",
      message: `The block has unknown keys: ${unknownKeys.join(", ")}.`,
      fix: "Keep only clientId, name, isValid, attributes and innerBlocks.",
    })
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
    context.errors.push({
      clientId,
      path: [],
      code: "invalid_block",
      message:
        "name must be a string, attributes an object, innerBlocks an array and isValid a boolean.",
      fix: "Fix the block's shape.",
    })
    return input
  }

  const blockType = BLOCK_NAME.test(name)
    ? (getBlockType(name) as BlockType | undefined)
    : undefined
  if (!blockType) {
    ownProblems.push({
      clientId,
      path: ["name"],
      code: "unknown_block",
      message: `${name} isn't a known block.`,
      fix: `Use a block from the ${context.listName} list in the block schemas.`,
    })
    return input
  }
  const disallowedFix = isUnchanged ? undefined : BLOCKS_AGENTS_MAY_NOT_WRITE.get(name)
  if (disallowedFix !== undefined) {
    context.errors.push({
      clientId,
      path: ["name"],
      code: "not_allowed_here",
      message: `${name} isn't accepted from agents.`,
      fix: disallowedFix,
    })
    return input
  }
  if (!isUnchanged && !context.insertable.has(name)) {
    const gate = COURSE_FEATURE_GATES[name]
    context.errors.push({
      clientId,
      path: ["name"],
      code: "not_allowed_here",
      message: `${name} isn't available ${context.where}${gate ? " in this course" : ""}.`,
      fix: gate?.fix ?? `Remove it, or use a block listed for ${context.listName}.`,
    })
    return input
  }
  const nesting = nestingProblem(blockType, ancestors)
  if (nesting) {
    context.errors.push({ clientId, path: [], code: "invalid_nesting", ...nesting })
  }

  if (name === EXERCISE_BLOCK) {
    validateExerciseBlock(ownProblems, clientId, isUnchanged, attributes, innerBlocks)
    return { clientId, name, isValid: true, attributes, innerBlocks }
  }

  const normalisedAttributes = validateAttributes(
    context,
    clientId,
    isUnchanged,
    ownProblems,
    blockType,
    attributes,
  )

  if (innerBlocks.length > 0 && !hasInnerBlocksArea(blockType)) {
    context.errors.push({
      clientId,
      path: ["innerBlocks"],
      code: "invalid_nesting",
      message: `${name} can't contain other blocks.`,
      fix: "Move the inner blocks out of it.",
    })
  }
  const template = blockType.innerBlocksArea?.template
  const lock = ownTemplateLock(blockType, attributes)
  // A child that isn't an object gets its own error below.
  if (
    template &&
    template.length > 0 &&
    (lock === "all" || lock === "insert") &&
    innerBlocks.every((child) => isPlainObject(child)) &&
    !fitsLockedTemplate(innerBlocks, template, lock)
  ) {
    context.errors.push({
      clientId,
      path: ["innerBlocks"],
      code: "invalid_nesting",
      message: `${name} has a locked layout (${lock}); its inner blocks are ${describeBlocks(innerBlocks, templateDepth(template)) || "empty"}.`,
      fix: `Give it exactly these inner blocks${lock === "all" ? ", in this order" : ""}: ${describeTemplate(template)}.`,
    })
  }

  const childAncestors = [name, ...ancestors]
  const normalisedInnerBlocks = innerBlocks.map((child, index) =>
    validateBlock(context, child, [...requestPath, "innerBlocks", index], childAncestors),
  )
  return {
    clientId,
    name,
    isValid: true,
    attributes: normalisedAttributes,
    innerBlocks: normalisedInnerBlocks,
  }
}

interface Placement {
  where: string
  listName: string
  insertable: Set<string>
  ancestors: string[]
}

/**
 * Where a page's blocks go. Inside an exercise, its own allow-list decides; core blocks stay
 * insertable so their descendants, such as list items, pass.
 */
const placementFor = (
  page: z.output<typeof zPageValidationRequest>,
  features: CourseBlockFeatures,
): Placement => {
  if ("exercise_context" in page) {
    const rootName = EXERCISE_CONTEXT_ROOTS[page.exercise_context]
    const rootType = getBlockType(rootName) as BlockType | undefined
    return {
      where: `inside ${rootName}`,
      listName: rootName,
      insertable: new Set([...supportedCoreBlocks, ...(rootType?.allowedBlocks ?? [])]),
      ancestors: [rootName],
    }
  }
  return {
    where: `on a ${page.page_type}`,
    listName: page.page_type,
    insertable: new Set(insertableBlockNames(page.page_type, features)),
    ancestors: [],
  }
}

/** Validates one page's blocks and returns them as the editor would store them. */
const validatePage = (
  page: z.output<typeof zPageValidationRequest>,
  features: CourseBlockFeatures,
): ValidationOutcome => {
  const placement = placementFor(page, features)
  const context: ValidationContext = {
    where: placement.where,
    listName: placement.listName,
    insertable: placement.insertable,
    unchangedClientIds: new Set(page.unchanged_client_ids),
    errors: [],
    warnings: [],
    seenClientIds: new Set(),
  }
  const blocks = page.blocks.map((block, index) =>
    validateBlock(context, block, ["blocks", index], placement.ancestors),
  )
  return { blocks, errors: context.errors, warnings: context.warnings }
}

/**
 * Validates top-level page blocks (full trees), page by page, and returns them as the editor
 * would store them. Every block is type-checked strictly, including content that was already on
 * the page. Blocks listed in a page's `unchanged_client_ids` are the teacher's: rules about what
 * agents may write (banned blocks and attributes, course feature gates, nulls, special spaces)
 * skip them, and their other problems come back as warnings, so they never fail a write.
 */
export const validateBlocks = (body: unknown): ValidateBlocksResult => {
  const request = zValidateBlocksRequest.safeParse(body)
  if (!request.success) {
    return { status: 400, body: { error: z.prettifyError(request.error) } }
  }
  const { pages, course_features } = request.data
  return {
    status: 200,
    body: { pages: pages.map((page) => validatePage(page, course_features)) },
  }
}
