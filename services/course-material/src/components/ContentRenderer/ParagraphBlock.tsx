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

/**
 *
 * @param content HTML-content from the server
 * @returns HTML as string in which the latex symbols '$' has been replaced with latex
 */
const convertToLatex = (content: string) => {
  let result = ""
  let buffer = ""
  let type = 0

  for (let i = 0; i < content.length; i++) {
    if (content[i] === "$" && type === 0) {
      // Latex block started
      if (i + 1 < content.length) {
        if (content[i + 1] === "$") {
          type = 2
          i++
        } else {
          type = 1
        }
      } else {
        type = 1
      }
      // Save it to the buffer
      if (buffer.length > 0) {
        result += buffer
        buffer = ""
      }
    } else if (content[i] === "$" && type > 0) {
      // Latex block ended
      // Skip next '$'
      if (type === 2) {
        i++
      }

      // Save it to the buffer
      if (buffer.length > 0) {
        if (type === 1) {
          result += KaTex.renderToString(buffer, {
            throwOnError: false,
            output: "mathml",
          })
        } else if (type === 2) {
          result += KaTex.renderToString(buffer, {
            throwOnError: false,
            displayMode: true,
            output: "mathml",
          })
        }
        buffer = ""
      }

      // No longer in the latex block
      // '$' needed to scan is zero.
      type = 0
    } else {
      buffer += content[i]
    }
  }

  // In case there's still remaining data in the buffer
  if (buffer.length > 0) {
    result += buffer
  }

  return result
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
      dangerouslySetInnerHTML={{ __html: convertToLatex(sanitizeHtml(attributes.content)) }}
    />
  )
}

export default ParagraphBlock
