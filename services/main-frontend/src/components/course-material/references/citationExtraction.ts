import { uniq } from "lodash"

import type { CitationMatch } from "@/components/course-material/ContentRenderer/util/textParsing"
import { extractCitationsFromText } from "@/components/course-material/ContentRenderer/util/textParsing"
import type { Block } from "@/types/courseMaterialBlock"

/**
 * Extracts citations from the page content block tree instead of the rendered DOM.
 *
 * The DOM only contains citation markers for content that is currently mounted, so citations inside
 * a collapsed expandable block are invisible to a DOM scan. Walking the block tree finds every
 * citation regardless of expand state, giving a deterministic source of truth for the reference
 * list and its numbering.
 *
 * The walk must mirror what ContentRenderer actually renders, or the numbers assigned here diverge
 * from the inline markers: same fields, same order (including inner-blocks-first blocks), and the
 * same content a block drops or truncates before rendering.
 */

/** Reads the citation-bearing text out of a block (its own attributes, not its inner blocks). */
type BlockReader = (block: Block<unknown>) => string[]

interface BlockCitationConfig {
  read: BlockReader
  /**
   * True when the block renders its inner blocks *before* its own text (e.g.
   * moocfi/aside-with-image renders the image/InnerBlocks above its title and content). Default is
   * own text first, matching most blocks.
   */
  innerBlocksFirst?: boolean
  /**
   * Maps the block's raw inner blocks to the ones actually rendered. Use when a block does not render
   * its inner blocks verbatim (e.g. moocfi/landing-page-hero-section renders only the first inner
   * block, with its content truncated), so extraction can't count a citation that rendering drops.
   */
  renderedInnerBlocks?: (block: Block<unknown>) => Block<unknown>[]
}

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null)

const attributesOf = (block: Block<unknown>): Record<string, unknown> =>
  block.attributes !== null && typeof block.attributes === "object"
    ? (block.attributes as Record<string, unknown>)
    : {}

const hasInnerBlocks = (block: Block<unknown>): boolean =>
  Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0

/** Reads the given attribute keys as strings, in order, skipping missing/non-string values. */
const stringFields =
  (...keys: string[]): BlockReader =>
  (block) => {
    const attributes = attributesOf(block)
    return keys
      .map((key) => asString(attributes[key]))
      .filter((value): value is string => value !== null)
  }

/** core/table stores text in nested head/body/foot -> rows -> cells -> content, plus a caption. */
const tableFields: BlockReader = (block) => {
  const attributes = attributesOf(block)
  const texts: string[] = []

  for (const sectionKey of ["head", "body", "foot"]) {
    const section = attributes[sectionKey]
    if (!Array.isArray(section)) {
      continue
    }
    for (const row of section) {
      const cells = (row as Record<string, unknown> | null)?.cells
      if (!Array.isArray(cells)) {
        continue
      }
      for (const cell of cells) {
        const content = asString((cell as Record<string, unknown> | null)?.content)
        if (content !== null) {
          texts.push(content)
        }
      }
    }
  }
  const caption = asString(attributes.caption)
  if (caption !== null) {
    texts.push(caption)
  }
  return texts
}

/**
 * core/list only renders `values` through ParsedText in the OLD format (no inner blocks). A
 * new-format list renders its core/list-item inner blocks and ignores `values`, so a stale `values`
 * attribute retained from an older save must not contribute phantom citations. See ListBlock.tsx.
 */
const listFields: BlockReader = (block) =>
  hasInnerBlocks(block) ? [] : stringFields("values")(block)

// Keep in sync with LandingPageHeroSectionBlock.tsx: it renders only the first inner block and caps
// its content length before handing it to ContentRenderer.
const LANDING_PAGE_HERO_MAX_INNER_CONTENT_LENGTH = 300

/**
 * Mirrors LandingPageHeroSectionBlock: only the first inner block is rendered, and its `content` is
 * truncated. A \cite past the cutoff is never rendered, so it must not be counted here either. The
 * block also appends "..." and strips newlines, but neither affects which \cite tokens match, so we
 * only replicate the length cap.
 */
