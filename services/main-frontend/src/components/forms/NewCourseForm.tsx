import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { normalizePath } from "../../utils/normalizePath"

import { Course, NewCourse } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  organizationId: string
  onSubmitNewCourseForm: (newCourse: NewCourse) => Promise<void>
  onSubmitDuplicateCourseForm?: (oldCourseId: string, newCourse: NewCourse) => Promise<void>
  courses?: Course[]
  onClose: () => void
}

interface FormFields extends Omit<NewCourse, "organization_id"> {
  createDuplicate: boolean
  courseId: string
}

const AMERICAN_ENGLISH_LANGUAGE_CODE = "en-US"
const FINNISH_LANGUAGE_CODE = "fi-FI"
const SWEDISH_LANGUAGE_CODE = "sv-SE"
const DEFAULT_LANGUAGE_CODE = AMERICAN_ENGLISH_LANGUAGE_CODE

const NewCourseForm: React.FC<React.PropsWithChildren<NewCourseFormProps>> = ({
  organizationId,
  onSubmitNewCourseForm,
  onSubmitDuplicateCourseForm,
  courses,
  onClose,
}) => {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const [showCustomLanguageCode, setShowCustomLanguageCode] = React.useState(false)
  const [languageCodeValidationError, setLanguageCodeValidationError] = React.useState<
    string | null
  >(null)
  const [submitDisabled, setSubmitDisabled] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    setError: setFormError,
  } = useForm<FormFields>({
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
    },
  })

  const name = watch("name")

  React.useEffect(() => {
    if (name) {
      setValue("slug", normalizePath(name))
    }
  }, [name, setValue])

  const createDuplicate = watch("createDuplicate")

  const handleDuplicateMenu = (courseId: string) => {
    const findCourse = courses?.find((course) => course.id === courseId)
    if (findCourse?.name) {
      setValue("courseId", courseId)
    }
  }

  const handleCreateNewLanguageVersion = async (data: FormFields) => {
    if (!onSubmitDuplicateCourseForm) {
      return null
    }
    try {
      const normalizedLanguageCode = normalizeIETFLanguageTag(data.language_code)
      const newCourse: NewCourse = {
        ...data,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
      }
      if (data.courseId) {
        await onSubmitDuplicateCourseForm(data.courseId, newCourse)
      }
    } catch (e: unknown) {
      setFormError("root", { message: e?.toString() })
    }
  }

  const createNewCourse = async (data: FormFields) => {
    try {
      const normalizedLanguageCode = normalizeIETFLanguageTag(data.language_code)
      await onSubmitNewCourseForm({
        ...data,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
      })
    } catch (e: unknown) {
      setFormError("root", { message: e?.toString() })
    }
  }

  const handleLanguageSelectionChange = (value: string) => {
    if (value === "other") {
      setShowCustomLanguageCode(true)
    } else {
      setShowCustomLanguageCode(false)
      setValue("language_code", value)
    }
  }

  const mutation = useToastMutation(
    async (data: FormFields) => {
      if (createDuplicate) {
        await handleCreateNewLanguageVersion(data)
      } else {
        await createNewCourse(data)
      }
      onClose()
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
        <FieldContainer>
          <TextField required label={t("text-field-label-name")} {...register("name")} />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-or-header-slug-or-short-name")}
            {...register("slug")}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("teacher-in-charge-name")}
            {...register("teacher_in_charge_name")}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("teacher-in-charge-email")}
            type="email"
            {...register("teacher_in_charge_email")}
          />
        </FieldContainer>
        <FieldContainer>
          <TextAreaField label={t("text-field-label-description")} {...register("description")} />
        </FieldContainer>

        {!courses && (
          <FieldContainer>
            <CheckBox
              label={t("grant-access-to-users-with-permissions-to-original-course")}
              {...register("copy_user_permissions")}
            ></CheckBox>
          </FieldContainer>
        )}

        {courses && (
          <FieldContainer>
            <CheckBox
              label={t("create-course-duplicate")}
              {...register("createDuplicate")}
            ></CheckBox>
          </FieldContainer>
        )}
        {courses && createDuplicate && (
          <div>
            <FieldContainer>
              <SelectField
                id="duplicate-course-select-menu"
                {...register("courseId")}
                onChange={(e) => handleDuplicateMenu(e.target.value)}
                options={courses.map((course) => {
                  return { label: course.name, value: course.id }
                })}
              />
            </FieldContainer>
            <FieldContainer>
              <CheckBox
                label={t("grant-access-to-users-with-permissions-to-original-course")}
                {...register("copy_user_permissions")}
              ></CheckBox>
            </FieldContainer>
          </div>
        )}
        <div>{t("course-language")}</div>
        <FieldContainer aria-labelledby={t("course-version-selection")}>
          <RadioButton
            key={AMERICAN_ENGLISH_LANGUAGE_CODE}
            label={t("english")}
            value={AMERICAN_ENGLISH_LANGUAGE_CODE}
            {...register("language_code")}
            onChange={(_event) => handleLanguageSelectionChange(AMERICAN_ENGLISH_LANGUAGE_CODE)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            key={FINNISH_LANGUAGE_CODE}
            label={t("finnish")}
            value={FINNISH_LANGUAGE_CODE}
            {...register("language_code")}
            onChange={(_event) => handleLanguageSelectionChange(FINNISH_LANGUAGE_CODE)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            key={SWEDISH_LANGUAGE_CODE}
            label={t("swedish")}
            value={SWEDISH_LANGUAGE_CODE}
            {...register("language_code")}
            onChange={(_event) => handleLanguageSelectionChange(SWEDISH_LANGUAGE_CODE)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            key="other"
            label={t("other-language")}
            value="other"
            {...register("language_code")}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={(_event) => handleLanguageSelectionChange("other")}
          />
        </FieldContainer>

        {showCustomLanguageCode && (
          <>
            <div>{languageCodeValidationError}</div>
            <FieldContainer>
              <TextField
                required
                label={t("language-code")}
                {...register("language_code")}
                onChange={(event) => {
                  const value = event.target.value
                  setValue("language_code", value)
                  try {
                    normalizeIETFLanguageTag(value)
                    setLanguageCodeValidationError(null)
                  } catch (e: unknown) {
                    console.error(e)
                    setLanguageCodeValidationError(t("laguage-code-validation-error"))
                  }
                }}
              />
            </FieldContainer>
          </>
        )}
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
          disabled={submitDisabled || !!languageCodeValidationError}
          fullWidth
        >
          {t("button-text-create")}
        </Button>
      </div>
    </form>
  )
}

export default NewCourseForm
