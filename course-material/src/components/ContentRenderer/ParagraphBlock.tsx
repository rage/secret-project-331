import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"

interface ParagraphBlockAttributes {
  content: string
  dropCap: boolean
  textColor?: string
  backgroundColor?: string
  fontSize?: string
}

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphBlockAttributes>> = ({ data }) => {
  const attributes: ParagraphBlockAttributes = data.attributes

  const textColor = attributes.textColor ? colorMapper(attributes.textColor) : "#000000"

  // If background color is undefined, it indicates a transparent background
  // and we let the background color property unset in CSS.
  const backgroundColor = attributes.backgroundColor && colorMapper(attributes.backgroundColor)

  const fontSize = fontSizeMapper(attributes.fontSize)

  return (
    <p
      className={css`
        ${normalWidthCenteredComponentStyles}
        white-space: pre-line;
        min-width: 1px;
        color: ${textColor};
        background-color: ${backgroundColor ?? "unset"};
        font-size: ${fontSize};
        ${backgroundColor && `padding: 1.25em 2.375em;`}
      `}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.content) }}
    />
  )
}

export default ParagraphBlock
