"use client"

import { css } from "@emotion/css"

import type { VerseAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper } from "@/styles/course-material/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

import type { BlockRendererProps } from "../.."

interface ExtraAttributes {
  textAlign?: string
}

const VerseBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<VerseAttributes & ExtraAttributes>>
> = ({ data }) => {
  const { content, fontSize, textAlign, fitText } = data.attributes

  return (
    <pre
      className={css`
        ${textAlign && `text-align: ${textAlign};`}
        ${fitText && `font-size: clamp(1rem, 4vw, ${fontSize ? fontSizeMapper(fontSize) : "1.5rem"});`}
        ${!fitText && fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        white-space: pre-wrap;
      `}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content) }} />
    </pre>
  )
}

export default withErrorBoundary(VerseBlock)
