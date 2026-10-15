"use client"

import React from "react"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

interface AuthorInnerBlockAttributes {
  backgroundColor: string
}

const AuthorInnerBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<AuthorInnerBlockAttributes>>
> = (props) => {
  return (
    <div>
      <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
    </div>
  )
}

export default withErrorBoundary(AuthorInnerBlock)
