import KaTex from "katex"
import * as ReactDOMServer from "react-dom/server"

import { Term } from "../../../shared-module/bindings"
import { sanitizeCourseMaterialHtml } from "../../../utils/sanitizeCourseMaterialHtml"
import Tooltip from "../core/common/GlossaryTooltip"

const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const LATEX_CITE_REGEX = /\\cite{(.*?)}/g
const HTML_ESCAPED_AMPERSAND = "&amp;"
const KATEX_OUTPUT_FORMAT = "htmlAndMathml"
const IGNORE_CASE = "i"

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
  return ReactDOMServer.renderToString(<Tooltip term={term} />)
}

const parseGlossary = (data: string, glossary: Term[]): string => {
  let parsed = data

  glossary.forEach((item) => {
    // eslint-disable-next-line i18next/no-literal-string
    const regexString = `[^a-zA-Z0-9](${item.term})[^a-zA-Z0-9]`
    parsed = parsed.replace(new RegExp(regexString, IGNORE_CASE), (content, _) =>
      generateToolTip({ ...item, term: content }),
    )
  })

  return parsed
}

const parseCitation = (data: string) => {
  const converted = data.replace(
    LATEX_CITE_REGEX,
    // eslint-disable-next-line i18next/no-literal-string
    (_, citationId) => `<sup class="reference" data-citation-id=${citationId}>[?]</sup>`,
  )
  return converted
}

const parseText = (content: string, terms: Term[]) => {
  const sanitizedHTML = sanitizeCourseMaterialHtml(content)
  const { count, converted: parsedLatex } = convertToLatex(sanitizedHTML)
  const parsedCitation = parseCitation(parsedLatex)
  const parsedGlossary = parseGlossary(parsedCitation, terms ?? [])

  return { count, parsedText: parsedGlossary }
}

export { parseText }
