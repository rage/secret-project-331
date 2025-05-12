import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useCreateCourseCopy, useCreateNewCourse } from "../../hooks/useCreateCourse"

import BasicCourseInfo from "./BasicCourseInfo"
import DuplicateOptions from "./DuplicateOptions"
import LanguageSelection from "./LanguageSelection"

import { CopyCourseMode, NewCourse } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"

export interface NewCourseFormProps {
  organizationId: string
  courseId?: string
  isLanguageVersion?: boolean
  onClose: () => void
  onSuccess?: () => void
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
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const createCourseCopyMutation = useCreateCourseCopy()
  const createNewCourseMutation = useCreateNewCourse()

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
    setError: setFormError,
  } = useFormReturn

  const createDuplicate = watch("createDuplicate")

  const handleFormSubmit = async (data: FormFields) => {
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
          await createCourseCopyMutation.mutateAsync({
            courseId: data.courseId,
            data: {
              ...newCourse,
              // eslint-disable-next-line i18next/no-literal-string
              mode: { mode: "duplicate" },
            },
          })
        }
      } else {
        await createNewCourseMutation.mutateAsync(newCourse)
      }

      if (onSuccess) {
        onSuccess()
      }
      onClose()
    } catch (e: unknown) {
      setFormError("root", { message: e?.toString() })
      throw e
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit((data) => {
        setSubmitDisabled(true)
        handleFormSubmit(data)
      })}
    >
      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {errors.root && <ErrorBanner error={errors.root.message} variant="readOnly" />}

        <BasicCourseInfo form={useFormReturn} />

        {isLanguageVersion ||
          (createDuplicate && (
            <FieldContainer>
              <CheckBox
                label={t("grant-access-to-users-with-permissions-to-original-course")}
                {...register("copy_user_permissions")}
              ></CheckBox>
            </FieldContainer>
          ))}

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
        <Button type="submit" variant="primary" size="medium" disabled={submitDisabled} fullWidth>
          {t("button-text-create")}
        </Button>
      </div>
    </form>
  )
}

export default NewCourseForm
