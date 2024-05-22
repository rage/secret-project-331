import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { addExerciseRepository } from "../../../../../../services/backend/exercise-repositories"

import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface Props {
  courseId: string | null
  examId: string | null
  onSuccess: () => void
  onCancel: () => void
}

interface Fields {
  gitUrl: string
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
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { gitUrl: "" },
  })
  const mutation = useToastMutation(
    (fields: Fields) => addExerciseRepository(courseId, examId, fields.gitUrl, fields.deployKey),
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
    <form onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
      <TextField
        label={t("exercise-repositories-git-url")}
        placeholder={t("exercise-repositories-git-url-placeholder")}
        error={errors["gitUrl"]?.message}
        {...register("gitUrl", { required: t("required-field") })}
      />
      <TextAreaField
        label={t("exercise-repositories-deploy-key")}
        // eslint-disable-next-line i18next/no-literal-string
        placeholder="\
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
"
        {...register("deployKey")}
        errorMessage={errors["deployKey"]?.message}
      />
      <Button size="medium" variant="primary" disabled={!isValid || isSubmitting}>
        {t("add")}
      </Button>
      <Button size="medium" variant="tertiary" onClick={onCancel}>
        {t("button-text-cancel")}
      </Button>
    </form>
  )
}

export default AddExerciseRepositoryForm
