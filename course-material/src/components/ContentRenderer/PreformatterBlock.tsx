import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"

interface PreformatterBlockAttributes {
  content: string
  gradient?: string
  backgroundColor?: string
  textColor?: string
  fontSize?: string
}

const PreformatterBlock: React.FC<BlockRendererProps<PreformatterBlockAttributes>> = ({ data }) => {
  const attributes: PreformatterBlockAttributes = data.attributes

  const textColor = colorMapper(attributes.textColor, "#000000")
  const fontSize = fontSizeMapper(attributes.fontSize)
  const backgroundColor = colorMapper(attributes.gradient ?? attributes.backgroundColor)

  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
        color: ${textColor};
        font-size: ${fontSize};
        white-space: pre-line;
        background: ${backgroundColor};
        padding: 1.25em 2.375em;
      `}
    >
      <div
        className={css`
          overflow-wrap: "break-word";
        `}
      >
        {attributes.content}
      </div>
    </pre>
  )
}

export default PreformatterBlock
