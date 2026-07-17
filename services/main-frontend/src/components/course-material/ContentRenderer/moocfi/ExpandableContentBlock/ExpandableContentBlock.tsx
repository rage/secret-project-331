"use client"

import { css } from "@emotion/css"
import React from "react"

import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../.."

interface ExpandableContentBlockProps {
  name: string
}

const ExpandableContentBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExpandableContentBlockProps>>
> = (props) => {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 6px;
      `}
    >
      {<InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />}
    </div>
  )
}

export default withErrorBoundary(ExpandableContentBlock)
