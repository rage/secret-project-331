import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import sanitizeHtml from "sanitize-html"

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
