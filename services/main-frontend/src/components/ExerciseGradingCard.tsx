"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { createTeacherGradingDecision } from "../services/backend/teacher-grading-decisions"

import CustomPointsPopup from "@/app/manage/exercises/[id]/submissions/CustomPointsPopup"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"

interface ExerciseGradingCardProps {
  userExerciseStateId: string
  exerciseId: string
  exerciseMaxPoints: number
  isLatestSubmission: boolean
  onGradingSubmit?: () => void
}

const ExerciseGradingCard: React.FC<ExerciseGradingCardProps> = ({
  userExerciseStateId,
  exerciseId,
  exerciseMaxPoints,
  isLatestSubmission,
  onGradingSubmit,
}) => {
  const { t } = useTranslation()

  // Custom points mutation
  const customPointsMutation = useToastMutation(
    async (points: number) => {
      if (!userExerciseStateId) {
        throw new Error("User exercise state not found")
      }
      return createTeacherGradingDecision({
        user_exercise_state_id: userExerciseStateId,
        exercise_id: exerciseId,
        // eslint-disable-next-line i18next/no-literal-string
        action: "CustomPoints",
        manual_points: points,
        justification: null,
        hidden: false,
      })
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        onGradingSubmit?.()
      },
    },
  )

  return (
    <div
      className={css`
        max-width: ${narrowContainerWidthRem}rem;
        margin: 0 auto 2rem auto;
        padding: 1.5rem;
        background-color: ${baseTheme.colors.clear[100]};
        border-radius: 0.5rem;
        border: 1px solid ${baseTheme.colors.clear[200]};
      `}
    >
      <h3
        className={css`
          margin: 0 0 1rem 0;
          color: ${baseTheme.colors.gray[700]};
          font-size: 1.125rem;
          font-weight: 600;
        `}
      >
        {t("exercise-grading")}
      </h3>

      <p
        className={css`
          margin: 0 0 1rem 0;
          color: ${baseTheme.colors.gray[600]};
          font-size: 0.875rem;
          line-height: 1.5;
        `}
      >
        {t(
          "custom-points-description",
          "Give custom points for the entire exercise. This will override all previous grading for this exercise.",
        )}
      </p>

      {/* Warning for non-current submission */}
      {!isLatestSubmission && (
        <div
          className={css`
            margin-bottom: 1rem;
            padding: 1rem;
            background-color: ${baseTheme.colors.yellow[100]};
            border: 1px solid ${baseTheme.colors.yellow[200]};
            border-radius: 0.25rem;
          `}
        >
          <div
            className={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <span
              className={css`
                font-weight: 600;
                color: ${baseTheme.colors.gray[700]};
              `}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {"⚠️"}
            </span>
            <span
              className={css`
                color: ${baseTheme.colors.gray[700]};
              `}
            >
              {t(
                "warning-custom-points-non-current-submission",
                "Warning: This is not the latest submission. Custom points will be applied to the entire exercise, not just this submission.",
              )}
            </span>
          </div>
        </div>
      )}

      <CustomPointsPopup
        exerciseMaxPoints={exerciseMaxPoints}
        onSubmit={(points) => customPointsMutation.mutate(points)}
        longButtonName
      />
    </div>
  )
}

export default ExerciseGradingCard
