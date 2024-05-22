import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { editExerciseRepository } from "../../../../../../services/backend/exercise-repositories"

import { ExerciseRepository } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

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
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { gitUrl: exerciseRepository.url },
  })
  const mutation = useToastMutation(
    (fields: Fields) => editExerciseRepository(exerciseRepository.id, fields.gitUrl),
    {
      notify: true,
      method: "POST",
      successMessage: t("exercise-repositories-modified"),
    },
    {
      onSuccess: () => {
        onSuccess()
      },
    },
  )

  return (
    <form onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
      <TextField
        label={t("exercise-repositories-git-url")}
        placeholder={t("exercise-repositories-git-url-placeholder")}
        {...register("gitUrl", { required: t("required-field") })}
        error={errors["gitUrl"]?.message}
      />
      <Button type="submit" size="medium" variant="primary" disabled={!isValid || isSubmitting}>
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
