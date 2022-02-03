import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { FormControlLabel, Radio, RadioGroup, TextField } from "@material-ui/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { NewCourse } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import { normalizeIETFLanguageTag } from "../../shared-module/utils/strings"
import { normalizePath } from "../../utils/normalizePath"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  organizationId: string
  onSubmitForm: (newCourse: NewCourse) => Promise<void>
  onClose: () => void
}

const AMERICAN_ENGLISH_LANGUAGE_CODE = "en-US"
const FINNISH_LANGUAGE_CODE = "fi-FI"
const SWEDISH_LANGUAGE_CODE = "sv-SE"
const DEFAULT_LANGUAGE_CODE = AMERICAN_ENGLISH_LANGUAGE_CODE

const NewCourseForm: React.FC<NewCourseFormProps> = ({ organizationId, onSubmitForm, onClose }) => {
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
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <Button size="medium" variant="primary" onClick={createNewCourse} disabled={submitDisabled}>
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
