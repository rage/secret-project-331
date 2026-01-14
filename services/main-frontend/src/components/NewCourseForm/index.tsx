"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import BasicCourseInfo from "./BasicCourseInfo"
import DuplicateOptions from "./DuplicateOptions"
import LanguageSelection from "./LanguageSelection"

import { useCreateCourse } from "@/hooks/useCreateCourse"
import { NewCourse } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"

export interface NewCourseFormProps {
  organizationId: string
  courseId?: string
  isLanguageVersion?: boolean
  onSuccess?: () => void
}

export interface FormFields extends Omit<NewCourse, "organization_id" | "can_add_chatbot"> {
  createDuplicate: boolean
  courseId: string
  useExistingLanguageGroup: boolean
  targetCourseId: string
  createAsLanguageVersion: boolean
}

export const ENGLISH_LANGUAGE_CODE = "en"
export const FINNISH_LANGUAGE_CODE = "fi"
export const SWEDISH_LANGUAGE_CODE = "sv"
export const DEFAULT_LANGUAGE_CODE = ENGLISH_LANGUAGE_CODE

export const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const NewCourseForm: React.FC<NewCourseFormProps> = ({
  organizationId,
  courseId,
  isLanguageVersion = false,
  onSuccess,
}) => {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const createCourseMutation = useCreateCourse()

  const useFormReturn = useForm<FormFields>({
    defaultValues: {
      language_code: DEFAULT_LANGUAGE_CODE,
      copy_user_permissions: false,
      createDuplicate: false,
      courseId: courseId,
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
          onSuccess,
        })
      })}
    >
      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {(errors.root || Boolean(createCourseMutation.error)) && (
          <ErrorBanner
            error={createCourseMutation.error || errors.root?.message}
            variant="readOnly"
          />
        )}

        <BasicCourseInfo form={useFormReturn} />

        {isLanguageVersion && (
          <FieldContainer>
            <CheckBox
              label={t("grant-access-to-users-with-permissions-to-original-course")}
              {...register("copy_user_permissions")}
            ></CheckBox>
          </FieldContainer>
        )}

        {!isLanguageVersion && (
          <DuplicateOptions form={useFormReturn} organizationId={organizationId} />
        )}

        <LanguageSelection form={useFormReturn} />
      </div>

      <div
        className={css`
          display: flex;
          justify-content: flex-end;
          margin-top: 2rem;
        `}
      >
        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={createCourseMutation.isPending}
          fullWidth
        >
          {t("button-text-create")}
        </Button>
      </div>
    </form>
  )
}

export default NewCourseForm
