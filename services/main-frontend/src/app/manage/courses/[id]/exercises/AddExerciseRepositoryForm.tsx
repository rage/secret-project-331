"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createExerciseRepositoryMutation as addExerciseRepositoryMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"

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
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
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
        label={t("exercise-repositories-git-url")}
        placeholder={t("exercise-repositories-git-url-placeholder")}
        error={errors["gitUrl"]?.message}
        {...register("gitUrl", { required: t("required-field") })}
      />
      <TextAreaField
        label={t("public-key")}
        placeholder={
          // oxlint-disable-next-line i18next/no-literal-string
          "ssh-ed25519 ..."
        }
        {...register("publicKey")}
        errorMessage={errors["publicKey"]?.message}
      />
      <TextAreaField
        label={t("exercise-repositories-deploy-key")}
        placeholder={
          // oxlint-disable-next-line i18next/no-literal-string
          "-----BEGIN OPENSSH PRIVATE KEY----- ..."
        }
        {...register("deployKey")}
        errorMessage={errors["deployKey"]?.message}
      />
      <Button
        size="medium"
        variant="primary"
        disabled={!isValid || isSubmitting || mutation.isPending}
      >
        {t("add")}
      </Button>
      <Button size="medium" variant="tertiary" onClick={onCancel}>
        {t("button-text-cancel")}
      </Button>
    </form>
  )
}

export default AddExerciseRepositoryForm
