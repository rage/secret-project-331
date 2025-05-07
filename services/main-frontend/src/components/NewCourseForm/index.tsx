import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useCreateCourseCopy } from "../../hooks/useCreateCourseCopy"

import BasicCourseInfo from "./BasicCourseInfo"
import DuplicateOptions from "./DuplicateOptions"
import LanguageSelection from "./LanguageSelection"
import LanguageVersionOptions from "./LanguageVersionOptions"

import { CopyCourseMode, Course, NewCourse } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"

export interface NewCourseFormProps {
  organizationId: string
  courseId?: string
  isLanguageVersion?: boolean
  courses?: Course[]
  onClose: () => void
  onSuccess?: () => void
  onSubmitNewCourseForm?: (newCourse: NewCourse) => Promise<void>
  onSubmitDuplicateCourseForm?: (oldCourseId: string, newCourse: NewCourse) => Promise<void>
}

export interface FormFields extends Omit<NewCourse, "organization_id"> {
  createDuplicate: boolean
  courseId: string
  useExistingLanguageGroup: boolean
  targetCourseId: string
  createAsLanguageVersion: boolean
}

export const AMERICAN_ENGLISH_LANGUAGE_CODE = "en-US"
export const FINNISH_LANGUAGE_CODE = "fi-FI"
export const SWEDISH_LANGUAGE_CODE = "sv-SE"
export const DEFAULT_LANGUAGE_CODE = AMERICAN_ENGLISH_LANGUAGE_CODE

export const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const NewCourseForm: React.FC<NewCourseFormProps> = ({
  organizationId,
  courseId,
  isLanguageVersion = false,
  courses,
  onClose,
  onSuccess,
  onSubmitNewCourseForm,
  onSubmitDuplicateCourseForm,
}) => {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const createCourseCopyMutation = useCreateCourseCopy()

  const useFormReturn = useForm<FormFields>({
    defaultValues: {
      language_code: DEFAULT_LANGUAGE_CODE,
      copy_user_permissions: false,
      createDuplicate: false,
      courseId: courses?.[0]?.id ?? "",
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
    setError: setFormError,
  } = useFormReturn

  const createDuplicate = watch("createDuplicate")

  const mutation = useToastMutation(
    async (data: FormFields) => {
      try {
        const normalizedLanguageCode = normalizeIETFLanguageTag(data.language_code)
        const newCourse: NewCourse = {
          ...data,
          organization_id: organizationId,
          language_code: normalizedLanguageCode,
        }

        if (isLanguageVersion && courseId) {
          let mode: CopyCourseMode
          if (data.useExistingLanguageGroup && data.targetCourseId) {
            // eslint-disable-next-line i18next/no-literal-string
            mode = { mode: "existing_language_group", target_course_id: data.targetCourseId }
          } else {
            // eslint-disable-next-line i18next/no-literal-string
            mode = { mode: "same_language_group" }
          }

          await createCourseCopyMutation.mutateAsync({
            courseId,
            data: {
              ...newCourse,
              mode,
            },
          })
        } else if (createDuplicate && data.courseId) {
          if (data.createAsLanguageVersion) {
            let mode: CopyCourseMode
            if (data.useExistingLanguageGroup && data.targetCourseId) {
              // eslint-disable-next-line i18next/no-literal-string
              mode = { mode: "existing_language_group", target_course_id: data.targetCourseId }
            } else {
              // eslint-disable-next-line i18next/no-literal-string
              mode = { mode: "same_language_group" }
            }

            await createCourseCopyMutation.mutateAsync({
              courseId: data.courseId,
              data: {
                ...newCourse,
                mode,
              },
            })
          } else {
            if (onSubmitDuplicateCourseForm) {
              await onSubmitDuplicateCourseForm(data.courseId, newCourse)
            } else {
              await createCourseCopyMutation.mutateAsync({
                courseId: data.courseId,
                data: {
                  ...newCourse,
                  // eslint-disable-next-line i18next/no-literal-string
                  mode: { mode: "duplicate" },
                },
              })
            }
          }
        } else {
          if (onSubmitNewCourseForm) {
            await onSubmitNewCourseForm(newCourse)
          } else {
            const response = await fetch("/api/courses", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(newCourse),
            })

            if (!response.ok) {
              throw new Error("Failed to create course")
            }
          }
        }

        if (onSuccess) {
          onSuccess()
        }
        onClose()
      } catch (e: unknown) {
        setFormError("root", { message: e?.toString() })
        throw e
      }
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("course-created-successfully"),
      errorMessage: t("error-creating-course"),
    },
  )

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit((data) => {
        setSubmitDisabled(true)
        mutation.mutate(data)
      })}
    >
      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {errors.root && <ErrorBanner error={errors.root.message} variant="readOnly" />}

        <BasicCourseInfo form={useFormReturn} />

        {!courses && (
          <FieldContainer>
            <CheckBox
              label={t("grant-access-to-users-with-permissions-to-original-course")}
              {...register("copy_user_permissions")}
            ></CheckBox>
          </FieldContainer>
        )}

        {courses && !isLanguageVersion && (
          <DuplicateOptions form={useFormReturn} courses={courses} />
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
        <Button type="submit" variant="primary" size="medium" disabled={submitDisabled} fullWidth>
          {t("button-text-create")}
        </Button>
      </div>
    </form>
  )
}

export default NewCourseForm
