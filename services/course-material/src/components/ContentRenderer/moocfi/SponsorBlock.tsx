import React from "react"

import { BlockRendererProps } from ".."
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import Sponsor, { SponsorProps } from "../../../shared-module/components/Sponsor"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const SponsorBlock: React.FC<BlockRendererProps<SponsorProps>> = (props) => {
  return (
    <BreakFromCentered sidebar={false}>
      <Sponsor title={props.data.attributes.title} logos={props.data.innerBlocks} />
    </BreakFromCentered>
  )
}
export default withErrorBoundary(SponsorBlock)
