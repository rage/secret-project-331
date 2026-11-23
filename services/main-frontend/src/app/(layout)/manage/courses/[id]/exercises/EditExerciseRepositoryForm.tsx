"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateExerciseRepositoryMutation as updateExerciseRepositoryMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseRepository } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, TextArea, TextField, useDialog } from "@/shared-module/components"

interface Props {
  exerciseRepository: ExerciseRepository
  onSuccess: () => void
  onCancel: () => void
  onDelete: () => void
}

interface Fields {
  gitUrl: string
  branch: string
  publicKey: string
  deployKey: string
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
  } = useForm<Fields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      gitUrl: exerciseRepository.url,
      branch: exerciseRepository.branch ?? "",
      publicKey: "",
      deployKey: "",
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
      onSubmit={handleSubmit((fields) => {
        const deployKey = fields.deployKey.trim()
        mutation.mutate({
          path: {
            id: exerciseRepository.id,
          },
          body: {
            url: fields.gitUrl,
            branch: fields.branch.trim().length > 0 ? fields.branch.trim() : null,
            deploy_key: deployKey.length > 0 ? fields.deployKey : null,
            public_key:
              deployKey.length > 0 && fields.publicKey.length > 0 ? fields.publicKey : null,
          },
        })
      })}
    >
      <TextField
        name="gitUrl"
        control={control}
        label={t("exercise-repositories-git-url")}
        rules={{ required: t("required-field") }}
      />
      <TextField name="branch" control={control} label={t("exercise-repositories-branch")} />
      <p>
        {exerciseRepository.has_deploy_key
          ? t("exercise-repositories-deploy-key-stored")
          : t("exercise-repositories-no-deploy-key")}
      </p>
      <TextArea name="publicKey" control={control} label={t("public-key")} />
      <TextArea
        name="deployKey"
        control={control}
        label={t("exercise-repositories-replace-deploy-key")}
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
