"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type {
  NewTeacherGradingDecision,
  TeacherDecisionType,
} from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"

import TeacherDecisionFeedbackPopup, {
  type TeacherDecisionFeedbackResult,
} from "./TeacherDecisionFeedbackPopup"

interface TeacherGradingDecisionControlsProps {
  userExerciseStateId: string
  exerciseId: string
  exerciseMaxPoints: number
  onGradingDecisionSubmit: (decision: NewTeacherGradingDecision) => void
}

const ControlPanel = styled.div`
  background: #fff;
  width: 100%;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const DECISIONS = {
  ZeroPoints: "ZeroPoints",
  FullPoints: "FullPoints",
  CustomPoints: "CustomPoints",
  RejectAndReset: "RejectAndReset",
  SuspectedPlagiarism: "SuspectedPlagiarism",
} as const satisfies Record<string, TeacherDecisionType>

const TeacherGradingDecisionControls: React.FC<TeacherGradingDecisionControlsProps> = ({
  userExerciseStateId,
  exerciseId,
  exerciseMaxPoints,
  onGradingDecisionSubmit,
}) => {
  const { t } = useTranslation()

  const handleDecision = useCallback(
    (action: TeacherDecisionType, value: number | null, justification: string | null) => {
      onGradingDecisionSubmit({
        user_exercise_state_id: userExerciseStateId,
        exercise_id: exerciseId,
        action: action,
        manual_points: value,
        justification: justification,
        hidden: false,
      })
    },
    [onGradingDecisionSubmit, userExerciseStateId, exerciseId],
  )

  const handleFullPoints = useCallback(() => {
    handleDecision(DECISIONS.FullPoints, null, null)
  }, [handleDecision])

  // FullPoints has no feedback input: giving full points is not a decision that needs explaining to the student.
  const makeFeedbackHandler = useCallback(
    (action: TeacherDecisionType) => (result: TeacherDecisionFeedbackResult) =>
      handleDecision(action, result.points, result.justification),
    [handleDecision],
  )

  return (
    <ControlPanel>
      <div
        className={css`
          margin-left: 1em;
        `}
      >
        <h3
          className={css`
            color: #4b4b4b;
            margin-bottom: 1rem;
          `}
        >
          {t("grading")}
        </h3>
      </div>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
        `}
      >
        <TeacherDecisionFeedbackPopup
          triggerLabel={t("button-text-zero-points")}
          variant="reject"
          onSubmit={makeFeedbackHandler(DECISIONS.ZeroPoints)}
        />
        <Button size="medium" variant="primary" onClick={handleFullPoints}>
          {t("button-text-full-points")}
        </Button>
        <TeacherDecisionFeedbackPopup
          triggerLabel={t("button-text-custom-points")}
          variant="white"
          pointsSlider={{ exerciseMaxPoints }}
          onSubmit={makeFeedbackHandler(DECISIONS.CustomPoints)}
        />
        <TeacherDecisionFeedbackPopup
          triggerLabel={t("button-text-reject-and-reset")}
          variant="reject"
          onSubmit={makeFeedbackHandler(DECISIONS.RejectAndReset)}
        />
        <TeacherDecisionFeedbackPopup
          triggerLabel={t("button-text-suspected-plagiarism")}
          variant="reject"
          onSubmit={makeFeedbackHandler(DECISIONS.SuspectedPlagiarism)}
        />
      </div>
    </ControlPanel>
  )
}

export default TeacherGradingDecisionControls
