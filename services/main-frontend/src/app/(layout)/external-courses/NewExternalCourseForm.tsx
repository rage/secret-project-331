"use client"

import styled from "@emotion/styled"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  createExternalCourseMutation,
  getExternalCoursesQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { nullIfEmpty, TextArea, TextField } from "@/shared-module/components/"

export interface NewExternalCourseFormProps {
  onSuccess?: () => void
}

interface NewExternalCourseFormData {
  name: string
  description: string
  url: string
}
export const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const NewExternalCourseForm: React.FC<NewExternalCourseFormProps> = ({ onSuccess }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { control, handleSubmit } = useForm<NewExternalCourseFormData>({
    defaultValues: {
      name: "",
      description: "",
      url: "",
    },
  })

  const createExternalCourse = useToastMutationOptions(
    createExternalCourseMutation(),
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getExternalCoursesQueryKey(),
        })

        onSuccess?.()
      },
    },
  )

  const submit = handleSubmit((data) => {
    createExternalCourse.mutate({
      body: {
        name: data.name,
        description: data.description,
        url: data.url,
      },
    })
  })
  return (
    <form id="new-external-course-form" onSubmit={submit}>
      <FieldContainer>
        <TextField
          control={control}
          name="name"
          label={t("text-field-label-name")}
          rules={{
            required: t("field-cannot-be-empty"),
          }}
        />
      </FieldContainer>

      <FieldContainer>
        <TextArea
          control={control}
          name="description"
          label={t("text-field-label-description")}
          autoResize={true}
          rules={nullIfEmpty}
        />
      </FieldContainer>

      <FieldContainer>
        <TextField
          control={control}
          name="url"
          label={t("text-field-label-url")}
          rules={{
            required: t("field-cannot-be-empty"),
          }}
        />
      </FieldContainer>
    </form>
  )
}

export default NewExternalCourseForm
