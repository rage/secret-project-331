import React from "react"

import { BlockRendererProps } from ".."
import Aside, { AsideComponentProps } from "../../../shared-module/components/Aside"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const HeroSectionBlock: React.FC<BlockRendererProps<AsideComponentProps>> = (props) => {
  return <Aside title={props.data.attributes.title} bodyText={props.data.attributes.bodyText} />
}

export default withErrorBoundary(HeroSectionBlock)
