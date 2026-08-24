"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { GradingMode } from "@/components/grading/gradingDecision"
import { GradingDecisionDialog } from "@/components/grading/GradingDecisionDialog"
import { createTeacherGradingDecisionMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { NewTeacherGradingDecision } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import { Infobox } from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const warningTone = "warning" as const

interface ExerciseGradingCardProps {
  userExerciseStateId: string
  exerciseId: string
  exerciseMaxPoints: number
  isLatestSubmission: boolean
  /** RejectAndReset requires a course_id (see teacher_grading_decisions.rs); omit it for exam states. */
  courseId: string | null
  onGradingSubmit?: () => void
}

// RejectAndReset requires a course_id; omit it for exam states.
const AVAILABLE_MODES_WITH_COURSE: readonly GradingMode[] = [
  "award-points",
  "reject-and-reset",
  "suspected-plagiarism",
  "unauthorized-ai-use",
]
const AVAILABLE_MODES_WITHOUT_COURSE: readonly GradingMode[] = [
  "award-points",
  "suspected-plagiarism",
  "unauthorized-ai-use",
]

const ExerciseGradingCard: React.FC<ExerciseGradingCardProps> = ({
  userExerciseStateId,
  exerciseId,
  exerciseMaxPoints,
  isLatestSubmission,
  courseId,
  onGradingSubmit,
}) => {
  const { t } = useTranslation()

  const gradingMutation = useToastMutationOptions(
    createTeacherGradingDecisionMutation(),
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

  const handleGradingDecision = (decision: NewTeacherGradingDecision) => {
    gradingMutation.mutate({ body: decision })
  }

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

      <GradingDecisionDialog
        target={{ userExerciseStateId, exerciseId, exerciseMaxPoints }}
        availableModes={courseId ? AVAILABLE_MODES_WITH_COURSE : AVAILABLE_MODES_WITHOUT_COURSE}
        rejectWarning={t("warning-check-newer-submissions-before-rejecting")}
        intro={
          !isLatestSubmission && (
            <Infobox
              tone={warningTone}
              className={css`
                margin-bottom: 1rem;
              `}
            >
              {t("warning-custom-points-non-current-submission")}
            </Infobox>
          )
        }
        onSubmit={handleGradingDecision}
      />
    </div>
  )
}

export default ExerciseGradingCard
