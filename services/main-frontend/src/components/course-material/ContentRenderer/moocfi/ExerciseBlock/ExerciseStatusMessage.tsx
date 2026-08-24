"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import YellowBox from "@/components/course-material/YellowBox"
import type {
  CourseMaterialPeerOrSelfReviewConfig,
  Exercise,
  GradingProgress,
  ReviewingStage,
} from "@/generated/course-material-api/types.generated"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

interface ExerciseStatusMessageProps {
  gradingProgress: GradingProgress | undefined
  reviewingStage: ReviewingStage | undefined
  peerOrSelfReviewConfig: CourseMaterialPeerOrSelfReviewConfig | null | undefined
  exercise: Exercise
  shouldSeeResetMessage: string | null | undefined
  /** Justification text from the latest non-FullPoints teacher grading decision, if the teacher chose to share it. */
  teacherFeedback: string | null | undefined
}

const ExerciseStatusMessage: React.FC<React.PropsWithChildren<ExerciseStatusMessageProps>> = ({
  gradingProgress,
  reviewingStage,
  peerOrSelfReviewConfig,
  exercise,
  shouldSeeResetMessage,
  teacherFeedback,
}) => {
  const { t } = useTranslation()

  // A teacher who wrote feedback said something more specific than the canned reset sentence,
  // so their words replace it rather than stacking a second box on top of it.
  const resetMessageText = useMemo(
    () => (teacherFeedback ? null : getResetMessageText(shouldSeeResetMessage ?? null, t)),
    [shouldSeeResetMessage, teacherFeedback, t],
  )

  const statusMessageText = useMemo(
    () =>
      getStatusMessageText(
        reviewingStage,
        gradingProgress,
        peerOrSelfReviewConfig ?? null,
        exercise,
        t,
      ),
    [gradingProgress, peerOrSelfReviewConfig, reviewingStage, exercise, t],
  )

  if (resetMessageText === null && statusMessageText === null && !teacherFeedback) {
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
      {teacherFeedback && (
        <YellowBox>
          <p
            className={css`
              font-family: ${primaryFont};
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
              margin-bottom: 0.25rem;
            `}
          >
            {t("label-feedback")}
          </p>
          <p>{teacherFeedback}</p>
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
        return null
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
    case "Locked":
      return t("help-text-answer-has-been-locked")
    case "NotAnsweredAndLocked":
      return t("help-text-exercise-not-answered-and-locked")
    case "WaitingForManualGrading":
      return t("help-text-waiting-for-manual-grading")
    case "WaitingForPeerReviews":
      return t("help-text-waiting-for-peer-reviews")
    default:
      return null
  }
}

export default ExerciseStatusMessage
