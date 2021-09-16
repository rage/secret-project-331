import { css } from "@emotion/css"
import KaTex from "katex"
import dynamic from "next/dynamic"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import colorMapper from "../../../styles/colorMapper"
import fontSizeMapper from "../../../styles/fontSizeMapper"
import { ParagraphAttributes } from "../../../types/GutenbergBlockAttributes"

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

const hasDropCap = css`
  :first-letter {
    float: left;
    font-size: 8.4em;
    line-height: 0.68;
    font-weight: 100;
    margin: 0.05em 0.1em 0 0;
    text-transform: uppercase;
    font-style: normal;
  }
`

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphAttributes>> = ({ data }) => {
  const {
    textColor,
    backgroundColor,
    fontSize,
    content,
    dropCap,
    align,
    anchor,
    // className, Additional classNames added in Advanced menu
    // direction, If read from right to left or left to right
    // style,
  } = data.attributes

  // If background color is undefined, it indicates a transparent background
  // and we let the background color property unset in CSS.
  const bgColor = colorMapper(backgroundColor, "unset")

  const sanitizedHTML = sanitizeHtml(content)
  const { count, converted } = convertToLatex(sanitizedHTML)

  const P = count > 0 ? LatexParagraph : Paragraph

  return (
    <P
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${dropCap ? hasDropCap : null}
        white-space: pre-line;
        min-width: 1px;
        color: ${colorMapper(textColor, "#000000")};
        background-color: ${bgColor};
        font-size: ${fontSizeMapper(fontSize)};
        line-height: 2rem;
        text-align: ${align ?? "left"};
      `}
      dangerouslySetInnerHTML={{
        __html: converted,
      }}
      {...(anchor ? { id: anchor } : {})}
    />
  )
}

export default ParagraphBlock
