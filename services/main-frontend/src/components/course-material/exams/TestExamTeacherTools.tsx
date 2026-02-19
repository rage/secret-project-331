"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { resetExamProgress, updateShowExerciseAnswers } from "@/services/course-material/backend"
import type { ExamData } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface TestExamTeacherToolsProps {
  examId: string
  examData: ExamData
}

/** Reset progress and show-answers controls for teacher testing; renders nothing when not is_teacher_testing. */
export default function TestExamTeacherTools({ examId, examData }: TestExamTeacherToolsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showExamAnswers, setShowExamAnswers] = useState<boolean>(false)

  useEffect(() => {
    if (examData.enrollment_data.tag === "EnrolledAndStarted") {
      setShowExamAnswers(examData.enrollment_data.enrollment.show_exercise_answers ?? false)
    }
  }, [examData])

  const showAnswersMutation = useToastMutation(
    (showAnswers: boolean) => updateShowExerciseAnswers(examId, showAnswers),
    { notify: false },
    { onSuccess: () => queryClient.refetchQueries() },
  )

  const resetExamMutation = useToastMutation(
    () => resetExamProgress(examId),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        showAnswersMutation.mutate(false)
        await queryClient.refetchQueries()
      },
    },
  )

  const handleResetProgress = useCallback(() => {
    resetExamMutation.mutate()
  }, [resetExamMutation])

  const handleShowAnswers = useCallback(() => {
    const next = !showExamAnswers
    setShowExamAnswers(next)
    showAnswersMutation.mutate(next)
  }, [showAnswersMutation, showExamAnswers])

  if (examData.enrollment_data.tag !== "EnrolledAndStarted") {
    return null
  }
  if (!examData.enrollment_data.enrollment.is_teacher_testing) {
    return null
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 20px;

        ${respondToOrLarger.sm} {
          flex-direction: row;
          align-items: baseline;
        }

        span {
          font-size: 20px;
          font-family: ${headingFont};
          font-weight: ${fontWeights.semibold};
          color: ${baseTheme.colors.gray[700]};
        }
      `}
    >
      <Button
        className={css`
          font-size: 20px !important;
          font-family: ${headingFont} !important;
        `}
        variant="primary"
        size="medium"
        transform="capitalize"
        onClick={handleResetProgress}
      >
        {t("button-text-reset-exam-progress")}
      </Button>
      <CheckBox label={t("show-answers")} checked={showExamAnswers} onChange={handleShowAnswers} />
    </div>
  )
}
