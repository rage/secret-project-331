import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { QuoteAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

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
