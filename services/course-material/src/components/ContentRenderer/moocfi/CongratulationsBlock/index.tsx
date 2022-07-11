import React from "react"

import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import Congratulation from "../../../../shared-module/components/Congratulation"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

const CongratulationsBlock: React.FC = () => {
  return (
    <BreakFromCentered sidebar={false}>
      <Congratulation />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CongratulationsBlock)
