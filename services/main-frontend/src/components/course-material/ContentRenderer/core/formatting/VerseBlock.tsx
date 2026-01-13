"use client"
import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."

import { VerseAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper } from "@/styles/course-material/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

const VerseBlock: React.FC<React.PropsWithChildren<BlockRendererProps<VerseAttributes>>> = ({
  data,
}) => {
  const {
    content,
    // className,
    fontSize,
    // style,
    textAlign,
  } = data.attributes

  return (
    <pre
      className={css`
        ${textAlign && `text-align: ${textAlign};`}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        white-space: pre-wrap;
      `}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content) }} />
    </pre>
  )
}

export default withErrorBoundary(VerseBlock)
