import React from "react"

import { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
