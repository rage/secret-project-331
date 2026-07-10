"use client"

import KaTex from "katex"
import "katex/dist/katex.min.css"

import type { StringWithHTML } from "@/../types"
import type { Term } from "@/generated/course-material-api/types.generated"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const LATEX_CITE_REGEX = /\\cite(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?{(.*?)}/g
const HTML_ESCAPED_AMPERSAND = "&amp;"
const AMPERSAND_CHAR = "&"
const HTML_MIME_TYPE = "text/html"
const KATEX_OUTPUT_FORMAT = "htmlAndMathml"
const REGEX_MODE = "gm"

const GLOSSARY_TERM_REGEX_PREFIX = "\\b("
const GLOSSARY_TERM_REGEX_SUFFIX = ")\\b"
// Simple FIFO cache for compiled glossary term regexes; Map preserves insertion order.
const TERM_REGEX_CACHE = new Map<string, RegExp>()
const TERM_REGEX_CACHE_MAX_SIZE = 100

/** Escapes regex metacharacters in a string so it can be used literally in a RegExp. */
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const getTermRegex = (term: string): RegExp => {
  let regex = TERM_REGEX_CACHE.get(term)
  if (!regex) {
    if (TERM_REGEX_CACHE.size >= TERM_REGEX_CACHE_MAX_SIZE) {
      const oldestKey = TERM_REGEX_CACHE.keys().next().value
      if (oldestKey !== undefined) {
        TERM_REGEX_CACHE.delete(oldestKey)
      }
    }
    const escapedTerm = escapeRegex(term)
    regex = new RegExp(
      GLOSSARY_TERM_REGEX_PREFIX + escapedTerm + GLOSSARY_TERM_REGEX_SUFFIX,
      REGEX_MODE,
    )
    TERM_REGEX_CACHE.set(term, regex)
  }
  return regex
}

const SPAN_TAG = "span"
const DATA_GLOSSARY_ID_ATTR = "data-glossary-id"
let domParser: DOMParser | null = null

/** Returns a DOMParser instance, lazily created to avoid SSR issues. */
const getDomParser = (): DOMParser => {
  if (domParser) {
    return domParser
  }
  if (typeof DOMParser === "undefined") {
    throw new Error("DOMParser is not available in this environment.")
  }
  domParser = new DOMParser()
  return domParser
}

const DATA_CITATION_ID_ATTR = "data-citation-id"
const DATA_CITATION_PRENOTE_ATTR = "data-citation-prenote"
const DATA_CITATION_POSTNOTE_ATTR = "data-citation-postnote"
const HTML_ENTITY_QUOT = "&quot;"
const HTML_ENTITY_NBSP = "&nbsp;"
const QUOTE_REGEX = /"/g
const TILDE_REGEX = /~/g

/** Escapes citation-related text for safe use in HTML attributes. */
const escapeCitationText = (value: string): string =>
  value.replace(QUOTE_REGEX, HTML_ENTITY_QUOT).replace(TILDE_REGEX, HTML_ENTITY_NBSP)

/**
 * Escapes a citation key for a double-quoted HTML attribute. Unlike escapeCitationText it omits the
 * tilde -> &nbsp; display transform (a prenote/postnote display convention), so the value
 * round-trips: reading node.dataset.citationId back yields the original key and matches the keys
 * extracted from the block tree.
 */
const escapeCitationId = (value: string): string => value.replace(QUOTE_REGEX, HTML_ENTITY_QUOT)

/** Finds all whole-word matches of term in text; returns index and length for each. */
export const findTermMatches = (
  text: string,
  term: string,
): { index: number; length: number }[] => {
  const regex = getTermRegex(term)
  regex.lastIndex = 0
  const matches: { index: number; length: number }[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length })
  }
  return matches
}

/** Splits a text node at match positions and inserts span elements with data-glossary-id. */
export const replaceTextNodeWithGlossarySpans = (
  doc: Document,
  textNode: Text,
  matches: { index: number; length: number }[],
  glossaryId: string,
): void => {
  const text = textNode.textContent ?? ""
  const parent = textNode.parentNode!
  const fragment = doc.createDocumentFragment()
  let lastIndex = 0

  for (const m of matches) {
    if (m.index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.substring(lastIndex, m.index)))
    }
    // Empty span is a mounting point for the glossary tooltip portal; the user-visible
    // text is rendered later by the React tooltip component rather than being kept here.
    const span = doc.createElement(SPAN_TAG)
    span.setAttribute(DATA_GLOSSARY_ID_ATTR, glossaryId)
    fragment.appendChild(span)
    lastIndex = m.index + m.length
  }

  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.substring(lastIndex)))
  }

  parent.replaceChild(fragment, textNode)
}

/**
 *
 * @param data HTML-content from the server
 * @returns HTML as string in which "[latex] ... [/latex]" will be replaced with katex
 */
const convertToLatex = (data: string) => {
  let count = 0
  const converted = data.replace(LATEX_REGEX, (_, latex) => {
    // Convert ampersand back to special symbol. This is needed e.g. in matrices
    const processed = latex.replaceAll(HTML_ESCAPED_AMPERSAND, AMPERSAND_CHAR)
    count++
    return KaTex.renderToString(processed, {
      throwOnError: false,
      output: KATEX_OUTPUT_FORMAT,
    })
  })

  return { count, converted }
}

/** Parses glossary terms out of HTML and inserts span markers into text nodes.
 * Earlier items in the glossary array win when terms overlap, because matches
 * are removed from the DOM before later terms are processed.
 */
