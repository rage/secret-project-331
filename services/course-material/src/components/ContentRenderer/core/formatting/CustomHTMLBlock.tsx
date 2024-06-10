import React from "react"

import { BlockRendererProps } from "../.."
import { HtmlAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CustomHTMLBlock: React.FC<React.PropsWithChildren<BlockRendererProps<HtmlAttributes>>> = ({
  data,
}) => {
  const { content } = data.attributes

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "undefined") }}
    ></div>
  )
}

export default withErrorBoundary(CustomHTMLBlock)
