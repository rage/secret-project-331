"use client"

import { css } from "@emotion/css"

import type { QuoteAttributes } from "@/../types/GutenbergBlockAttributes"
import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import ParsedText from "@/components/course-material/ParsedText"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../../.."

interface ExtraAttributes {
  align?: string
}

const QuoteBlock: React.FC<BlockRendererProps<QuoteAttributes & ExtraAttributes>> = (props) => {
  const { citation, value, align } = props.data.attributes

  const styleLeftDefault = css`
    padding: 0.25rem 0 0.25rem 1.25rem;
    max-width: 100%;
    border-left: 3px solid ${baseTheme.colors.gray[200]};
  `
  const styleRightDefault = css`
    padding: 0.25rem 1.25rem 0.25rem 0;
    max-width: 650px;
    margin-left: auto;
    border-right: 3px solid ${baseTheme.colors.gray[200]};
    text-align: right;
  `
  const styleCenterDefault = css`
    text-align: center;
  `

  return (
    <blockquote
      className={css`
        ${((align && align === "left") || !align) && styleLeftDefault}
        ${align && align === "right" && styleRightDefault}
        ${align && align === "center" && styleCenterDefault}
        margin-block: 0;
      `}
      cite={citation}
    >
      <div>
        {value && (!props.data.innerBlocks || props.data.innerBlocks.length === 0) && value}
        <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
      </div>
      {citation && (
        <ParsedText
          text={citation}
          tag="footer"
          tagProps={{
            className: css`
              font-style: normal;
              font-size: 0.875rem;
              color: ${baseTheme.colors.gray[500]};
              margin-top: 0.5rem;
            `,
          }}
          useWrapperElement={true}
        />
      )}
    </blockquote>
  )
}

export default withErrorBoundary(QuoteBlock)
