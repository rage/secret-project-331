import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { Course, NewCourse } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import RadioButton from "../../shared-module/components/InputFields/RadioButton"
import SelectMenu from "../../shared-module/components/InputFields/SelectField"
import TextArea from "../../shared-module/components/InputFields/TextAreaField"
import TextField from "../../shared-module/components/InputFields/TextField"
import { normalizeIETFLanguageTag } from "../../shared-module/utils/strings"
import { normalizePath } from "../../utils/normalizePath"
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
  const [courseId, setCourseId] = useState("")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [teacherInChargeName, setTeacherInChargeName] = useState("")
  const [teacherInChargeEmail, setTeacherInChargeEmail] = useState("")
  const [languageCode, setLanguageCode] = useState(DEFAULT_LANGUAGE_CODE)
  const [showCustomLanguageCode, setShowCustomLanguageCode] = useState(false)
  const [languageCodeValidationError, setLanguageCodeValidationError] = useState<string | null>(
    null,
  )

  const [createDuplicate, setCreateDuplicate] = useState<boolean>(false)
  const [description, setDescription] = useState("")
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDuplicateMenu = (e: string, coursesData: Course[]) => {
    const findCourse = coursesData.find((course) => course.id === e)
    const courseName = findCourse?.name ? findCourse?.name : ""
    setCourseId(e)
    if (courseName !== "") {
      setName(courseName)
    }
  }

  const handleCreateNewLanguageVersion = async () => {
    if (!onSubmitDuplicateCourseForm) {
      return null
    }
    try {
      setSubmitDisabled(true)
      const normalizedLanguageCode = normalizeIETFLanguageTag(languageCode)
      const newCourse: NewCourse = {
        name: name,
        description: description,
        slug: slug,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
        teacher_in_charge_email: teacherInChargeEmail,
        teacher_in_charge_name: teacherInChargeName,
      }
      if (courseId) {
        await onSubmitDuplicateCourseForm(courseId, newCourse)
        setLanguageCode(DEFAULT_LANGUAGE_CODE)
        setSlug("")
        setTeacherInChargeName("")
        setTeacherInChargeEmail("")
        setError(null)
      }
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e
      }
      setError(e.toString())
    } finally {
      setSubmitDisabled(false)
    }
  }

  const createNewCourse = async () => {
    try {
      setSubmitDisabled(true)
      const normalizedLanguageCode = normalizeIETFLanguageTag(languageCode)
      await onSubmitNewCourseForm({
        name,
        slug,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
        teacher_in_charge_name: teacherInChargeName,
        teacher_in_charge_email: teacherInChargeEmail,
        description,
      })
      setName("")
      setSlug("")
      setLanguageCode(DEFAULT_LANGUAGE_CODE)
      setError(null)
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e
      }
      setError(e.toString())
    } finally {
      setSubmitDisabled(false)
    }
  }

  const handleLanguageSelectionChange = (value: string) => {
    if (value === "other") {
      setShowCustomLanguageCode(true)
    } else {
      setShowCustomLanguageCode(false)
      setLanguageCode(value)
    }
  }

  return (
    <div
      className={css`
        width: 500px;
        padding: 1rem 0;
      `}
    >
      <div>
        {error && <pre>{error}</pre>}
        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-name")}
            value={name}
            onChange={(value) => {
              setName(value)
              setSlug(normalizePath(value))
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-or-header-slug-or-short-name")}
            value={slug}
            onChange={(value) => {
              setSlug(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("teacher-in-charge-name")}
            value={teacherInChargeName}
            onChange={(value) => {
              setTeacherInChargeName(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("teacher-in-charge-email")}
            value={teacherInChargeEmail}
            onChange={(value) => {
              setTeacherInChargeEmail(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextArea
            required
            label={t("text-field-label-description")}
            value={description}
            onChange={(value) => {
              setDescription(value)
            }}
          />
        </FieldContainer>
        {courses && (
          <FieldContainer>
            <CheckBox
              label={t("create-course-duplicate")}
              onChange={() => {
                setCreateDuplicate(!createDuplicate)
                handleDuplicateMenu(courses[0].id, courses)
              }}
              checked={createDuplicate}
            ></CheckBox>
          </FieldContainer>
        )}
        {courses && createDuplicate && (
          <FieldContainer>
            <SelectMenu
              id="duplicate-course-select-menu"
              onBlur={() => {
                // no-op
              }}
              defaultValue={courses[0].id}
              onChange={(e) => handleDuplicateMenu(e, courses)}
              options={courses.map((course) => {
                return { label: course.name, value: course.id }
              })}
            ></SelectMenu>
          </FieldContainer>
        )}
        <div>{t("course-language")}</div>
        <FieldContainer aria-labelledby={t("course-version-selection")}>
          <RadioButton
            key={AMERICAN_ENGLISH_LANGUAGE_CODE}
            label={t("english")}
            value={AMERICAN_ENGLISH_LANGUAGE_CODE}
            // eslint-disable-next-line i18next/no-literal-string
            name="language-code"
            onChange={(value) => handleLanguageSelectionChange(value)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            key={FINNISH_LANGUAGE_CODE}
            label={t("finnish")}
            value={FINNISH_LANGUAGE_CODE}
            // eslint-disable-next-line i18next/no-literal-string
            name="language-code"
            onChange={(value) => handleLanguageSelectionChange(value)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            key={SWEDISH_LANGUAGE_CODE}
            label={t("swedish")}
            value={SWEDISH_LANGUAGE_CODE}
            // eslint-disable-next-line i18next/no-literal-string
            name="language-code"
            onChange={(value) => handleLanguageSelectionChange(value)}
          />
        </FieldContainer>
        <FieldContainer>
          <RadioButton
            key="other"
            label={t("other-language")}
            // eslint-disable-next-line i18next/no-literal-string
            value="other"
            // eslint-disable-next-line i18next/no-literal-string
            name="language-code"
            onChange={(value) => handleLanguageSelectionChange(value)}
          />
        </FieldContainer>

        {showCustomLanguageCode && (
          <>
            <div>{languageCodeValidationError}</div>
            <FieldContainer>
              <TextField
                required
                label={t("language-code")}
                value={languageCode}
                onChange={(value) => {
                  setLanguageCode(value)
                  try {
                    normalizeIETFLanguageTag(value)
                    setLanguageCodeValidationError(null)
                  } catch (e) {
                    setLanguageCodeValidationError(t("laguage-code-validation-error"))
                  }
                }}
              />
            </FieldContainer>
          </>
        )}
      </div>
      <div>
        <Button
          size="medium"
          variant="primary"
          onClick={createDuplicate ? handleCreateNewLanguageVersion : createNewCourse}
          disabled={submitDisabled}
        >
          {t("button-text-create")}
        </Button>
        <Button size="medium" variant="secondary" onClick={onClose}>
          {t("button-text-close")}
        </Button>
      </div>
    </div>
  )
}

export default NewCourseForm
