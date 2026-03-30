import { BlockInstance } from "@wordpress/blocks"

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

  return extractPlainTextFromHtml(value).replace(/\s+/g, " ").trim()
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

const extractRawHeadingEntries = (blocks: BlockInstance[]): RawHeadingEntry[] => {
  const entries: RawHeadingEntry[] = []

  for (const block of blocks) {
    switch (block.name) {
      case "core/heading": {
        const level = parseHeadingLevel(block.attributes?.level)
        if (level !== null) {
          const entry = createRawHeadingEntry(block, level, block.attributes?.content)
          if (entry) {
            entries.push(entry)
          }
        }
        break
      }
      case "moocfi/hero-section":
      case "moocfi/landing-page-hero-section": {
        const entry = createRawHeadingEntry(block, 1, block.attributes?.title)
        if (entry) {
          entries.push(entry)
        }
        break
      }
      case "moocfi/ingress": {
        const titleEntry = createRawHeadingEntry(block, 2, block.attributes?.title)
        const subtitleEntry = createRawHeadingEntry(block, 3, block.attributes?.subtitle)
        if (titleEntry) {
          entries.push(titleEntry)
        }
        if (subtitleEntry) {
          entries.push(subtitleEntry)
        }
        break
      }
      case "moocfi/course-objective-section":
      case "moocfi/terminology": {
        const entry = createRawHeadingEntry(block, 2, block.attributes?.title)
        if (entry) {
          entries.push(entry)
        }
        break
      }
      case "moocfi/aside-with-image": {
        const entry = createRawHeadingEntry(block, 4, block.attributes?.title)
        if (entry) {
          entries.push(entry)
        }
        break
      }
    }

    if (block.innerBlocks.length > 0) {
      entries.push(...extractRawHeadingEntries(block.innerBlocks))
    }
  }

  return entries
}

const isReservedH1Block = (entry: RawHeadingEntry): boolean =>
  entry.blockName === "moocfi/hero-section" ||
  entry.blockName === "moocfi/landing-page-hero-section"

export const analyzeHeadingHierarchy = (blocks: BlockInstance[]): HeadingHierarchyEntry[] => {
  const rawEntries = extractRawHeadingEntries(blocks)

  return rawEntries.map((entry, index) => {
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
}

export const getHeadingHierarchyIssuesForBlock = (
  blocks: BlockInstance[],
  clientId: string,
): HeadingHierarchyIssue[] => {
  const entries = analyzeHeadingHierarchy(blocks)

  return entries
    .filter((entry) => entry.blockClientId === clientId)
    .flatMap((entry) => entry.issues)
    .filter(
      (issue, index, issues) =>
        issues.findIndex(
          (candidate) =>
            candidate.type === issue.type && candidate.previousLevel === issue.previousLevel,
        ) === index,
    )
}
