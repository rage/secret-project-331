import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface InfoBoxBlockAttributes {
  backgroundColor: string
  noPadding: boolean
}

const InfoBoxBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<InfoBoxBlockAttributes>>
> = (props) => {
  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          padding: 1rem 0;
          background-color: ${props.data.attributes.backgroundColor};

          ${respondToOrLarger.md} {
            ${!props.data.attributes.noPadding && `          padding: 3rem;`}
          }
        `}
      >
        <Centered variant="narrow">
          <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(InfoBoxBlock)
