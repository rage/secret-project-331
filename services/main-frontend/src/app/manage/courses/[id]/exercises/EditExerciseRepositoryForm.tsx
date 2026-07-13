"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateExerciseRepositoryMutation as updateExerciseRepositoryMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseRepository } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"

interface Props {
  exerciseRepository: ExerciseRepository
  onSuccess: () => void
  onCancel: () => void
  onDelete: () => void
}

interface Fields {
  gitUrl: string
}

const EditExerciseRepositoryForm: React.FC<Props> = ({
  exerciseRepository,
  onSuccess,
  onCancel,
  onDelete,
}) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
  } = useForm<Fields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { gitUrl: exerciseRepository.url },
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

  return (
    <form
      onSubmit={handleSubmit((fields) =>
        mutation.mutate({
          path: {
            id: exerciseRepository.id,
          },
          body: {
            url: fields.gitUrl,
          },
        }),
      )}
    >
      <TextField
        label={t("exercise-repositories-git-url")}
        placeholder={t("exercise-repositories-git-url-placeholder")}
        {...register("gitUrl", { required: t("required-field") })}
        error={errors["gitUrl"]?.message}
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
      <Button type="button" size="medium" variant="tertiary" onClick={onDelete}>
        {t("button-text-delete")}
      </Button>
    </form>
  )
}

export default EditExerciseRepositoryForm
