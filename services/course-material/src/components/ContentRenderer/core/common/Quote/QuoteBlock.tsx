import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import { QuoteAttributes } from "../../../../../types/GutenbergBlockAttributes"

const QuoteBlock: React.FC<BlockRendererProps<QuoteAttributes>> = ({ data }) => {
  const { citation, value, anchor } = data.attributes
  return (
    <blockquote
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
      cite={citation}
      {...(anchor && { id: anchor })}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />
      <cite dangerouslySetInnerHTML={{ __html: sanitizeHtml(citation) }}></cite>
    </blockquote>
  )
}

export default QuoteBlock
