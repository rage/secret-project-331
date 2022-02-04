import React from "react"

import { BlockRendererProps } from "../.."
import { HtmlAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const CustomHTMLBlock: React.FC<BlockRendererProps<HtmlAttributes>> = ({ data }) => {
  const { content } = data.attributes

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "undefined") }}
    ></div>
  )
}

export default CustomHTMLBlock
