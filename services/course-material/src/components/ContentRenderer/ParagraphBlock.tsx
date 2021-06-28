import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"
import KaTex from "katex"

interface ParagraphBlockAttributes {
  content: string
  dropCap: boolean
  textColor?: string
  backgroundColor?: string
  fontSize?: string
}

const LATEX_REGEX = /\[latex\](.*)\[\/latex\]/
/**
 *
 * @param data HTML-content from the server
 * @returns HTML as string in which "[latex] ... [/latex]" will be replaced with katex
 */
const convertToLatex = (data: string) => {
  return data.replaceAll(LATEX_REGEX, (_, latex) => {
    // Convert ampersand back to special symbol. This is needed e.g. in matrices
    const processed = latex.replaceAll("&amp;", "&")
    return KaTex.renderToString(processed, {
      throwOnError: false,
      output: "mathml",
    })
  })
}

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphBlockAttributes>> = ({ data }) => {
  const attributes: ParagraphBlockAttributes = data.attributes

  const textColor = colorMapper(attributes.textColor, "#000000")

  // If background color is undefined, it indicates a transparent background
  // and we let the background color property unset in CSS.
  const backgroundColor = colorMapper(attributes.backgroundColor, "unset")

  const fontSize = fontSizeMapper(attributes.fontSize)

  return (
    <p
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
        __html: convertToLatex(sanitizeHtml(attributes.content)),
      }}
    />
  )
}

export default ParagraphBlock
