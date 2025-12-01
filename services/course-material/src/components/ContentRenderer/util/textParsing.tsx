import KaTex from "katex"
import "katex/dist/katex.min.css"

import { StringWithHTML } from "../../../../types"
import { sanitizeCourseMaterialHtml } from "../../../utils/sanitizeCourseMaterialHtml"

import { Term } from "@/shared-module/common/bindings"

const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const LATEX_CITE_REGEX = /\\cite(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?{(.*?)}/g
const HTML_ESCAPED_AMPERSAND = "&amp;"
const KATEX_OUTPUT_FORMAT = "htmlAndMathml"
const REGEX_MODE = "gm"

/**
 *
 * @param data HTML-content from the server
 * @returns HTML as string in which "[latex] ... [/latex]" will be replaced with katex
 */
const convertToLatex = (data: string) => {
  let count = 0
  const converted = data.replace(LATEX_REGEX, (_, latex) => {
    // Convert ampersand back to special symbol. This is needed e.g. in matrices
    const processed = latex.replaceAll(HTML_ESCAPED_AMPERSAND, "&")
    count++
    return KaTex.renderToString(processed, {
      throwOnError: false,
      output: KATEX_OUTPUT_FORMAT,
    })
  })

  return { count, converted }
}

const parseGlossary = (data: string, glossary: Term[]): { parsedText: string; terms: Term[] } => {
  let parsed = data
  let usedGlossary: Term[] = []

  glossary.forEach((item) => {
    // eslint-disable-next-line i18next/no-literal-string
    const regexString = `\\b(${item.term})\\b`
    parsed = parsed.replace(new RegExp(regexString, REGEX_MODE), (_content, _) => {
      usedGlossary.push(item)
      // eslint-disable-next-line i18next/no-literal-string
      return `<span data-glossary-id="${item.id}"></span>`
    })
  })

  return { parsedText: parsed, terms: usedGlossary }
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
        ? // eslint-disable-next-line i18next/no-literal-string
          ` data-citation-prenote="${actualPrenote.replace(/"/g, "&quot;").replace(/~/g, "&nbsp;")}"`
        : ""
      const postnoteAttr = actualPostnote
        ? // eslint-disable-next-line i18next/no-literal-string
          ` data-citation-postnote="${actualPostnote.replace(/"/g, "&quot;").replace(/~/g, "&nbsp;")}"`
        : ""
      // eslint-disable-next-line i18next/no-literal-string
      return `<span data-citation-id="${citationId}"${prenoteAttr}${postnoteAttr}></span>`
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
