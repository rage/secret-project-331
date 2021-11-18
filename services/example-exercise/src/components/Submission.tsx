import React from "react"

import { SubmissionState } from "../pages/iframe"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number
  state: SubmissionState
}

const Submission: React.FC<SubmissionProps> = ({ port, state }) => {
  // eslint-disable-next-line i18next/no-literal-string
  console.log("submission", state)

  return (
    <HeightTrackingContainer port={port}>
      <pre>{JSON.stringify(state, undefined, 2)}</pre>
    </HeightTrackingContainer>
  )
}

export default Submission
