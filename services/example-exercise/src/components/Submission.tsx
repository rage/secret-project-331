import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { SubmissionResult } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number
  state: SubmissionResult
}

const Submission: React.FC<SubmissionProps> = ({ port, state }) => {
  const { t } = useTranslation()
  return (
    <HeightTrackingContainer port={port}>
      <div
        key={state.grading.id}
        className={css`
          display: flex;
          flex-flow: row no-wrap;
          justify-content: space-around;
        `}
      >
        <p>{`${t("score-given")}: ${state.grading.score_given}`}</p>
        <p>{`${t("feedback")}: ${state.grading.feedback_text}`}</p>
      </div>
    </HeightTrackingContainer>
  )
}

export default Submission
