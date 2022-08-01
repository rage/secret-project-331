import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { PreformattedAttributes } from "../../../../../types/GutenbergBlockAttributes"
import colorMapper from "../../../../styles/colorMapper"
import fontSizeMapper from "../../../../styles/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const PreformattedBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<PreformattedAttributes>>
> = ({ data }) => {
  const { content, anchor, backgroundColor, fontSize, gradient, textColor } = data.attributes
  return (
    <pre
      className={css`
        ${textColor && `color: ${colorMapper(textColor)};`}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        ${backgroundColor && `background-color: ${colorMapper(backgroundColor)};`}
        ${gradient && `background-color: ${colorMapper(gradient)};`}
        white-space: pre-wrap;
        padding: 1.25em 2.375em !important;
        overflow-wrap: break-word;
      `}
      {...(anchor && { id: anchor })}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "") }}
    />
  )
}

export default PreformattedBlock
