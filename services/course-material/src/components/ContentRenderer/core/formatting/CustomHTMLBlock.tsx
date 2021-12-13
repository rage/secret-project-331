import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import { HtmlAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const CustomHTMLBlock: React.FC<BlockRendererProps<HtmlAttributes>> = ({ data }) => {
  const { content } = data.attributes

  return (
    <div
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "undefined") }}
    ></div>
  )
}

export default CustomHTMLBlock