const parseGlossary = (data: string, glossary: Term[]): { parsedText: string; terms: Term[] } => {
  const usedGlossary: Term[] = []

  if (glossary.length === 0) {
    return { parsedText: data, terms: usedGlossary }
  }

  const doc = getDomParser().parseFromString(data, HTML_MIME_TYPE)

  for (const item of glossary) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text)
    }

    for (const textNode of textNodes) {
      const matches = findTermMatches(textNode.textContent ?? "", item.term)
      if (matches.length === 0) {
        continue
      }
      usedGlossary.push(item)
      replaceTextNodeWithGlossarySpans(doc, textNode, matches, item.id)
    }
  }

  if (usedGlossary.length === 0) {
    return { parsedText: data, terms: usedGlossary }
  }

  return { parsedText: doc.body.innerHTML, terms: usedGlossary }
}

export interface CitationMatch {
  citationKey: string
  prenote?: string
  postnote?: string
}

/**
 * Applies the single-bracket rule of \cite: `\cite[x]{k}` means x is the POSTNOTE (not the
 * prenote), while `\cite[a][b]{k}` means a=prenote, b=postnote. Shared by citation rendering and
 * citation extraction so the rendered markers and the collected reference list can't diverge.
 */
const normalizeCitationNotes = (
  prenote: string | undefined,
  postnote: string | undefined,
): { prenote: string | undefined; postnote: string | undefined } => {
  if (prenote && postnote === undefined) {
    return { prenote: undefined, postnote: prenote }
  }
  return { prenote, postnote }
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}
const HTML_ENTITY_REGEX = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi
const MAX_UNICODE_CODE_POINT = 0x10ffff

/**
 * Decodes the HTML entities a citation key can carry once it has been through the CMS's HTML
 * encoding (e.g. `a&amp;b`), so the key extracted from block content matches
 * node.dataset.citationId — which the browser has already decoded to `a&b` — and the reference's
 * stored citation_key. Kept dependency-free (no DOMParser) so it is safe during SSR.
 */
const decodeHtmlEntities = (value: string): string =>
  value.replace(HTML_ENTITY_REGEX, (whole, body: string) => {
    if (body[0] === "#") {
      const codePoint =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      if (Number.isNaN(codePoint) || codePoint < 0 || codePoint > MAX_UNICODE_CODE_POINT) {
        return whole
      }
      return String.fromCodePoint(codePoint)
    }
    return NAMED_HTML_ENTITIES[body.toLowerCase()] ?? whole
  })

/**
 * Extracts all \cite{...} occurrences from a raw text/HTML string, in document order.
 *
 * Shares LATEX_CITE_REGEX and the prenote/postnote rule with parseCitation so the citations
 * collected for the reference list and their numbering stay in lockstep with what is rendered.
 * [latex]...[/latex] regions are removed first because parseText converts LaTeX before parsing
 * citations, so a \cite inside a latex block is consumed by KaTeX and never becomes a citation.
 */
export const extractCitationsFromText = (text: string | null | undefined): CitationMatch[] => {
  if (!text) {
    return []
  }
  const withoutLatex = text.replace(LATEX_REGEX, "")
  // Fresh RegExp so the module-level global regex's lastIndex isn't shared across calls.
  const regex = new RegExp(LATEX_CITE_REGEX.source, LATEX_CITE_REGEX.flags)
  const matches: CitationMatch[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(withoutLatex)) !== null) {
    const [, prenote, postnote, citationId] = match
    const notes = normalizeCitationNotes(prenote, postnote)
    matches.push({
      citationKey: decodeHtmlEntities(citationId ?? ""),
      prenote: notes.prenote,
      postnote: notes.postnote,
    })
  }
  return matches
}

/** Parses LaTeX \\cite commands in the raw HTML string into span markers.
 * This runs before DOM-based glossary parsing and assumes citation commands
 * appear only in text content, not inside HTML attribute values.
 */
const parseCitation = (data: string) => {
  const converted = data.replace(
    LATEX_CITE_REGEX,

    (_, prenote, postnote, citationId) => {
      const notes = normalizeCitationNotes(prenote, postnote)

      const prenoteAttr = notes.prenote
        ? ` ${DATA_CITATION_PRENOTE_ATTR}="${escapeCitationText(notes.prenote)}"`
        : ""
      const postnoteAttr = notes.postnote
        ? ` ${DATA_CITATION_POSTNOTE_ATTR}="${escapeCitationText(notes.postnote)}"`
        : ""
      const escapedCitationId = escapeCitationId(citationId ?? "")
      return `<${SPAN_TAG} ${DATA_CITATION_ID_ATTR}="${escapedCitationId}"${prenoteAttr}${postnoteAttr}></${SPAN_TAG}>`
    },
  )
  return converted
}

const parseText = (
  content: string | undefined | StringWithHTML,
  terms: Term[],
  options: { glossary: boolean } = { glossary: true },
) => {
  const { count, converted: parsedLatex } = convertToLatex(content ?? "")
  const parsedCitation = parseCitation(parsedLatex)

  let parsedText = parsedCitation
  let glossaryEntries: Term[] = []

  if (options.glossary) {
    const { parsedText: glossaryParsedText, terms: usedGlossary } = parseGlossary(
      parsedCitation,
      terms ?? [],
    )
    parsedText = glossaryParsedText
    const uniqueTerms = new Map<string, Term>()
    usedGlossary.forEach((term) => {
      if (!uniqueTerms.has(term.id)) {
        uniqueTerms.set(term.id, term)
      }
    })
    glossaryEntries = Array.from(uniqueTerms.values())
  }

  const hasCitationsOrGlossary = parsedLatex !== parsedText

  // Sanitation always needs to be the last step because otherwise we might accidentally introduce injection attacks with our custom parsing and modifications to the string
  parsedText = sanitizeCourseMaterialHtml(parsedText)
  return { count, parsedText, hasCitationsOrGlossary, glossaryEntries }
}

export { parseText }
