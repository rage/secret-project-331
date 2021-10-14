import { css } from "@emotion/css"
import React from "react"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { HtmlAttributes } from "../../../../types/GutenbergBlockAttributes"
import GenericLoading from "../../../GenericLoading"

const CustomHTMLBlock: React.FC<BlockRendererProps<HtmlAttributes>> = ({ data }) => {
  const attributes: HtmlAttributes = data.attributes

  if (!attributes.content) {
    return <GenericLoading />
  }

  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      <div
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes?.content ?? "undefined") }}
      ></div>
    </pre>
  )
}

export default CustomHTMLBlock
