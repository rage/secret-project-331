import { css } from "@emotion/css"
import { Namespace, TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import { GradingProgress, ReviewingStage } from "../../../../shared-module/bindings"
import { baseTheme } from "../../../../shared-module/styles"

interface GradingStateProps {
  gradingProgress: GradingProgress
  reviewingStage: ReviewingStage
}
const GradingState: React.FC<React.PropsWithChildren<GradingStateProps>> = ({
  gradingProgress,
  reviewingStage,
}) => {
  const { t } = useTranslation()
  if (reviewingStage === "NotStarted" && gradingProgress === "FullyGraded") {
    return null
  }
  return (
    <div
      className={css`
        padding: 1rem;
        background-color: ${baseTheme.colors.yellow[200]};
        color: #493f13;
        margin: 1rem 0;
        font-size: clamp(10px, 2.5vw, 16px);
        text-align: center;
      `}
    >
      <p>{getText(reviewingStage, gradingProgress, t)}</p>
    </div>
  )
}

const getText = (
  reviewingStage: ReviewingStage,
  gradingProgress: GradingProgress,
  t: TFunction<Namespace<"course-material">, undefined, Namespace<"course-material">>,
) => {
  if (reviewingStage === "NotStarted") {
    switch (gradingProgress) {
      case "Failed":
        return t("grading-failed")
      case "FullyGraded":
        return t("grading-fully-graded")
      case "NotReady":
        return t("grading-not-ready")
      case "Pending":
        return t("grading-pending")
      case "PendingManual":
        return t("grading-pending-manual")
      default:
        return ""
    }
  }
  switch (reviewingStage) {
    case "ReviewedAndLocked":
      return t("help-text-answer-has-been-reviewed-and-locked")
    case "WaitingForManualGrading":
      return t("help-text-waiting-for-manual-grading")
    case "WaitingForPeerReviews":
      return t("help-text-waiting-for-peer-reviews")
    default:
      return ""
  }
}

export default GradingState
