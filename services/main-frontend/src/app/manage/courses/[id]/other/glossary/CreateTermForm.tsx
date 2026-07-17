"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createCourseGlossaryTermMutation } from "@/generated/api/@tanstack/react-query.generated"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { includeIf } from "@/shared-module/common/utils/nullability"

interface NewTermForm {
  newTerm: string
  newDefinition: string
}

interface CreateTermFormProps {
  refetch: () => void
  courseId: string
}

const CreateTermForm: React.FC<CreateTermFormProps> = ({ refetch, courseId }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    // oxlint-disable-next-line i18next/no-literal-string
  } = useForm<NewTermForm>({ mode: "onChange" })

  const createMutation = useToastMutationOptions(
    createCourseGlossaryTermMutation(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        reset()
        refetch()
      },
    },
  )

  const onCreate = (data: NewTermForm) => {
    createMutation.mutate({
      body: {
        definition: data.newDefinition,
        term: data.newTerm,
      },
      path: {
        course_id: courseId,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(onCreate)}>
      <TextField
        label={t("new-term")}
        placeholder={t("new-term")}
        {...register("newTerm", {
          required: true,
          pattern: {
            value: /\S+/,
            message: t("required"),
          },
        })}
        {...includeIf(errors.newTerm, { error: t("required") })}
      />
      <TextAreaField
        placeholder={t("new-definition")}
        label={t("new-definition")}
        {...register("newDefinition", {
          required: true,
          pattern: {
            value: /\S+/,
            message: t("required"),
          },
        })}
        {...includeIf(errors.newDefinition, { error: t("required") })}
      />
      <Button variant="primary" size="medium" type="submit" disabled={!isValid}>
        {t("button-text-save")}
      </Button>
    </form>
  )
}

export default CreateTermForm
