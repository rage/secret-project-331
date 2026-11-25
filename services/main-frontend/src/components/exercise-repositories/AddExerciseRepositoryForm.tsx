"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createExerciseRepositoryMutation as addExerciseRepositoryMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button } from "@/shared-module/components"

import ExerciseRepositoryFields, {
  EMPTY_EXERCISE_REPOSITORY_FIELDS,
  type ExerciseRepositoryFieldValues,
  toRepositoryBody,
} from "./ExerciseRepositoryFields"

interface Props {
  courseId: string | null
  examId: string | null
  onSuccess: () => void
  onCancel: () => void
}

const AddExerciseRepositoryForm: React.FC<Props> = ({ courseId, examId, onSuccess, onCancel }) => {
  const { t } = useTranslation()

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
  } = useForm<ExerciseRepositoryFieldValues>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: EMPTY_EXERCISE_REPOSITORY_FIELDS,
  })
  const mutation = useToastMutationOptions(
    addExerciseRepositoryMutationOptions(),
    {
      notify: true,
      method: "POST",
      successMessage: t("exercise-repositories-added"),
    },
    {
      onSuccess: () => {
        onSuccess()
        reset()
      },
    },
  )

  return (
    <form
      onSubmit={handleSubmit((fields) =>
        mutation.mutate({
          body: { course_id: courseId, exam_id: examId, ...toRepositoryBody(fields) },
        }),
      )}
    >
      <ExerciseRepositoryFields
        control={control}
        deployKeyLabel={t("exercise-repositories-deploy-key")}
      />
      <Button
        type="submit"
        size="medium"
        variant="primary"
        disabled={!isValid || isSubmitting || mutation.isPending}
      >
        {t("add")}
      </Button>
      <Button size="medium" variant="tertiary" type="button" onClick={onCancel}>
        {t("button-text-cancel")}
      </Button>
    </form>
  )
}

export default AddExerciseRepositoryForm
