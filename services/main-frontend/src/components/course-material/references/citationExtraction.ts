import {
  CitationMatch,
  extractCitationsFromText,
} from "@/components/course-material/ContentRenderer/util/textParsing"
import { Block } from "@/types/courseMaterialBlock"

/**
 * Extracts citations from the page content block tree instead of the rendered DOM.
 *
 * The DOM only contains citation markers for content that is currently mounted, so citations inside
 * a collapsed expandable block are invisible to a DOM scan. Walking the block tree finds every
 * citation regardless of expand state, giving a deterministic source of truth for the reference
 * list and its numbering.
 */

type AttributeReader = (attributes: Record<string, unknown>) => string[]

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** Reads the given attribute keys as strings, in order, skipping missing/non-string values. */
const stringFields =
  (...keys: string[]): AttributeReader =>
  (attributes) =>
    keys.map((key) => asString(attributes[key])).filter((value): value is string => value !== null)

/** core/table stores text in nested head/body/foot -> rows -> cells -> content, plus a caption. */
const tableFields: AttributeReader = (attributes) => {
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
 * Per-block-name map of the attribute fields that are actually rendered through ParsedText (which
 * is what turns \cite into a citation marker). Only these fields should be scanned, so extraction
 * mirrors rendering exactly: e.g. core/quote renders `value` as plain text and only `citation`
 * through ParsedText, and moocfi/terminology-block renders `blockName` as plain JSX. Keep this map
 * in sync when a block starts (or stops) rendering a field through ParsedText.
 */
const CITATION_TEXT_FIELDS: Record<string, AttributeReader> = {
  "core/paragraph": stringFields("content"),
  "core/list": stringFields("values"),
  "core/list-item": stringFields("content"),
  "core/quote": stringFields("citation"),
  "core/image": stringFields("caption"),
  "core/table": tableFields,
  "moocfi/ingress": stringFields("title", "subtitle"),
  "moocfi/highlightbox": stringFields("title", "content"),
  "moocfi/instructionbox": stringFields("content"),
  "moocfi/aside-with-image": stringFields("title", "content"),
  "moocfi/terminology-block": stringFields("title"),
  "moocfi/research-consent-question": stringFields("content"),
}

/**
 * Fallback for block names not in the map: scan only top-level string attributes. This keeps future
 * citation-bearing blocks working before the map is updated, without reaching into nested arrays or
 * raw-rendered fields of the known blocks (those are handled explicitly above).
 */
const fallbackFields: AttributeReader = (attributes) =>
  Object.values(attributes).filter((value): value is string => typeof value === "string")

const readBlockCitations = (block: Block<unknown>): CitationMatch[] => {
  const attributes = block.attributes
  if (attributes === null || typeof attributes !== "object") {
    return []
  }
  const reader = CITATION_TEXT_FIELDS[block.name] ?? fallbackFields
  return reader(attributes as Record<string, unknown>).flatMap((text) =>
    extractCitationsFromText(text),
  )
}

/**
 * Depth-first walk of the block tree returning every citation occurrence in document order (a
 * block's own text before its inner blocks, siblings in array order). Duplicates are preserved.
 */
export const extractPageCitations = (
  blocks: ReadonlyArray<Block<unknown>> | null | undefined,
): CitationMatch[] => {
  if (!Array.isArray(blocks)) {
    return []
  }
  const occurrences: CitationMatch[] = []
  for (const block of blocks) {
    if (!block || typeof block !== "object") {
      continue
    }
    occurrences.push(...readBlockCitations(block))
    if (Array.isArray(block.innerBlocks)) {
      occurrences.push(...extractPageCitations(block.innerBlocks))
    }
  }
  return occurrences
}

/**
 * Unique citation keys in first-occurrence document order. The position of a key (index + 1) is its
 * canonical citation number. Empty keys (from a malformed `\cite{}`) are dropped since they can
 * never resolve to a reference.
 */
export const orderedUniqueCitationKeys = (
  blocks: ReadonlyArray<Block<unknown>> | null | undefined,
): string[] => {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const { citationKey } of extractPageCitations(blocks)) {
    if (citationKey && !seen.has(citationKey)) {
      seen.add(citationKey)
      ordered.push(citationKey)
    }
  }
  return ordered
}
