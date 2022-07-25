import React from "react"

import { BlockRendererProps } from ".."
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import Sponsor, { SponsorProps } from "../../../shared-module/components/Sponsor"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const SponsorBlock: React.FC<React.PropsWithChildren<BlockRendererProps<SponsorProps>>> = (
  props,
) => {
  return (
    <BreakFromCentered sidebar={false}>
      <Sponsor logos={props.data.innerBlocks} />
    </BreakFromCentered>
  )
}
export default withErrorBoundary(SponsorBlock)
