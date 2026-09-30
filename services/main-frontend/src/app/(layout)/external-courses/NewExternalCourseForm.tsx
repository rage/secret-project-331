"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { Button, Checkbox, nullIfEmpty, TextArea, TextField } from "@/shared-module/components/"

export interface NewExternalCourseFormProps {
  onSuccess?: () => void
}

export const ENGLISH_LANGUAGE_CODE = "en"
export const FINNISH_LANGUAGE_CODE = "fi"
export const NORWEGIAN_LANGUAGE_CODE = "no"
export const SWEDISH_LANGUAGE_CODE = "sv"
export const DEFAULT_LANGUAGE_CODE = ENGLISH_LANGUAGE_CODE

export const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const NewCourseForm: React.FC<NewExternalCourseFormProps> = ({ onSuccess }) => {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const createCourseMutation = useCreateCourse()

  const useFormReturn = useForm<FormFields>({
    defaultValues: {
      language_code: DEFAULT_LANGUAGE_CODE,
      copy_user_permissions: false,
      createDuplicate: false,
      ...omitUndefined({ courseId }),
      is_draft: true,
      is_test_mode: false,
      is_unlisted: false,
      is_joinable_by_code_only: false,
      join_code: null,
      ask_marketing_consent: false,
      useExistingLanguageGroup: false,
      targetCourseId: "",
      createAsLanguageVersion: false,
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useFormReturn

  const createDuplicate = watch("createDuplicate")

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit((data) => {
        createCourseMutation.mutate({
          organizationId,
          courseId: data.courseId,
          isLanguageVersion,
          createDuplicate,
          createAsLanguageVersion: data.createAsLanguageVersion,
          useExistingLanguageGroup: data.useExistingLanguageGroup,
          targetCourseId: data.targetCourseId,
          data: {
            ...data,
          },
          language_code: data.language_code,
          ...omitUndefined({ onSuccess }),
        })
      })}
    >
      <TextField></TextField>
    </form>
  )
}

export default NewCourseForm
