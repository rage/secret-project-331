import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../shared-module/components/Centering/Centered"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

interface InfoBoxBlockAttributes {
  backgroundColor: string
}

const InfoBoxBlock: React.FC<BlockRendererProps<InfoBoxBlockAttributes>> = (props) => {
  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          padding: 3rem;
          background-color: ${props.data.attributes.backgroundColor};
          margin: 3rem 0;
        `}
      >
        <Centered variant="narrow">
          <InnerBlocks parentBlockProps={props} />
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(InfoBoxBlock)
