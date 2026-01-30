"use client"

import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import { paragraphDefaultBlockStyles } from "../common/Paragraph/styles"

import { HtmlAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

const htmlBlockParagraphStyles = css`
  p {
    ${paragraphDefaultBlockStyles}
  }
`

const CustomHTMLBlock: React.FC<React.PropsWithChildren<BlockRendererProps<HtmlAttributes>>> = ({
  data,
}) => {
  const { content } = data.attributes

  return (
    <div
      className={htmlBlockParagraphStyles}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "undefined") }}
    ></div>
  )
}

export default withErrorBoundary(CustomHTMLBlock)
