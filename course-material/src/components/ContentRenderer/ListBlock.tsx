import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

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
      dangerouslySetInnerHTML={{ __html: attributes.values }}>
    </ol>)
  } else {
    return (
      <ul
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
        dangerouslySetInnerHTML={{ __html: attributes.values }}
      >
      </ul>
    )
  }
}

export default ListBlock
