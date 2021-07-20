import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { HtmlAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const CustomHTMLBlock: React.FC<BlockRendererProps<HtmlAttributes>> = ({ data }) => {
  const attributes: HtmlAttributes = data.attributes
  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <div
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes?.content ?? "undefined") }}
      ></div>
    </pre>
  )
}

export default CustomHTMLBlock
