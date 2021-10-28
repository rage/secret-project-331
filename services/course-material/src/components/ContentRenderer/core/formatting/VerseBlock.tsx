import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import { VerseAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import colorMapper from "../../../../styles/colorMapper"
import fontSizeMapper from "../../../../styles/fontSizeMapper"

const VerseBlock: React.FC<BlockRendererProps<VerseAttributes>> = ({ data }) => {
  const {
    content,
    anchor,
    backgroundColor,
    // className,
    fontSize,
    gradient,
    // style,
    textAlign,
    textColor,
  } = data.attributes

  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
        ${gradient && `background: ${colorMapper(gradient)};`}
        ${textColor && `color: ${colorMapper(textColor)};`}
        ${textAlign && `text-align: ${textAlign};`}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        white-space: pre-wrap;
      `}
      {...(anchor && { id: anchor })}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
    </pre>
  )
}

export default VerseBlock
