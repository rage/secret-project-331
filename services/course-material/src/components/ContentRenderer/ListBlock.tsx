import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

import { BlockRendererProps } from "."

interface ListBlockAttributes {
  values: string
  ordered: boolean
}

const ListBlock: React.FC<BlockRendererProps<ListBlockAttributes>> = ({ data }) => {
  const attributes: ListBlockAttributes = data.attributes
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
