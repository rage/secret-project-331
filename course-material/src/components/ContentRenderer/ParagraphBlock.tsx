import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import ColorMapper from "../../styles/ColorMapper"
import FontSizeMapper from "../../styles/FontSizeMapper"


interface ParagraphBlockAttributes {
  content: string
  dropCap: boolean
  textColor?: string
  backgroundColor?: string 
  fontSize?: string
}

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphBlockAttributes>> = ({ data }) => {
  const attributes: ParagraphBlockAttributes = data.attributes

  const textColor = attributes.textColor !== undefined
  ? ColorMapper(attributes.textColor)
  : "#FFFFFF"

  const backgroundColor = attributes.backgroundColor !== undefined
  ? ColorMapper(attributes.backgroundColor)
  : "#000000"

  const fontSize = FontSizeMapper(attributes.fontSize)

  return (
    <p
      className={css`
        ${normalWidthCenteredComponentStyles};
        white-space: pre-line;
        min-width: 1px;
        color: ${textColor};
        background-color: ${backgroundColor};
        font-size: ${fontSize};
        ${attributes.backgroundColor !== undefined &&
        `padding: 1.25em 2.375em;`}
    }
      `}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.content) }}
    />
  )
}

export default ParagraphBlock
