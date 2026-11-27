"use client"

import React from "react"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."
import { FixedBlockGapContext } from "../util/blockGap"
import InnerBlocks from "../util/InnerBlocks"

const AuthorInnerBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<Record<string, never>>>
> = (props) => {
  return (
    <div>
      {/* The image, name, bio and image credit read as one card. */}
      <FixedBlockGapContext.Provider value={0}>
        <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
      </FixedBlockGapContext.Provider>
    </div>
  )
}

export default withErrorBoundary(AuthorInnerBlock)
