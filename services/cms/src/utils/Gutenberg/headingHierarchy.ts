import type { BlockInstance } from "@/utils/Gutenberg/types"

import { extractPlainTextFromHtml } from "./paragraphAiSource"

type HeadingIssueType = "heading-h1-reserved" | "heading-first-should-be-h2" | "heading-level-jump"

export interface HeadingHierarchyIssue {
  type: HeadingIssueType
  level?: number
  previousLevel?: number
}

export interface HeadingHierarchyEntry {
  id: string
  blockClientId: string
  blockName: string
  level: number
  text: string
  issues: HeadingHierarchyIssue[]
}

interface RawHeadingEntry {
  blockClientId: string
  blockName: string
  level: number
  text: string
}

const normalizeHeadingText = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return extractPlainTextFromHtml(value).replaceAll(/\s+/g, " ").trim()
}

const parseHeadingLevel = (value: unknown): number | null => {
  if (typeof value !== "number") {
    return null
  }

  if (!Number.isInteger(value) || value < 1 || value > 6) {
    return null
  }

  return value
}

const createRawHeadingEntry = (
  block: Pick<BlockInstance, "clientId" | "name">,
  level: number,
  text: unknown,
): RawHeadingEntry | null => {
  const normalizedText = normalizeHeadingText(text)
  if (!normalizedText) {
    return null
  }

  return {
    blockClientId: block.clientId,
    blockName: block.name,
    level,
    text: normalizedText,
  }
}

/** Blocks that contribute to the heading outline. Keep in sync with `extractBlockHeadingEntries`. */
export const HEADING_SOURCE_BLOCK_NAMES = [
  "core/heading",
  "moocfi/hero-section",
  "moocfi/landing-page-hero-section",
  "moocfi/ingress",
  "moocfi/course-objective-section",
  "moocfi/terminology-block",
  "moocfi/aside-with-image",
  "moocfi/expandable-content-inner-block",
]

const extractBlockHeadingEntries = (block: BlockInstance): RawHeadingEntry[] => {
  switch (block.name) {
    case "core/heading": {
      const level = parseHeadingLevel(block.attributes?.level)
      if (level === null) {
        return []
      }
      const entry = createRawHeadingEntry(block, level, block.attributes?.content)
      return entry ? [entry] : []
    }
    case "moocfi/hero-section":
    case "moocfi/landing-page-hero-section": {
      const entry = createRawHeadingEntry(block, 1, block.attributes?.title)
      return entry ? [entry] : []
    }
    case "moocfi/ingress": {
      const titleEntry = createRawHeadingEntry(block, 2, block.attributes?.title)
      const subtitleEntry = createRawHeadingEntry(block, 3, block.attributes?.subtitle)
      return [titleEntry, subtitleEntry].filter((entry): entry is RawHeadingEntry => entry !== null)
    }
    case "moocfi/course-objective-section":
    case "moocfi/terminology-block": {
      const entry = createRawHeadingEntry(block, 2, block.attributes?.title)
      return entry ? [entry] : []
    }
    case "moocfi/aside-with-image": {
      const entry = createRawHeadingEntry(block, 4, block.attributes?.title)
      return entry ? [entry] : []
    }
    case "moocfi/expandable-content-inner-block": {
      const entry = createRawHeadingEntry(block, 4, block.attributes?.name)
      return entry ? [entry] : []
    }
    default:
      return []
  }
}

const extractRawHeadingEntries = (blocks: BlockInstance[]): RawHeadingEntry[] => {
  const entries: RawHeadingEntry[] = []

  for (const block of blocks) {
    entries.push(...extractBlockHeadingEntries(block))

    if (block.innerBlocks.length > 0) {
      entries.push(...extractRawHeadingEntries(block.innerBlocks))
    }
  }

  return entries
}

const isReservedH1Block = (entry: RawHeadingEntry): boolean =>
  entry.blockName === "moocfi/hero-section" ||
  entry.blockName === "moocfi/landing-page-hero-section"

const analyzeRawHeadingEntries = (rawEntries: RawHeadingEntry[]): HeadingHierarchyEntry[] =>
  rawEntries.map((entry, index) => {
    const previousEntry = index > 0 ? rawEntries[index - 1] : null
    const issues: HeadingHierarchyIssue[] = []

    if (entry.level === 1 && !isReservedH1Block(entry)) {
      issues.push({ type: "heading-h1-reserved", level: entry.level })
    }

    if (!previousEntry && entry.level > 2) {
      issues.push({ type: "heading-first-should-be-h2", level: entry.level })
    }

    if (previousEntry && entry.level > previousEntry.level + 1) {
      issues.push({
        type: "heading-level-jump",
        level: entry.level,
        previousLevel: previousEntry.level,
      })
    }

    return {
      id: `${entry.blockClientId}-${index}`,
      ...entry,
      issues,
    }
  })

/** Analyzes the outline of a block tree, walking inner blocks. */
export const analyzeHeadingHierarchy = (blocks: BlockInstance[]): HeadingHierarchyEntry[] =>
  analyzeRawHeadingEntries(extractRawHeadingEntries(blocks))

/**
 * Analyzes the outline of an already flattened block list in document order, e.g. the result of the
 * block editor's `getBlocksByName`. Inner blocks are not walked; the list must already contain
 * descendants. Prefer `analyzeHeadingHierarchy` for a block tree.
 */
export const analyzeHeadingHierarchyForFlatBlocks = (
  blocks: BlockInstance[],
): HeadingHierarchyEntry[] =>
  analyzeRawHeadingEntries(blocks.flatMap((block) => extractBlockHeadingEntries(block)))

/**
 * Picks the deduplicated issues one block is responsible for out of an analyzed outline. A block can
 * contribute several headings (e.g. an ingress title and subtitle), so entries are matched by
 * client id rather than by index.
 */
export const getHeadingHierarchyIssuesForBlock = (
  entries: HeadingHierarchyEntry[],
  clientId: string,
): HeadingHierarchyIssue[] =>
  entries
    .filter((entry) => entry.blockClientId === clientId)
    .flatMap((entry) => entry.issues)
    .filter(
      (issue, index, issues) =>
        issues.findIndex(
          (candidate) =>
            candidate.type === issue.type && candidate.previousLevel === issue.previousLevel,
        ) === index,
    )
