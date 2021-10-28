import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import { PreformattedAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import colorMapper from "../../../../styles/colorMapper"
import fontSizeMapper from "../../../../styles/fontSizeMapper"

const PreformattedBlock: React.FC<BlockRendererProps<PreformattedAttributes>> = ({ data }) => {
  const { content, anchor, backgroundColor, fontSize, gradient, textColor } = data.attributes
  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${textColor && `color: ${colorMapper(textColor)};`}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        ${backgroundColor && `background-color: ${colorMapper(backgroundColor)};`}
        ${gradient && `background-color: ${colorMapper(gradient)};`}
        white-space: pre-wrap;
        padding: 1.25em 2.375em !important;
        overflow-wrap: break-word;
      `}
      {...(anchor && { id: anchor })}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content ?? "") }}
    />
  )
}

export default PreformattedBlock
