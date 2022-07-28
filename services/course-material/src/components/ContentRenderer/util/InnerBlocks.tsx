import React from "react"

import ContentRenderer, { BlockRendererProps } from ".."
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface InnerBlocksProps {
  /** For convinience, this takes the props from the parent block directly  */
  parentBlockProps: BlockRendererProps<unknown>
}

/** An implementation on how to render inner blocks in the course material  */
const InnerBlocks: React.FC<React.PropsWithChildren<InnerBlocksProps>> = ({ parentBlockProps }) => {
  const { data, id: _id, ...rest } = parentBlockProps
  return <ContentRenderer data={data.innerBlocks} {...rest} />
}

export default withErrorBoundary(InnerBlocks)
