import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import sanitizeHtml from "sanitize-html"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"
import { PreformattedAttributes } from "../../types/GutenbergBlockAttributes"

const PreformatterBlock: React.FC<BlockRendererProps<PreformattedAttributes>> = ({ data }) => {
  const attributes: PreformattedAttributes = data.attributes

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
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.content) }}
      ></div>
    </pre>
  )
}

export default PreformatterBlock
