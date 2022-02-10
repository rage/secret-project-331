import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { FormControlLabel, Radio, RadioGroup, TextField } from "@mui/material"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useQueryClient } from "react-query"

import { newCourseInstance, postNewCourseTranslation } from "../../../../services/backend/courses"
import { fetchOrganizationCourses } from "../../../../services/backend/organizations"
import { Course, NewCourse } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import CheckBox from "../../../../shared-module/components/InputFields/CheckBox"
import SelectMenu from "../../../../shared-module/components/InputFields/SelectField"
import { normalizeIETFLanguageTag } from "../../../../shared-module/utils/strings"
import { normalizePath } from "../../../../utils/normalizePath"
import { formatLanguageVersionsQueryKey } from "../../manage/courses/id/index/CourseLanguageVersionsList"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  organizationId: string
  onSubmitForm: (newCourse: NewCourse) => Promise<void>
}

const AMERICAN_ENGLISH_LANGUAGE_CODE = "en-US"
const FINNISH_LANGUAGE_CODE = "fi-FI"
const SWEDISH_LANGUAGE_CODE = "sv-SE"
const DEFAULT_LANGUAGE_CODE = AMERICAN_ENGLISH_LANGUAGE_CODE

const NewCourseForm: React.FC<NewCourseFormProps> = ({ organizationId, onSubmitForm }) => {
  const { t } = useTranslation()
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
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  let initialPage: number
  if (typeof router.query.page === "string") {
    initialPage = parseInt(router.query.page)
  } else {
    initialPage = 1
  }
  const [page, setPage] = useState(initialPage)

  const getOrgCourses = useQuery(
    [`organization-courses`, page, 100],
    () => {
      if (organizationId) {
        return fetchOrganizationCourses(organizationId, page, 100)
      } else {
        // This should never happen, used for typescript because enabled boolean doesn't do type checking
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    { enabled: !!organizationId },
  )

  const courses = getOrgCourses.data

  const handleTemplateChanging = (e: string, coursesData: Course[]) => {
    const findCourse = coursesData.find((course) => course.id === e)
    const courseName = findCourse?.name ? findCourse?.name : ""
    const courseSlug = findCourse?.slug ? findCourse?.slug : ""
    const courseLanguage = findCourse?.language_code ? findCourse?.language_code : ""
    setName(courseName)
    setSlug(courseSlug)
    setTeacherInChargeName("")
    setTeacherInChargeEmail("")
    setLanguageCode(courseLanguage)
  }

  const handleCreateNewLanguageVersion = async () => {
    const newCourse: NewCourse = {
      name: name,
      slug: slug,
      organization_id: organizationId,
      language_code: languageCode,
      teacher_in_charge_email: teacherInChargeEmail,
      teacher_in_charge_name: teacherInChargeName,
    }
    const oldCourseId = courses?.find((course) => course.slug === slug)?.id
    if (oldCourseId) {
      await postNewCourseTranslation(oldCourseId, newCourse)
    }
  }

  const createNewCourse = async () => {
    try {
      setSubmitDisabled(true)
      const normalizedLanguageCode = normalizeIETFLanguageTag(languageCode)
      await onSubmitForm({
        name,
        slug,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
        teacher_in_charge_name: teacherInChargeName,
        teacher_in_charge_email: teacherInChargeEmail,
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
            fullWidth
            id="outlined-required"
            label={t("text-field-label-name")}
            variant="outlined"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSlug(normalizePath(e.target.value))
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="outlined-required"
            label={t("text-field-label-or-header-slug-or-short-name")}
            variant="outlined"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="teacher-in-charge-name"
            label={t("teacher-in-charge-name")}
            variant="outlined"
            value={teacherInChargeName}
            onChange={(e) => {
              setTeacherInChargeName(e.target.value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="teacher-in-charge-email"
            label={t("teacher-in-charge-email")}
            variant="outlined"
            value={teacherInChargeEmail}
            onChange={(e) => {
              setTeacherInChargeEmail(e.target.value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <CheckBox
            label={t("create-course-duplicate")}
            onChange={() => setCreateDuplicate(!createDuplicate)}
            checked={createDuplicate}
          ></CheckBox>
        </FieldContainer>
        {courses && createDuplicate && (
          <FieldContainer>
            <SelectMenu
              id="duplicate-course-select-menu"
              onBlur={() => {
                // no-op
              }}
              onChange={(e) => handleTemplateChanging(e, courses)}
              options={courses.map((course) => {
                return { label: course.name, value: course.id }
              })}
            ></SelectMenu>
          </FieldContainer>
        )}
        <div>{t("course-language")}</div>
        <FieldContainer aria-labelledby={t("course-version-selection")}>
          <RadioGroup
            value={showCustomLanguageCode ? t("other-language") : languageCode}
            onChange={(e) => handleLanguageSelectionChange(e.target.value)}
          >
            <FormControlLabel
              control={<Radio />}
              key={AMERICAN_ENGLISH_LANGUAGE_CODE}
              label={t("english")}
              value={AMERICAN_ENGLISH_LANGUAGE_CODE}
            />
            <FormControlLabel
              control={<Radio />}
              key={FINNISH_LANGUAGE_CODE}
              label={t("finnish")}
              value={FINNISH_LANGUAGE_CODE}
            />
            <FormControlLabel
              control={<Radio />}
              key={SWEDISH_LANGUAGE_CODE}
              label={t("swedish")}
              value={SWEDISH_LANGUAGE_CODE}
            />
            <FormControlLabel
              control={<Radio />}
              key="other"
              label={t("other-language")}
              // eslint-disable-next-line i18next/no-literal-string
              value="other"
            />
          </RadioGroup>
        </FieldContainer>
        {showCustomLanguageCode && (
          <>
            <div>{languageCodeValidationError}</div>
            <FieldContainer>
              <TextField
                required
                fullWidth
                id="outlined-required"
                label={t("language-code")}
                variant="outlined"
                value={languageCode}
                onChange={(e) => {
                  setLanguageCode(e.target.value)
                  try {
                    normalizeIETFLanguageTag(e.target.value)
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
      </div>
    </div>
  )
}

export default NewCourseForm
