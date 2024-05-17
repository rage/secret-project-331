import { css } from "@emotion/css"
import { useContext } from "react"

import { BlockRendererProps } from "../../.."
import { QuoteAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import InnerBlocks from "../../../util/InnerBlocks"
import { parseText } from "../../../util/textParsing"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const QuoteBlock: React.FC<BlockRendererProps<QuoteAttributes>> = (props) => {
  const { citation, value, anchor, align } = props.data.attributes
  const { terms } = useContext(GlossaryContext)

  const styleLeftDefault = css`
    padding: 0.5rem 2rem;
    margin: 2.5rem 0;
    max-width: 100%;
    border-left: 7px solid #bdc7d1;
    background: #f6f8fa;
  `
  const styleRightDefault = css`
    padding: 0.5rem 2rem;
    margin: 2.5rem 0;
    max-width: 650px;
    border-right: 7px solid #bfbfbf;
    text-align: right;
  `
  const styleCenterDefault = css`
    margin-bottom: 1.75em;
    text-align: center;
  `

  return (
    <>
      <blockquote
        className={css`
          ${((align && align === "left") || !align) && styleLeftDefault}
          ${align && align === "right" && styleRightDefault}
          ${align && align === "center" && styleCenterDefault}
          margin-bottom: 1.75rem;
        `}
        cite={citation}
        {...(anchor && { id: anchor })}
      >
        <div>
          {value && (!props.data.innerBlocks || props.data.innerBlocks.length === 0) && value}
          <InnerBlocks parentBlockProps={props} />
        </div>
        <cite
          className={css`
            font-style: normal;
            font-size: 0.8125rem;
          `}
          dangerouslySetInnerHTML={{
            __html: parseText(citation, terms).parsedText,
          }}
        />
      </blockquote>
    </>
  )
}

export default withErrorBoundary(QuoteBlock)
