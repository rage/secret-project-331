"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import YellowBox from "@/components/course-material/YellowBox"
import type {
  CourseMaterialPeerOrSelfReviewConfig,
  CourseMaterialTeacherGradingDecision,
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
  /** The latest teacher grading decision the student is allowed to see, if there is one. */
  teacherGradingDecision: CourseMaterialTeacherGradingDecision | null | undefined
}

const feedbackHeadingCss = css`
  font-family: ${primaryFont};
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin-bottom: 0.25rem;
`

const feedbackParagraphCss = css`
  & + & {
    margin-top: 0.5rem;
  }
`

const ExerciseStatusMessage: React.FC<React.PropsWithChildren<ExerciseStatusMessageProps>> = ({
  gradingProgress,
  reviewingStage,
  peerOrSelfReviewConfig,
  exercise,
  shouldSeeResetMessage,
  teacherGradingDecision,
}) => {
  const { t } = useTranslation()

  const resetMessageText = useMemo(
    () => getResetMessageText(shouldSeeResetMessage ?? null, t),
    [shouldSeeResetMessage, t],
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

  // What the decision itself means comes first, then the teacher's own words about this answer.
  const decisionExplanation = getDecisionExplanationText(
    teacherGradingDecision?.teacher_decision ?? null,
    t,
  )
  const justification = teacherGradingDecision?.justification?.trim() || null

  if (
    resetMessageText === null &&
    statusMessageText === null &&
    decisionExplanation === null &&
    justification === null
  ) {
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
      {(decisionExplanation || justification) && (
        <YellowBox>
          <p className={feedbackHeadingCss}>{t("label-feedback")}</p>
          {decisionExplanation && <p className={feedbackParagraphCss}>{decisionExplanation}</p>}
          {justification && <p className={feedbackParagraphCss}>{justification}</p>}
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

/**
 * Explains a teacher's decision to the student in the material's own words.
 *
 * Only the decisions the teacher picks as a reason say anything; the point-setting ones speak for
 * themselves through the score, so they leave the teacher's own message to stand alone.
 */
function getDecisionExplanationText(
  teacherDecision: CourseMaterialTeacherGradingDecision["teacher_decision"] | null,
  t: TFunction,
): string | null {
  switch (teacherDecision) {
    case "BadAnswer":
      return t("help-text-grading-decision-bad-answer")
    case "SuspectedPlagiarism":
      return t("help-text-grading-decision-plagiarism")
    case "UnauthorizedAiUse":
      return t("help-text-grading-decision-unauthorized-ai-use")
    case "Other":
      return t("help-text-grading-decision-other")
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
