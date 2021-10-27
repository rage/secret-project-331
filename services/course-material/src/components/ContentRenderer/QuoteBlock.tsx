import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { QuoteAttributes } from "../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"

import { BlockRendererProps } from "."

const QuoteBlock: React.FC<BlockRendererProps<QuoteAttributes>> = ({ data }) => {
  const attributes: QuoteAttributes = data.attributes
  return (
    <blockquote
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
      cite={attributes.citation}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.value) }} />
      <cite dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.citation) }}></cite>
    </blockquote>
  )
}

export default QuoteBlock
