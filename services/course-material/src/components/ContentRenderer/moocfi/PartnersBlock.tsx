import React from "react"

import { BlockRendererProps } from ".."

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Sponsor, { SponsorProps } from "@/shared-module/common/components/Sponsor"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const PartnersBlock: React.FC<React.PropsWithChildren<BlockRendererProps<SponsorProps>>> = (
  props,
) => {
  return (
    <BreakFromCentered sidebar={false}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Sponsor logos={props.data.innerBlocks as any} />
    </BreakFromCentered>
  )
}
export default withErrorBoundary(PartnersBlock)
