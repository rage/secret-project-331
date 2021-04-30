import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

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
    {attributes.value}
    <cite>{attributes.citation}</cite>
    </blockquote>

  )
}

export default QuoteBlock
