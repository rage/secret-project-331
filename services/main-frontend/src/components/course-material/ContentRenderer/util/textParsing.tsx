"use client"

import KaTex from "katex"
import "katex/dist/katex.min.css"

import { StringWithHTML } from "@/../types"
import { Term } from "@/shared-module/common/bindings"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const LATEX_CITE_REGEX = /\\cite(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?{(.*?)}/g
const HTML_ESCAPED_AMPERSAND = "&amp;"
const KATEX_OUTPUT_FORMAT = "htmlAndMathml"
const REGEX_MODE = "gm"

const GLOSSARY_TERM_REGEX_PREFIX = "\\b("
const GLOSSARY_TERM_REGEX_SUFFIX = ")\\b"
const GLOSSARY_SPAN_TAG = "span"
const DATA_GLOSSARY_ID_ATTR = "data-glossary-id"
const HTML_MIME_TYPE = "text/html"

const DATA_CITATION_ID_ATTR = "data-citation-id"
const DATA_CITATION_PRENOTE_ATTR = "data-citation-prenote"
const DATA_CITATION_POSTNOTE_ATTR = "data-citation-postnote"
const HTML_ENTITY_QUOT = "&quot;"
const HTML_ENTITY_NBSP = "&nbsp;"
const AMPERSAND_CHAR = "&"

/** Finds all whole-word matches of term in text; returns index and length for each. */
export const findTermMatches = (
  text: string,
  term: string,
): { index: number; length: number }[] => {
  const regex = new RegExp(
    GLOSSARY_TERM_REGEX_PREFIX + term + GLOSSARY_TERM_REGEX_SUFFIX,
    REGEX_MODE,
  )
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
    const span = doc.createElement(GLOSSARY_SPAN_TAG)
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

const parseGlossary = (data: string, glossary: Term[]): { parsedText: string; terms: Term[] } => {
  const usedGlossary: Term[] = []

  if (glossary.length === 0) {
    return { parsedText: data, terms: usedGlossary }
  }

  const doc = new DOMParser().parseFromString(data, HTML_MIME_TYPE)

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
      matches.forEach(() => usedGlossary.push(item))
      replaceTextNodeWithGlossarySpans(doc, textNode, matches, item.id)
    }
  }

  if (usedGlossary.length === 0) {
    return { parsedText: data, terms: usedGlossary }
  }

  return { parsedText: doc.body.innerHTML, terms: usedGlossary }
}

const parseCitation = (data: string) => {
  const converted = data.replace(
    LATEX_CITE_REGEX,

    (_, prenote, postnote, citationId) => {
      let actualPrenote = prenote
      let actualPostnote = postnote

      if (prenote && postnote === undefined) {
        actualPostnote = prenote
        actualPrenote = undefined
      }

      const prenoteAttr = actualPrenote
        ? ` ${DATA_CITATION_PRENOTE_ATTR}="${actualPrenote.replace(/"/g, HTML_ENTITY_QUOT).replace(/~/g, HTML_ENTITY_NBSP)}"`
        : ""
      const postnoteAttr = actualPostnote
        ? ` ${DATA_CITATION_POSTNOTE_ATTR}="${actualPostnote.replace(/"/g, HTML_ENTITY_QUOT).replace(/~/g, HTML_ENTITY_NBSP)}"`
        : ""
      return `<${GLOSSARY_SPAN_TAG} ${DATA_CITATION_ID_ATTR}="${citationId}"${prenoteAttr}${postnoteAttr}></${GLOSSARY_SPAN_TAG}>`
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
  let hasCitationsOrGlossary = false
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

  hasCitationsOrGlossary = parsedLatex !== parsedText

  // Sanitation always needs to be the last step because otherwise we might accidentally introduce injection attacks with our custom parsing and modifications to the string
  parsedText = sanitizeCourseMaterialHtml(parsedText)
  return { count, parsedText, hasCitationsOrGlossary, glossaryEntries }
}

export { parseText }
