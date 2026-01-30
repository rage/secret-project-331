"use client"

import { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import YellowBox from "@/components/course-material/YellowBox"
import {
  CourseMaterialPeerOrSelfReviewConfig,
  Exercise,
  GradingProgress,
  ReviewingStage,
} from "@/shared-module/common/bindings"

interface ExerciseStatusMessageProps {
  gradingProgress: GradingProgress | undefined
  reviewingStage: ReviewingStage | undefined
  peerOrSelfReviewConfig: CourseMaterialPeerOrSelfReviewConfig | null
  exercise: Exercise
  shouldSeeResetMessage: string | null
}

const ExerciseStatusMessage: React.FC<React.PropsWithChildren<ExerciseStatusMessageProps>> = ({
  gradingProgress,
  reviewingStage,
  peerOrSelfReviewConfig,
  exercise,
  shouldSeeResetMessage,
}) => {
  const { t } = useTranslation()

  const resetMessageText = useMemo(
    () => getResetMessageText(shouldSeeResetMessage, t),
    [shouldSeeResetMessage, t],
  )

  const statusMessageText = useMemo(
    () =>
      getStatusMessageText(reviewingStage, gradingProgress, peerOrSelfReviewConfig, exercise, t),
    [gradingProgress, peerOrSelfReviewConfig, reviewingStage, exercise, t],
  )

  if (resetMessageText === null && statusMessageText === null) {
    return null
  }

  return (
    <>
      {resetMessageText && (
        <YellowBox>
          <p>{resetMessageText}</p>
        </YellowBox>
      )}
      {statusMessageText && (
        <YellowBox>
          <p>{statusMessageText}</p>
        </YellowBox>
      )}
    </>
  )
}

function getResetMessageText(shouldSeeResetMessage: string | null, t: TFunction): string | null {
  if (shouldSeeResetMessage === null) {
    return null
  }

  switch (shouldSeeResetMessage) {
    case "reset-automatically-due-to-failed-review":
      return t("help-text-exercise-involves-reject-and-reset-automatically")
    case "flagged-answers-skip-manual-review-and-allow-retry":
      return t("help-text-flagged-answers-skip-manual-review-and-allow-retry")
    case "reset-by-staff":
      return t("help-text-exercise-involves-reject-and-reset-by-staff")
    default:
      return null
  }
}

function getStatusMessageText(
  reviewingStage: ReviewingStage | undefined,
  gradingProgress: GradingProgress | undefined,
  peerOrSelfReviewConfig: CourseMaterialPeerOrSelfReviewConfig | null,
  exercise: Exercise,
  t: TFunction,
): string | null {
  // Need valid reviewing stage and grading progress for status messages
  if (reviewingStage === undefined || gradingProgress === undefined) {
    return null
  }

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
        return null
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

export default ExerciseStatusMessage
