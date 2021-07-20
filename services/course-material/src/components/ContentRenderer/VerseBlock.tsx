import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import colorMapper from "../../styles/colorMapper"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import fontSizeMapper from "../../styles/fontSizeMapper"
import { VerseAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const VerseBlock: React.FC<BlockRendererProps<VerseAttributes>> = ({ data }) => {
  const attributes: VerseAttributes = data.attributes

  const solidBackground =
    attributes.backgroundColor !== undefined ? colorMapper(attributes.backgroundColor) : "#FFFFFF"

  const gradientBackground =
    attributes.gradient !== undefined ? colorMapper(attributes.gradient) : "#FFFFFF"

  const textColor =
    attributes.textColor !== undefined ? colorMapper(attributes.textColor) : "#000000"
  const fontSize = fontSizeMapper(attributes.fontSize)

  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
        ${attributes.backgroundColor !== undefined && `background-color: ${solidBackground};`}
        ${attributes.gradient !== undefined && `background-image: ${gradientBackground};`}
        color: ${textColor}
      `}
    >
      <div
        className={css`
          font-size: ${fontSize};
        `}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.content) }}
      ></div>
    </pre>
  )
}

export default VerseBlock
