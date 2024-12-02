import React from "react"

import { BlockRendererProps } from ".."

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Partner, { PartnerProps } from "@/shared-module/common/components/Partner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const PartnersBlock: React.FC<React.PropsWithChildren<BlockRendererProps<PartnerProps>>> = (
  props,
) => {
  return (
    <BreakFromCentered sidebar={false}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Partner logos={props.data.innerBlocks as any} />
    </BreakFromCentered>
  )
}
export default withErrorBoundary(PartnersBlock)
