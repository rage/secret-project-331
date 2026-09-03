"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createExerciseRepositoryMutation as addExerciseRepositoryMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, TextArea, TextField } from "@/shared-module/components"

interface Props {
  courseId: string | null
  examId: string | null
  onSuccess: () => void
  onCancel: () => void
}

interface Fields {
  gitUrl: string
  publicKey: string
  deployKey: string
}

const AddExerciseRepositoryForm: React.FC<Props> = ({ courseId, examId, onSuccess, onCancel }) => {
  const { t } = useTranslation()

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
  } = useForm<Fields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { gitUrl: "" },
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
          body: {
            course_id: courseId,
            exam_id: examId,
            git_url: fields.gitUrl,
            public_key: fields.publicKey.length > 0 ? fields.publicKey : null,
            deploy_key: fields.deployKey.length > 0 ? fields.deployKey : null,
          },
        }),
      )}
    >
      <TextField
        name="gitUrl"
        control={control}
        label={t("exercise-repositories-git-url")}
        rules={{ required: t("required-field") }}
      />
      <TextArea name="publicKey" control={control} label={t("public-key")} />
      <TextArea name="deployKey" control={control} label={t("exercise-repositories-deploy-key")} />
      <Button
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
