import React from "react"

import { BlockRendererProps } from ".."
import Blockquote, { BlockquoteComponentProps } from "../../../shared-module/components/Blockquote"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const HeroSectionBlock: React.FC<BlockRendererProps<BlockquoteComponentProps>> = (props) => {
  return <Blockquote bodyText={props.data.attributes.bodyText} cite={props.data.attributes.cite} />
}

export default withErrorBoundary(HeroSectionBlock)
