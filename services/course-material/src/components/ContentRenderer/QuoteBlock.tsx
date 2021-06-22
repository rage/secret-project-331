import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import sanitizeHtml from "sanitize-html"
import { QuoteAttributes } from "../../types/GutenbergBlockAttributes"

const QuoteBlock: React.FC<BlockRendererProps<QuoteAttributes>> = ({ data }) => {
  const attributes: QuoteAttributes = data.attributes
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
