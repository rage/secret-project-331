import { css } from "@emotion/css"
import KaTex from "katex"
import dynamic from "next/dynamic"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../"
import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import colorMapper from "../../../styles/colorMapper"
import fontSizeMapper from "../../../styles/fontSizeMapper"

interface ParagraphBlockAttributes {
  content: string
  dropCap: boolean
  textColor?: string
  backgroundColor?: string
  fontSize?: string
}

const Paragraph = dynamic(() => import("./BasicParagraph"))
const LatexParagraph = dynamic(() => import("./LatexParagraph"))

const LATEX_REGEX = /\[latex\](.*)\[\/latex\]/g

/**
 *
 * @param data HTML-content from the server
 * @returns HTML as string in which "[latex] ... [/latex]" will be replaced with katex
 */
const convertToLatex = (data: string) => {
  let count = 0
  const converted = data.replace(LATEX_REGEX, (_, latex) => {
    // Convert ampersand back to special symbol. This is needed e.g. in matrices
    const processed = latex.replaceAll("&amp;", "&")
    count++
    return KaTex.renderToString(processed, {
      throwOnError: false,
      output: "html",
    })
  })

  return { count, converted }
}

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphBlockAttributes>> = ({ data }) => {
  const attributes: ParagraphBlockAttributes = data.attributes

  const textColor = colorMapper(attributes.textColor, "#000000")

  // If background color is undefined, it indicates a transparent background
  // and we let the background color property unset in CSS.
  const backgroundColor = colorMapper(attributes.backgroundColor, "unset")

  const fontSize = fontSizeMapper(attributes.fontSize)
  const sanitizedHTML = sanitizeHtml(attributes.content)
  const { count, converted } = convertToLatex(sanitizedHTML)

  const P = count > 0 ? LatexParagraph : Paragraph

  return (
    <P
      className={css`
        ${normalWidthCenteredComponentStyles}
        white-space: pre-line;
        min-width: 1px;
        color: ${textColor};
        background-color: ${backgroundColor};
        font-size: ${fontSize};
        ${backgroundColor && `padding: 1.25em 2.375em;`}
      `}
      dangerouslySetInnerHTML={{
        __html: converted,
      }}
    />
  )
}

export default ParagraphBlock
