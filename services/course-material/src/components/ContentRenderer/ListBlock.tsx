import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { ListAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const ListBlock: React.FC<BlockRendererProps<ListAttributes>> = ({ data }) => {
  const attributes: ListAttributes = data.attributes
  if (attributes.ordered) {
    return (
      <ol
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.values) }}
      ></ol>
    )
  } else {
    return (
      <ul
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.values) }}
      ></ul>
    )
  }
}

export default ListBlock
