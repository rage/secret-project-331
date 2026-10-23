"use client"

import React from "react"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

const AuthorInnerBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<Record<string, never>>>
> = (props) => {
  return (
    <div>
      <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
    </div>
  )
}

export default withErrorBoundary(AuthorInnerBlock)
