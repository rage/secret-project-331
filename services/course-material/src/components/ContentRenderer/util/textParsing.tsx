import KaTex from "katex"
import { renderToString } from "react-dom/server"
import "katex/dist/katex.min.css"

import { StringWithHTML } from "../../../../types"
import { Term } from "../../../shared-module/common/bindings"
import { sanitizeCourseMaterialHtml } from "../../../utils/sanitizeCourseMaterialHtml"
import Tooltip from "../core/common/GlossaryTooltip"

const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const LATEX_CITE_REGEX = /\\cite{(.*?)}/g
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

const generateToolTip = (term: Term) => {
  return renderToString(<Tooltip term={term} />)
}

const parseGlossary = (data: string, glossary: Term[]): string => {
  let parsed = data

  glossary.forEach((item) => {
    // eslint-disable-next-line i18next/no-literal-string
    const regexString = `\\b(${item.term})\\b`
    parsed = parsed.replace(new RegExp(regexString, REGEX_MODE), (content, _) =>
      generateToolTip({ ...item, term: content }),
    )
  })

  return parsed
}

const parseCitation = (data: string) => {
  const converted = data.replace(
    LATEX_CITE_REGEX,
    // eslint-disable-next-line i18next/no-literal-string
    (_, citationId) =>
      // eslint-disable-next-line i18next/no-literal-string
      `<sup class="reference" data-citation-id="${citationId}" style="line-height: 1.5em;">[?]</sup>`,
  )
  return converted
}

const parseText = (
  content: string | undefined | StringWithHTML,
  terms: Term[],
  options: { glossary: boolean } = { glossary: true },
) => {
  const sanitizedHTML = sanitizeCourseMaterialHtml(content)
  const { count, converted: parsedLatex } = convertToLatex(sanitizedHTML)
  const parsedCitation = parseCitation(parsedLatex)

  let parsedText = parsedCitation
  let hasCitationsOrGlossary = false

  if (options.glossary) {
    parsedText = parseGlossary(parsedCitation, terms ?? [])
  }

  hasCitationsOrGlossary = parsedLatex !== parsedText

  // Sanitation always needs to be the last step because otherwise we might accidentally introduce injection attacks with our custom parsing and modifications to the string
  parsedText = sanitizeCourseMaterialHtml(parsedText)
  return { count, parsedText, hasCitationsOrGlossary }
}

export { parseText }
