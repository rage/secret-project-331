import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { normalizePath } from "../../utils/normalizePath"

import { Course, NewCourse } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextArea from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormFields {
  name: string
  slug: string
  teacherInChargeName: string
  teacherInChargeEmail: string
  description: string
  copyCourseUserPermissions: boolean
  createDuplicate: boolean
  courseId?: string
  languageCode: string
  customLanguageCode?: string
}

interface NewCourseFormProps {
  organizationId: string
  onSubmitNewCourseForm: (newCourse: NewCourse) => Promise<void>
  onSubmitDuplicateCourseForm?: (oldCourseId: string, newCourse: NewCourse) => Promise<void>
  courses?: Course[]
  onClose: () => void
}

const AMERICAN_ENGLISH_LANGUAGE_CODE = "en-US"
const FINNISH_LANGUAGE_CODE = "fi-FI"
const SWEDISH_LANGUAGE_CODE = "sv-SE"
const DEFAULT_LANGUAGE_CODE = AMERICAN_ENGLISH_LANGUAGE_CODE

const NewCourseForm: React.FC<NewCourseFormProps> = ({
  organizationId,
  onSubmitNewCourseForm,
  onSubmitDuplicateCourseForm,
  courses,
  onClose,
}) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    watch,
    setValue,
    reset,
  } = useForm<NewCourseFormFields>({
    defaultValues: {
      name: "",
      slug: "",
      teacherInChargeName: "",
      teacherInChargeEmail: "",
      description: "",
      copyCourseUserPermissions: false,
      createDuplicate: false,
      courseId: courses?.[0]?.id || "",
      languageCode: DEFAULT_LANGUAGE_CODE,
      customLanguageCode: "",
    },
  })

  const watchCreateDuplicate = watch("createDuplicate")
  const watchLanguageCode = watch("languageCode")

  const mutation = useToastMutation(
    async (data: NewCourseFormFields) => {
      const normalizedLanguageCode =
        data.languageCode === "other"
          ? normalizeIETFLanguageTag(data.customLanguageCode!)
          : normalizeIETFLanguageTag(data.languageCode)

      const newCourse: NewCourse = {
        name: data.name,
        slug: data.slug,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
        teacher_in_charge_name: data.teacherInChargeName,
        teacher_in_charge_email: data.teacherInChargeEmail,
        description: data.description,
        is_draft: true,
        is_test_mode: false,
        is_unlisted: false,
        copy_user_permissions: data.copyCourseUserPermissions,
      }

      if (data.createDuplicate && onSubmitDuplicateCourseForm && data.courseId) {
        await onSubmitDuplicateCourseForm(data.courseId, newCourse)
      } else {
        await onSubmitNewCourseForm(newCourse)
      }

      reset()
    },
    { notify: true, method: "POST" },
  )

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data)
  })

  const errorMessages = Object.values(errors).map((error) => error.message)

  return (
    <form
      onSubmit={onSubmit}
      className={css`
        padding: 1rem 0;
      `}
    >
      <div>
        {Boolean(mutation.error) && <ErrorBanner error={mutation.error} />}

        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-name")}
            {...register("name", {
              required: t("required-field"),
              onChange: (e) => {
                const value = e.target.value
                setValue("slug", normalizePath(value))
              },
            })}
            error={errors.name?.message}
          />
        </FieldContainer>

        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-or-header-slug-or-short-name")}
            {...register("slug", { required: t("required-field") })}
            error={errors.slug?.message}
          />
        </FieldContainer>

        <FieldContainer>
          <TextField
            required
            label={t("teacher-in-charge-name")}
            {...register("teacherInChargeName", { required: t("required-field") })}
            error={errors.teacherInChargeName?.message}
          />
        </FieldContainer>

        <FieldContainer>
          <TextField
            required
            label={t("teacher-in-charge-email")}
            type="email"
            {...register("teacherInChargeEmail", {
              required: t("required-field"),
              pattern: {
                value: /@/,
                message: t("invalid-email"),
              },
            })}
            error={errors.teacherInChargeEmail?.message}
          />
        </FieldContainer>

        <FieldContainer>
          <TextArea
            label={t("text-field-label-description")}
            {...register("description")}
            error={errors.description?.message}
          />
        </FieldContainer>

        {!courses && (
          <FieldContainer>
            <CheckBox
              label={t("grant-access-to-users-with-permissions-to-original-course")}
              {...register("copyCourseUserPermissions")}
            />
          </FieldContainer>
        )}

        {courses && (
          <FieldContainer>
            <CheckBox
              label={t("create-course-duplicate")}
              {...register("createDuplicate")}
              onChange={(e) => {
                setValue("createDuplicate", e.target.checked)
                if (e.target.checked && courses.length > 0) {
                  setValue("courseId", courses[0].id)
                } else {
                  setValue("courseId", "")
                }
              }}
            />
          </FieldContainer>
        )}

        {courses && watchCreateDuplicate && (
          <>
            <FieldContainer>
              <SelectField
                id="duplicate-course-select-menu"
                {...register("courseId", { required: t("required-field") })}
                defaultValue={courses[0]?.id}
                onChangeByValue={(value) => {
                  setValue("courseId", value)
                  const selectedCourse = courses.find((course) => course.id === value)
                  if (selectedCourse) {
                    setValue("name", selectedCourse.name)
                    setValue("slug", normalizePath(selectedCourse.name))
                  }
                }}
                options={courses.map((course) => ({
                  label: course.name,
                  value: course.id,
                }))}
                error={errors.courseId?.message}
              />
            </FieldContainer>

            <FieldContainer>
              <CheckBox
                label={t("grant-access-to-users-with-permissions-to-original-course")}
                {...register("copyCourseUserPermissions")}
              />
            </FieldContainer>
          </>
        )}

        <div>{t("course-language")}</div>
        <FieldContainer>
          <RadioButton
            label={t("english")}
            value={AMERICAN_ENGLISH_LANGUAGE_CODE}
            {...register("languageCode", { required: t("required-field") })}
          />
        </FieldContainer>

        <FieldContainer>
          <RadioButton
            label={t("finnish")}
            value={FINNISH_LANGUAGE_CODE}
            {...register("languageCode", { required: t("required-field") })}
          />
        </FieldContainer>

        <FieldContainer>
          <RadioButton
            label={t("swedish")}
            value={SWEDISH_LANGUAGE_CODE}
            {...register("languageCode", { required: t("required-field") })}
          />
        </FieldContainer>

        <FieldContainer>
          <RadioButton
            label={t("other-language")}
            // eslint-disable-next-line i18next/no-literal-string
            value="other"
            {...register("languageCode", { required: t("required-field") })}
          />
        </FieldContainer>

        {watchLanguageCode === "other" && (
          <FieldContainer>
            <TextField
              required
              label={t("language-code")}
              {...register("customLanguageCode", {
                required: t("required-field"),
                validate: (value) => {
                  if (value === undefined) {
                    return t("required-field")
                  }
                  try {
                    normalizeIETFLanguageTag(value)
                    return true
                  } catch (e: unknown) {
                    if (e instanceof Error) {
                      return e.message
                    }
                    return false
                  }
                },
              })}
              error={errors.customLanguageCode?.message}
            />
          </FieldContainer>
        )}
      </div>

      <div>
        <Button type="submit" size="medium" variant="primary" disabled={isSubmitting || !isValid}>
          {t("button-text-create")}
        </Button>
        <Button size="medium" variant="secondary" onClick={onClose}>
          {t("button-text-close")}
        </Button>
      </div>

      {errorMessages.length > 0 && (
        <div className="error-messages">
          <ul>
            {errorMessages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}

export default NewCourseForm
