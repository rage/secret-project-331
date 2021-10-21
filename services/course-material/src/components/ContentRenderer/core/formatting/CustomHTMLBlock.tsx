import { css } from "@emotion/css"
import React from "react"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { HtmlAttributes } from "../../../../types/GutenbergBlockAttributes"

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
