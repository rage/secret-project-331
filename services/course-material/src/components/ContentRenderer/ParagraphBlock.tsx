import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"
import { ParagraphAttributes } from "../../types/GutenbergBlockAttributes"

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphAttributes>> = ({ data }) => {
  const attributes: ParagraphAttributes = data.attributes

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
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.content) }}
    />
  )
}

export default ParagraphBlock
