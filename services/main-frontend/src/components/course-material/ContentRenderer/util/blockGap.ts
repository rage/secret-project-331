import { createContext } from "react"

import type { Block } from "@/types/courseMaterialBlock"

/**
 * Gap in rem between the blocks of every block list below, replacing the gaps chosen by block kind.
 * For blocks that lay out their content as one card.
 */
export const FixedBlockGapContext = createContext<number | null>(null)

const TEXT_BLOCKS = new Set(["core/paragraph", "core/list"])

/** Boxes and media that read as one group when several of the same kind follow each other. */
const GROUPING_BLOCKS = new Set([
  "moocfi/aside",
  "moocfi/highlightbox",
  "moocfi/infobox",
  "moocfi/instructionbox",
  "core/image",
  "core/buttons",
])

/** Parts of a parent block that space themselves, so they sit flush against their siblings. */
const FLUSH_BLOCKS = new Set([
  "core/list-item",
  "moocfi/front-card",
  "moocfi/back-card",
  "moocfi/expandable-content-inner-block",
])

const headingLevel = (block: Block<unknown>): number | null => {
  if (block.name !== "core/heading") {
    return null
  }
  return (block.attributes as { level?: number } | undefined)?.level ?? 2
}

/** Space above a heading, by level: the bigger the section break, the wider the gap. */
const gapAboveHeadingRem = (level: number): number => {
  if (level <= 2) {
    return 3.5
  }
  if (level === 3) {
    return 2.75
  }
  // Small label headings need clear space above so they don't read as a caption of the block before.
  return 2.5
}

/**
 * The vertical gap in rem between two sibling blocks, chosen by the kinds of both, so that headings
 * sit close to what they introduce, text runs evenly and other blocks get room around them.
 * `previous` is undefined for the first block of a list of blocks; its gap is 0.
 */
export function blockGapRem(previous: Block<unknown> | undefined, next: Block<unknown>): number {
  if (previous === undefined) {
    return 0
  }
  if (FLUSH_BLOCKS.has(next.name)) {
    return 0
  }
  // A spacer is the author's explicit gap.
  if (previous.name === "core/spacer" || next.name === "core/spacer") {
    return 0
  }
  if (previous.name === "core/separator" || next.name === "core/separator") {
    return 3.5
  }
  const previousHeadingLevel = headingLevel(previous)
  if (previousHeadingLevel !== null) {
    if (previousHeadingLevel >= 5) {
      return 0.5
    }
    return TEXT_BLOCKS.has(next.name) || headingLevel(next) !== null ? 0.875 : 1.25
  }
  const nextHeadingLevel = headingLevel(next)
  if (nextHeadingLevel !== null) {
    return gapAboveHeadingRem(nextHeadingLevel)
  }
  if (TEXT_BLOCKS.has(previous.name) && TEXT_BLOCKS.has(next.name)) {
    return 1.25
  }
  if (previous.name === next.name && GROUPING_BLOCKS.has(next.name)) {
    return 1.25
  }
  return 2.5
}
