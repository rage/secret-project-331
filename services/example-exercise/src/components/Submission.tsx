import React from "react"
import { useTranslation } from "react-i18next"

import { SubmissionState } from "../pages/iframe"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { ShowExerciseMessage } from "../shared-module/iframe-protocol-types"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number
  state: SubmissionState
}

const Submission: React.FC<SubmissionProps> = ({ port, state }) => {
  const { t } = useTranslation()
  const showExercise = () => {
    if (!port) {
      return
    }
    // eslint-disable-next-line i18next/no-literal-string
    const msg: ShowExerciseMessage = { message: "show-exercise" }
    port.postMessage(msg)
  }

  // eslint-disable-next-line i18next/no-literal-string
  console.log("submission", state)

  return (
    <HeightTrackingContainer port={port}>
      <pre>{JSON.stringify(state, undefined, 2)}</pre>
      <button onClick={showExercise}>{t("show-exercise")}</button>
    </HeightTrackingContainer>
  )
}

export default Submission
