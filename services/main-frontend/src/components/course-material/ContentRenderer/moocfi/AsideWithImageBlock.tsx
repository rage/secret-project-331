"use client"

import { css } from "@emotion/css"
import React from "react"

import ParsedText from "@/components/course-material/ParsedText"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

interface AsideWithImageBlockAttributes {
  title: string
  content: string
  headingLevel?: number
}

const HEADING_TAGS = { 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const

const headingStyles = css`
  line-height: 140%;
  font-family: ${primaryFont};
  margin-bottom: 1.125rem;
  font-weight: 550;
  font-size: 1.5rem;
  color: ${baseTheme.colors.gray[700]};
`

const AsideWithImageBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<AsideWithImageBlockAttributes>>
> = (props) => {
  const { title, content, headingLevel } = props.data.attributes
  const headingTag = HEADING_TAGS[headingLevel as keyof typeof HEADING_TAGS] ?? HEADING_TAGS[4]
  return (
    <div
      className={css`
        width: 100%;
        padding: 0 0 4rem 0;
        display: grid;
        grid-template-columns: 1fr;
        row-gap: 2rem;
        border-bottom: 2px solid #eaedf0;

        ${respondToOrLarger.sm} {
          grid-template-columns: 0.2fr 1fr;
          column-gap: 2.5rem;
        }

        p {
          margin: 0 !important;
          font-size: 1.125rem;
          line-height: 160%;
        }
      `}
    >
      <div
        className={css`
          width: 150px;

          figure {
            margin: 0;
          }

          img {
            width: 100%;
            height: auto;
          }
        `}
      >
        <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
      </div>
      <div>
        <ParsedText
          text={title}
          tag={headingTag}
          tagProps={{ className: headingStyles }}
          useWrapperElement={true}
        />
        <ParsedText
          text={content}
          tag="p"
          useWrapperElement={true}
          tagProps={{
            className: css`
              font-size: 1rem;
              line-height: 100%;
              font-weight: 400;
            `,
          }}
        />
      </div>
    </div>
  )
}

export default withErrorBoundary(AsideWithImageBlock)
