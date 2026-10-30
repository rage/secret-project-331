// @ts-expect-error: No type definitions
import cite from "citation-js"

import type { Block } from "@/types/courseMaterialBlock"

import { orderedUniqueCitationKeys } from "./citationExtraction"

const BIBLIOGRAPHY = "bibliography"
const EN_US = "en-US"
const STRING = "string"
const VANCOUVER = "vancouver"

export interface Citations {
  citation: string
  citationKey: string
}

/**
 * The page's citations formatted for the reference list, in first-occurrence order. Citations whose
 * key has no reference, or whose reference citation-js can't format, are left out.
 */
export function formatPageCitations(
  content: Block<unknown>[],
  references: readonly { citation_key: string; reference: string }[],
): Citations[] {
  const orderedKeys = orderedUniqueCitationKeys(content)
  if (orderedKeys.length === 0) {
    return []
  }
  const referenceByKey = new Map(references.map((x) => [x.citation_key, x]))
  const citations: Citations[] = []
  for (const key of orderedKeys) {
    const reference = referenceByKey.get(key)
    if (!reference) {
      continue
    }
    // citation-js throws on a malformed/unsupported reference string. Skip the bad entry rather
    // than letting a single reference throw during render and take out the whole accordion.
    try {
      citations.push({
        citationKey: key,
        citation: cite(reference.reference).format(BIBLIOGRAPHY, {
          type: STRING,
          style: VANCOUVER,
          lang: EN_US,
        }),
      })
    } catch {
      continue
    }
  }
  return citations
}
