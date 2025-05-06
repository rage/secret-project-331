import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"

import CustomPointsPopup from "./CustomPointsPopup"

import { NewTeacherGradingDecision, TeacherDecisionType } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import { primaryFont } from "@/shared-module/common/styles"

interface TeacherGradingDecisionControlsProps {
  userExerciseStateId: string
  exerciseId: string
  exerciseMaxPoints: number
  onGradingDecisionSubmit: (decision: NewTeacherGradingDecision) => void
}

const ControlPanel = styled.div`
  background: #f5f5f5;
  width: 100%;
  height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const DECISIONS: Record<string, TeacherDecisionType> = {
  ZeroPoints: "ZeroPoints",
  FullPoints: "FullPoints",
  CustomPoints: "CustomPoints",
}

const TeacherGradingDecisionControls: React.FC<TeacherGradingDecisionControlsProps> = ({
  userExerciseStateId,
  exerciseId,
  exerciseMaxPoints,
  onGradingDecisionSubmit,
}) => {
  const { t } = useTranslation()

  const handleDecision = useCallback(
    (action: TeacherDecisionType, value?: number | undefined) => {
      const manual_points = value !== undefined ? value : null
      onGradingDecisionSubmit({
        user_exercise_state_id: userExerciseStateId,
        exercise_id: exerciseId,
        action: action,
        manual_points: manual_points,
        justification: null,
        hidden: false,
      })
    },
    [onGradingDecisionSubmit, userExerciseStateId, exerciseId],
  )

  const handleZeroPoints = useCallback(() => {
    handleDecision(DECISIONS.ZeroPoints)
  }, [handleDecision])

  const handleFullPoints = useCallback(() => {
    handleDecision(DECISIONS.FullPoints)
  }, [handleDecision])

  const handleCustomPoints = useCallback(
    (points: number) => {
      handleDecision(DECISIONS.CustomPoints, points)
    },
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
          align-items: center;
        `}
      >
        <Button
          className={css`
            font-family: ${primaryFont};
            font-weight: 600;
            font-size: 16px;
            margin-left: 1em;
            margin-right: 0.5em;
          `}
          size="medium"
          variant="reject"
          onClick={handleZeroPoints}
        >
          {t("button-text-zero-points")}
        </Button>
        <Button
          size="medium"
          variant="primary"
          className={css`
            margin-right: 0.5em;
          `}
          onClick={handleFullPoints}
        >
          {t("button-text-full-points")}
        </Button>
        <CustomPointsPopup exerciseMaxPoints={exerciseMaxPoints} onSubmit={handleCustomPoints} />
      </div>
    </ControlPanel>
  )
}

export default TeacherGradingDecisionControls