const landingPageHeroRenderedInnerBlocks = (block: Block<unknown>): Block<unknown>[] => {
  const first = Array.isArray(block.innerBlocks) ? block.innerBlocks[0] : undefined
  if (!first) {
    return []
  }
  const attributes = first.attributes
  if (
    attributes !== null &&
    typeof attributes === "object" &&
    "content" in attributes &&
    typeof (attributes as Record<string, unknown>).content === "string"
  ) {
    const content = (attributes as Record<string, unknown>).content as string
    const truncated =
      content.length > LANDING_PAGE_HERO_MAX_INNER_CONTENT_LENGTH
        ? content.slice(0, LANDING_PAGE_HERO_MAX_INNER_CONTENT_LENGTH)
        : content
    return [{ ...first, attributes: { ...attributes, content: truncated } }]
  }
  return [first]
}

/**
 * Per-block-name config for the fields each block renders through ParsedText (which is what turns
 * \cite into a citation marker) plus how its inner blocks are rendered. Only these fields are
 * scanned, so extraction mirrors rendering exactly and can neither miss a real marker nor invent a
 * phantom reference: e.g. core/quote renders `value` as plain text and only `citation` through
 * ParsedText, and moocfi/terminology-block renders `blockName` as plain JSX.
 *
 * This is the complete set of citation-rendering blocks (every ContentRenderer component that
 * imports ParsedText). A block name absent from this map contributes no own-text citations (its
 * inner blocks are still walked). When a block starts (or stops) rendering a field through
 * ParsedText, update this map to match.
 */
const CITATION_BLOCKS: Record<string, BlockCitationConfig> = {
  "core/paragraph": { read: stringFields("content") },
  "core/list": { read: listFields },
  "core/list-item": { read: stringFields("content") },
  "core/quote": { read: stringFields("citation") },
  "core/image": { read: stringFields("caption") },
  "core/table": { read: tableFields },
  "moocfi/ingress": { read: stringFields("title", "subtitle") },
  "moocfi/highlightbox": { read: stringFields("title", "content") },
  "moocfi/instructionbox": { read: stringFields("content") },
  "moocfi/aside-with-image": { read: stringFields("title", "content"), innerBlocksFirst: true },
  "moocfi/terminology-block": { read: stringFields("title") },
  "moocfi/research-consent-question": { read: stringFields("content") },
  "moocfi/hero-section": { read: stringFields("title", "subtitle") },
  "moocfi/landing-page-hero-section": {
    read: stringFields("title"),
    renderedInnerBlocks: landingPageHeroRenderedInnerBlocks,
  },
}

const readBlockCitations = (block: Block<unknown>): CitationMatch[] => {
  const config = CITATION_BLOCKS[block.name]
  if (!config) {
    return []
  }
  return config.read(block).flatMap((text) => extractCitationsFromText(text))
}

const renderedInnerBlocksOf = (block: Block<unknown>): Block<unknown>[] => {
  const config = CITATION_BLOCKS[block.name]
  if (config?.renderedInnerBlocks) {
    return config.renderedInnerBlocks(block)
  }
  return Array.isArray(block.innerBlocks) ? block.innerBlocks : []
}

/** Depth-first walk pushing occurrences into `out` in document order (avoids per-level re-spreads). */
const collectCitations = (
  blocks: readonly Block<unknown>[] | null | undefined,
  out: CitationMatch[],
): void => {
  if (!Array.isArray(blocks)) {
    return
  }
  for (const block of blocks) {
    if (!block || typeof block !== "object") {
      continue
    }
    const innerBlocksFirst = CITATION_BLOCKS[block.name]?.innerBlocksFirst === true
    if (innerBlocksFirst) {
      collectCitations(renderedInnerBlocksOf(block), out)
      out.push(...readBlockCitations(block))
    } else {
      out.push(...readBlockCitations(block))
      collectCitations(renderedInnerBlocksOf(block), out)
    }
  }
}

/**
 * Every citation occurrence in the block tree, in document order (matching how ContentRenderer
 * renders each block's own text and inner blocks). Duplicates are preserved.
 */
export const extractPageCitations = (
  blocks: readonly Block<unknown>[] | null | undefined,
): CitationMatch[] => {
  const occurrences: CitationMatch[] = []
  collectCitations(blocks, occurrences)
  return occurrences
}

/**
 * Unique citation keys in first-occurrence document order. The position of a key (index + 1) is its
 * canonical citation number. Empty keys (from a malformed `\cite{}`) are dropped since they can
 * never resolve to a reference.
 */
export const orderedUniqueCitationKeys = (
  blocks: readonly Block<unknown>[] | null | undefined,
): string[] =>
  uniq(
    extractPageCitations(blocks)
      .map(({ citationKey }) => citationKey)
      .filter((key) => key !== ""),
  )
