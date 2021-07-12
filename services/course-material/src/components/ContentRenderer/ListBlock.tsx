import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"
import { ListAttributes } from "../../types/GutenbergBlockAttributes"

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
