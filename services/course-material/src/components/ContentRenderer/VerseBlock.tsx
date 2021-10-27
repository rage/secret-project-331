import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { VerseAttributes } from "../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"

import { BlockRendererProps } from "."

const VerseBlock: React.FC<BlockRendererProps<VerseAttributes>> = ({ data }) => {
  const attributes: VerseAttributes = data.attributes

  const solidBackground =
    // eslint-disable-next-line i18next/no-literal-string
    attributes.backgroundColor !== undefined ? colorMapper(attributes.backgroundColor) : "#FFFFFF"

  const gradientBackground =
    // eslint-disable-next-line i18next/no-literal-string
    attributes.gradient !== undefined ? colorMapper(attributes.gradient) : "#FFFFFF"

  const textColor =
    attributes.textColor !== undefined ? colorMapper(attributes.textColor) : "#000000"
  const fontSize = fontSizeMapper(attributes.fontSize)

  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
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
