import { nodeIsElement } from "@/shared-module/common/utils/dom"

/**
 * Resolves a placeholder's raw citation number (the `y` in a 【x:y†source】 marker,
 * stored on the placeholder span as data-citation-n) to its renumbered display value.
 * Returns null when the number has no entry in the map — i.e. the marker references a
 * citation that doesn't exist (a hallucinated citation), in which case no citation button
 * should be rendered for it.
 */
export function citationDisplayNumber(
  rawCitN: number,
  citationNumberingMap: Map<number, number>,
): number | null {
  return citationNumberingMap.get(rawCitN) ?? null
}

/** A decision for a single citation placeholder node: render a button, or render nothing. */
export type CitationPortalPlan = { rawCitN: number; citN: number } | null

/**
 * Decides, for each citation placeholder node (in DOM order), whether to render a citation
 * button and with which numbers.
 *
 * Each node carries its own citation number in data-citation-n, so the decision is
 * independent of any positional alignment with a separately-built citation list: a marker
 * that references a non-existent citation (e.g. 【x:0†source】) still produces a placeholder
 * node but resolves to `null` (no button) instead of corrupting the numbering of every
 * marker that follows it (which used to throw "Value cannot be null or undefined.").
 *
 * Consecutive citations to the same document (same display number) are collapsed to a
 * single button so the same source isn't cited multiple times in a row.
 */
export function planCitationPortals(
  nodes: Element[],
  citationNumberingMap: Map<number, number>,
): CitationPortalPlan[] {
  return nodes.map((node) => {
    // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt/parseFloat parsing is intentional; Number() would change behavior
    const rawCitN = parseInt((node as HTMLElement).dataset.citationN ?? "", 10)
    const citN = citationDisplayNumber(rawCitN, citationNumberingMap)

    if (citN === null) {
      // Unknown / hallucinated citation: render no button so the marker just disappears.
      return null
    }

    // If the previous sibling node is also a citation button pointing at the same document
    // (same display number), skip this one so we don't cite the same doc multiple times in
    // a row.
    const prev = node.previousSibling
    if (prev && nodeIsElement(prev)) {
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt/parseFloat parsing is intentional; Number() would change behavior
      const prevRawCitN = parseInt((prev as HTMLElement).dataset.citationN ?? "", 10)
      const prevCitN = citationDisplayNumber(prevRawCitN, citationNumberingMap)
      if (prevCitN !== null && prevCitN === citN) {
        return null
      }
    }

    return { rawCitN, citN }
  })
}
