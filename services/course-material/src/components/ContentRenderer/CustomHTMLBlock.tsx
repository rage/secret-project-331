import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { HtmlAttributes } from "../../types/GutenbergBlockAttributes"
import GenericLoading from "../GenericLoading"

import { BlockRendererProps } from "."

const CustomHTMLBlock: React.FC<BlockRendererProps<HtmlAttributes>> = ({ data }) => {
  const attributes: HtmlAttributes = data.attributes

  if (!attributes.content) {
    return <GenericLoading />
  }

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
