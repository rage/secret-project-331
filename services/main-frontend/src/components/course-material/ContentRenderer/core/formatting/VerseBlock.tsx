"use client"

import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."

import { VerseAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper } from "@/styles/course-material/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

interface ExtraAttributes {
  textAlign?: string
}

const VerseBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<VerseAttributes & ExtraAttributes>>
> = ({ data }) => {
  const { content, fontSize, textAlign } = data.attributes

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
