import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { VerseAttributes } from "../../../../../types/GutenbergBlockAttributes"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"
import colorMapper from "../../../../styles/colorMapper"
import { fontSizeMapper } from "../../../../styles/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const VerseBlock: React.FC<React.PropsWithChildren<BlockRendererProps<VerseAttributes>>> = ({
  data,
}) => {
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
        ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
        ${gradient && `background: ${colorMapper(gradient)};`}
        ${textColor && `color: ${colorMapper(textColor)};`}
        ${textAlign && `text-align: ${textAlign};`}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        white-space: pre-wrap;
      `}
      {...(anchor && { id: anchor })}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content) }} />
    </pre>
  )
}

export default withErrorBoundary(VerseBlock)
