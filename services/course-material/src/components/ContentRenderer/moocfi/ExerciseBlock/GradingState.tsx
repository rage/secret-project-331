import { Namespace, TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  CourseMaterialPeerOrSelfReviewConfig,
  Exercise,
  GradingProgress,
  ReviewingStage,
} from "../../../../shared-module/bindings"
import YellowBox from "../../../YellowBox"

interface GradingStateProps {
  gradingProgress: GradingProgress
  reviewingStage: ReviewingStage
  peerOrSelfReviewConfig: CourseMaterialPeerOrSelfReviewConfig | null
  exercise: Exercise
}
const GradingState: React.FC<React.PropsWithChildren<GradingStateProps>> = ({
  gradingProgress,
  reviewingStage,
  peerOrSelfReviewConfig,
  exercise,
}) => {
  const { t } = useTranslation()

  const text = useMemo(
    () => getText(reviewingStage, gradingProgress, peerOrSelfReviewConfig, exercise, t),
    [gradingProgress, peerOrSelfReviewConfig, reviewingStage, exercise, t],
  )

  if (text === null) {
    return null
  }

  return (
    <YellowBox>
      <p>{text}</p>
    </YellowBox>
  )
}

const getText = (
  reviewingStage: ReviewingStage,
  gradingProgress: GradingProgress,
  peerOrSelfReviewConfig: CourseMaterialPeerOrSelfReviewConfig | null,
  exercise: Exercise,
  t: TFunction<Namespace<"course-material">, Namespace<"course-material">>,
): string | null => {
  if (peerOrSelfReviewConfig && reviewingStage === "NotStarted") {
    if (exercise.needs_peer_review && exercise.needs_self_review) {
      return t("help-text-exercise-involves-peer-review-and-self-review", {
        peer_reviews_to_give: peerOrSelfReviewConfig.peer_reviews_to_give,
      })
    }
    if (exercise.needs_peer_review) {
      return t("help-text-exercise-involves-only-peer-review", {
        peer_reviews_to_give: peerOrSelfReviewConfig.peer_reviews_to_give,
      })
    }
    if (exercise.needs_self_review) {
      return t("help-text-exercise-involves-only-self-review")
    }
  }
  if (reviewingStage === "NotStarted") {
    switch (gradingProgress) {
      case "Failed":
        return t("grading-failed")
      case "FullyGraded":
        return t("grading-fully-graded")
      case "NotReady":
        return ""
      case "Pending":
        return t("grading-pending")
      case "PendingManual":
        return t("grading-pending-manual")
      default:
        return null
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
      return null
  }
}

export default GradingState
