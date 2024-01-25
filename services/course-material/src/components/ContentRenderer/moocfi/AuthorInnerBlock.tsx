import React from "react"

import { BlockRendererProps } from ".."
import withErrorBoundary from "../../../shared-module/common/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

interface InfoBoxBlockAttributes {
  backgroundColor: string
}

const AuthorInnerBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<InfoBoxBlockAttributes>>
> = (props) => {
  return (
    <div>
      <InnerBlocks parentBlockProps={props} />
    </div>
  )
}

export default withErrorBoundary(AuthorInnerBlock)
