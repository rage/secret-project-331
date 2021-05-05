import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

interface ParagraphBlockAttributes {
  content: string
  dropCap: boolean
}

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphBlockAttributes>> = ({ data }) => {
  const attributes: ParagraphBlockAttributes = data.attributes
  return (
    <p
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.content) }}
    />
  )
}

export default ParagraphBlock
