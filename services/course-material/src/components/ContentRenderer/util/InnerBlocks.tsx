import React from "react"

import ContentRenderer, { BlockRendererProps } from ".."
import withErrorBoundary from "../../../shared-module/common/utils/withErrorBoundary"

interface InnerBlocksProps {
  /** For convinience, this takes the props from the parent block directly  */
  parentBlockProps: BlockRendererProps<unknown>
}

/** An implementation on how to render inner blocks in the course material  */
const InnerBlocks: React.FC<React.PropsWithChildren<InnerBlocksProps>> = ({ parentBlockProps }) => {
  const { data, id: _id, ...rest } = parentBlockProps
  return (
    <ContentRenderer
      data={data.innerBlocks}
      {...rest}
      /// The wrapper div providing styles must be skipped for innerblocks because list block's inner blocks cannot contain any div elements. See: https://dequeuniversity.com/rules/axe/4.4/list
      dontAddWrapperDivMeantForMostOutermostContentRenderer
    />
  )
}

export default withErrorBoundary(InnerBlocks)
