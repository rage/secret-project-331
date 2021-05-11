import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import sanitizeHtml from "sanitize-html"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import ColorMapper from "../../styles/ColorMapper"
import FontSizeMapper from "../../styles/FontSizeMapper"

interface VerseBlockAttributes {
  content: string
  fontSize?: string
  textColor?: string
  backgroundColor?: string
  gradient?: string
}

const VerseBlock: React.FC<BlockRendererProps<VerseBlockAttributes>> = ({ data }) => {
  const attributes: VerseBlockAttributes = data.attributes

  const solidBackground =
    attributes.backgroundColor !== undefined ? ColorMapper(attributes.backgroundColor) : "#FFFFFF"

  const gradientBackground =
    attributes.gradient !== undefined ? ColorMapper(attributes.gradient) : "#FFFFFF"

  const textColor =
    attributes.textColor !== undefined ? ColorMapper(attributes.textColor) : "#000000"
  const fontSize = FontSizeMapper(attributes.fontSize)

  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles};
        ${attributes.backgroundColor !== undefined && `background-color: ${solidBackground};`}
        ${attributes.gradient !== undefined && `background-image: ${gradientBackground};`}
        color: ${textColor}
      `}
    >
      <div
        className={css`
          font-size: ${fontSize};
        `}
      >
        {attributes.content}{" "}
      </div>
    </pre>
  )
}

export default VerseBlock
