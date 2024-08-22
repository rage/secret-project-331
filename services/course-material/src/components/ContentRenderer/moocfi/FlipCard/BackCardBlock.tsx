import React from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
interface FlipCardAttributes {
  backgroundColor: string
}

const BackCardBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FlipCardAttributes>>> = (
  props,
) => {
  return (
    <div>
      <InnerBlocks parentBlockProps={props} />
    </div>
  )
}

export default withErrorBoundary(BackCardBlock)
