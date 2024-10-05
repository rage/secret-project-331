import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface InfoBoxBlockAttributes {
  backgroundColor: string
  noPadding: boolean
}

const TerminologyBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<InfoBoxBlockAttributes>>
> = (props) => {
  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          ${!props.data.attributes.noPadding && `padding: 3rem;`}
          background-color: ${props.data.attributes.backgroundColor};
        `}
      >
        <Centered variant="narrow">
          <InnerBlocks parentBlockProps={props} />
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(TerminologyBlock)
