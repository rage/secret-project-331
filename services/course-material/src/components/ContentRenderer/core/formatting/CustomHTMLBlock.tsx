import { css } from "@emotion/css"
import React from "react"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import { HtmlAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"

const CustomHTMLBlock: React.FC<BlockRendererProps<HtmlAttributes>> = ({ data }) => {
  const { content } = data.attributes

  return (
    <div
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content ?? "undefined") }}
    ></div>
  )
}

export default CustomHTMLBlock
