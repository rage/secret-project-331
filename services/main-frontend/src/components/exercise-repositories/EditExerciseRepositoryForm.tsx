"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateExerciseRepositoryMutation as updateExerciseRepositoryMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseRepository } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, useDialog } from "@/shared-module/components"

import ExerciseRepositoryFields, {
  EMPTY_EXERCISE_REPOSITORY_FIELDS,
  type ExerciseRepositoryFieldValues,
  toRepositoryBody,
} from "./ExerciseRepositoryFields"

interface Props {
  exerciseRepository: ExerciseRepository
  onSuccess: () => void
  onCancel: () => void
  onDelete: () => void
}

const EditExerciseRepositoryForm: React.FC<Props> = ({
  exerciseRepository,
  onSuccess,
  onCancel,
  onDelete,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
  } = useForm<ExerciseRepositoryFieldValues>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      ...EMPTY_EXERCISE_REPOSITORY_FIELDS,
      url: exerciseRepository.url,
      branch: exerciseRepository.branch ?? "",
    },
  })
  const mutation = useToastMutationOptions(
    updateExerciseRepositoryMutationOptions(),
    {
      notify: true,
      method: "PUT",
      successMessage: t("exercise-repositories-modified"),
    },
    {
      onSuccess: () => {
        onSuccess()
      },
    },
  )

  const confirmDelete = async () => {
    const confirmed = await confirm({
      message:
        exerciseRepository.exercise_task_count > 0
          ? t("exercise-repositories-delete-confirm-in-use", {
              count: exerciseRepository.exercise_task_count,
            })
          : t("exercise-repositories-delete-confirm"),
      confirmLabel: t("button-text-delete"),
    })
    if (confirmed) {
      onDelete()
    }
  }

  return (
    <form
      onSubmit={handleSubmit((fields) =>
        mutation.mutate({ path: { id: exerciseRepository.id }, body: toRepositoryBody(fields) }),
      )}
    >
      <p>
        {exerciseRepository.has_deploy_key
          ? t("exercise-repositories-deploy-key-stored")
          : t("exercise-repositories-no-deploy-key")}
      </p>
      <ExerciseRepositoryFields
        control={control}
        deployKeyLabel={t("exercise-repositories-replace-deploy-key")}
      />
      <Button
        type="submit"
        size="medium"
        variant="primary"
        disabled={!isValid || isSubmitting || mutation.isPending}
      >
        {t("button-text-save")}
      </Button>
      <Button
        type="button"
        size="medium"
        variant="tertiary"
        onClick={() => {
          reset()
          onCancel()
        }}
      >
        {t("button-text-cancel")}
      </Button>
      <Button type="button" size="medium" variant="tertiary" onClick={() => void confirmDelete()}>
        {t("button-text-delete")}
      </Button>
    </form>
  )
}

export default EditExerciseRepositoryForm
