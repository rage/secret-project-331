"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect, useImperativeHandle, useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { NewCourse } from "@/generated/api/types.generated"
import { useCreateCourse } from "@/hooks/useCreateCourse"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { Button, Checkbox } from "@/shared-module/components"

import BasicCourseInfo from "./BasicCourseInfo"
import DuplicateOptions from "./DuplicateOptions"
import LanguageSelection from "./LanguageSelection"

export interface NewCourseFormHandle {
  submit: () => void
}

export interface NewCourseFormProps {
  organizationId: string
  courseId?: string
  isLanguageVersion?: boolean
  onSuccess?: () => void
  /**
   * Hides the form's own submit button so a caller (e.g. a dialog footer) can drive submission
   * through the ref instead.
   */
  hideSubmitButton?: boolean
  onPendingChange?: (isPending: boolean) => void
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
export const NORWEGIAN_LANGUAGE_CODE = "no"
export const SWEDISH_LANGUAGE_CODE = "sv"
export const DEFAULT_LANGUAGE_CODE = ENGLISH_LANGUAGE_CODE

export const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const NewCourseForm = React.forwardRef<NewCourseFormHandle, NewCourseFormProps>(
  function NewCourseForm(
    {
      organizationId,
      courseId,
      isLanguageVersion = false,
      onSuccess,
      hideSubmitButton,
      onPendingChange,
    },
    ref,
  ) {
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
        description: "",
        useExistingLanguageGroup: false,
        targetCourseId: "",
        createAsLanguageVersion: false,
      },
    })

    const {
      control,
      handleSubmit,
      formState: { errors },
      watch,
    } = useFormReturn

    const createDuplicate = watch("createDuplicate")

    const submitForm = handleSubmit((data) => {
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
    })

    useImperativeHandle(ref, () => ({ submit: () => void submitForm() }), [submitForm])

    useEffect(() => {
      onPendingChange?.(createCourseMutation.isPending)
    }, [createCourseMutation.isPending, onPendingChange])

    return (
      <form ref={formRef} onSubmit={submitForm}>
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
              <Checkbox
                name="copy_user_permissions"
                control={control}
                label={t("grant-access-to-users-with-permissions-to-original-course")}
              />
            </FieldContainer>
          )}

          {!isLanguageVersion && (
            <DuplicateOptions form={useFormReturn} organizationId={organizationId} />
          )}

          <LanguageSelection form={useFormReturn} />
        </div>

        {!hideSubmitButton && (
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
              className={css`
                width: 100%;
              `}
            >
              {t("button-text-create")}
            </Button>
          </div>
        )}
      </form>
    )
  },
)

NewCourseForm.displayName = "NewCourseForm"

export default NewCourseForm
