import React from "react"

import { BlockRendererProps } from ".."
import InfoBox, { InfoBoxComponentProps } from "../../../shared-module/components/InfoBox"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const HeroSectionBlock: React.FC<BlockRendererProps<InfoBoxComponentProps>> = (props) => {
  return <InfoBox title={props.data.attributes.title} bodyText={props.data.attributes.bodyText} />
}

export default withErrorBoundary(HeroSectionBlock)
