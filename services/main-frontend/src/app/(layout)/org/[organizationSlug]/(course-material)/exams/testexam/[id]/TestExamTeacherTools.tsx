"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  resetExamProgress,
  updateShowExerciseAnswers,
} from "@/generated/course-material-api/sdk.generated"
import type { ExamData } from "@/generated/course-material-api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Button, Checkbox } from "@/shared-module/components"

export interface TestExamTeacherToolsProps {
  examId: string
  examData: ExamData
}

/** Reset progress and show-answers controls for teacher testing; renders nothing when not is_teacher_testing. */
export default function TestExamTeacherTools({ examId, examData }: TestExamTeacherToolsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { control, setValue, watch } = useForm<{ showExamAnswers: boolean }>({
    defaultValues: { showExamAnswers: false },
  })
  const showExamAnswers = watch("showExamAnswers")

  useEffect(() => {
    if (examData.enrollment_data.tag === "EnrolledAndStarted") {
      setValue(
        "showExamAnswers",
        examData.enrollment_data.enrollment.show_exercise_answers ?? false,
      )
    }
  }, [examData, setValue])

  const showAnswersMutation = useToastMutation(
    (showAnswers: boolean) =>
      updateShowExerciseAnswers({
        body: {
          show_exercise_answers: showAnswers,
        },
        path: {
          id: examId,
        },
      }),
    { notify: false },
    { onSuccess: () => queryClient.refetchQueries() },
  )

  // Skips the mount-time invocation, which would otherwise push the field's default value to the
  // server before the sync effect above has had a chance to replace it with the real value.
  const isFirstShowAnswersEffectRef = useRef(true)
  useEffect(() => {
    if (isFirstShowAnswersEffectRef.current) {
      isFirstShowAnswersEffectRef.current = false
      return
    }
    showAnswersMutation.mutate(showExamAnswers)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [showExamAnswers])

  const resetExamMutation = useToastMutation(
    () =>
      resetExamProgress({
        path: {
          id: examId,
        },
      }),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        setValue("showExamAnswers", false)
        await queryClient.refetchQueries()
      },
    },
  )

  const handleResetProgress = useCallback(() => {
    resetExamMutation.mutate()
  }, [resetExamMutation])

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
        onClick={handleResetProgress}
      >
        {t("button-text-reset-exam-progress")}
      </Button>
      <Checkbox name="showExamAnswers" control={control} label={t("show-answers")} />
    </div>
  )
}
