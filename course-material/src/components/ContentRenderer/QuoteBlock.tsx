import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import sanitizeHtml from "sanitize-html"

interface QuoteBlockAttributes {
  value: string
  citation: string
}

const QuoteBlock: React.FC<BlockRendererProps<QuoteBlockAttributes>> = ({ data }) => {
  const attributes: QuoteBlockAttributes = data.attributes
  return (
    <blockquote
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
      cite={attributes.citation}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.value) }} />
      <cite dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.citation) }}></cite>
    </blockquote>
  )
}

export default QuoteBlock
