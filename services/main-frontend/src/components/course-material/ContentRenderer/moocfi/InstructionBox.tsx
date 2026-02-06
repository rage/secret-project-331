"use client"

import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."

import ParsedText from "@/components/course-material/ParsedText"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface InstructionBoxAttributes {
  content: string
}

const InstructionBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<InstructionBoxAttributes>>
> = (props) => {
  return (
    <>
      <div
        className={css`
          padding: 1rem 0rem;
          background-color: #f2f7fc;
          margin: 1rem 0;
          border: 2px ${baseTheme.colors.purple[300]} dashed;
          ${respondToOrLarger.md} {
            padding: 1rem 1.5rem;
          }
        `}
      >
        <div
          className={css`
            max-width: 48rem;
            margin-left: auto;
            margin-right: auto;
            padding: 0rem 1rem;

            ${respondToOrLarger.md} {
              padding: 0rem 1.375rem;
            }

            span {
              font-size: 18px;
              color: ${baseTheme.colors.gray[600]};

              ${respondToOrLarger.md} {
                font-size: 20px;
              }
            }
          `}
        >
          <ParsedText text={props.data.attributes.content} tag="span" useWrapperElement={true} />
        </div>
      </div>
    </>
  )
}

export default withErrorBoundary(InstructionBlock)
