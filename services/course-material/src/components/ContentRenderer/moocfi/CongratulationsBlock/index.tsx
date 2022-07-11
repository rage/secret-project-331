import React from "react"

import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import Congratulations from "./Congratulations"

const CongratulationsBlock: React.FC = () => {
  return (
    <BreakFromCentered sidebar={false}>
      <Congratulations />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CongratulationsBlock)
