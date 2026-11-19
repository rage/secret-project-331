"use client"

import React, { useEffect, useId, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"
import { Radio, TextField } from "@/shared-module/components"

import type { FormFields } from "."
import {
  ENGLISH_LANGUAGE_CODE,
  FieldContainer,
  FINNISH_LANGUAGE_CODE,
  NORWEGIAN_LANGUAGE_CODE,
  SWEDISH_LANGUAGE_CODE,
} from "."

interface LanguageSelectionProps {
  form: UseFormReturn<FormFields>
}

// oxlint-disable-next-line i18next/no-literal-string
const LANGUAGE_CODE_FIELD = "language_code" as const

const LanguageSelection: React.FC<LanguageSelectionProps> = ({ form }) => {
  const courseLanguageHeading = useId()
  const { t } = useTranslation()
  const { control, setValue } = form
  const languageCode = useWatch({ control, name: LANGUAGE_CODE_FIELD })
  const [showCustomLanguageCode, setShowCustomLanguageCode] = useState(false)
  const [languageCodeValidationError, setLanguageCodeValidationError] = useState<string | null>(
    null,
  )

  const handleLanguageSelectionChange = (value: string) => {
    if (value === "other") {
      setShowCustomLanguageCode(true)
    } else {
      setShowCustomLanguageCode(false)
      setValue(LANGUAGE_CODE_FIELD, value)
    }
  }

  useEffect(() => {
    if (!showCustomLanguageCode) {
      setLanguageCodeValidationError(null)
      return
    }
    try {
      normalizeIETFLanguageTag(languageCode)
      setLanguageCodeValidationError(null)
    } catch (e: unknown) {
      console.error(e)
      setLanguageCodeValidationError(t("laguage-code-validation-error"))
    }
  }, [languageCode, showCustomLanguageCode, t])

  return (
    <>
      <div id={courseLanguageHeading}>{t("course-language")}</div>
      <FieldContainer aria-labelledby={courseLanguageHeading}>
        <Radio
          key={ENGLISH_LANGUAGE_CODE}
          label={t("english")}
          name={LANGUAGE_CODE_FIELD}
          value={ENGLISH_LANGUAGE_CODE}
          checked={!showCustomLanguageCode && languageCode === ENGLISH_LANGUAGE_CODE}
          onChange={() => handleLanguageSelectionChange(ENGLISH_LANGUAGE_CODE)}
        />
      </FieldContainer>
      <FieldContainer>
        <Radio
          key={FINNISH_LANGUAGE_CODE}
          label={t("finnish")}
          name={LANGUAGE_CODE_FIELD}
          value={FINNISH_LANGUAGE_CODE}
          checked={!showCustomLanguageCode && languageCode === FINNISH_LANGUAGE_CODE}
          onChange={() => handleLanguageSelectionChange(FINNISH_LANGUAGE_CODE)}
        />
      </FieldContainer>
      <FieldContainer>
        <Radio
          key={SWEDISH_LANGUAGE_CODE}
          label={t("swedish")}
          name={LANGUAGE_CODE_FIELD}
          value={SWEDISH_LANGUAGE_CODE}
          checked={!showCustomLanguageCode && languageCode === SWEDISH_LANGUAGE_CODE}
          onChange={() => handleLanguageSelectionChange(SWEDISH_LANGUAGE_CODE)}
        />
      </FieldContainer>
      <FieldContainer>
        <Radio
          key={NORWEGIAN_LANGUAGE_CODE}
          label={t("norwegian")}
          name={LANGUAGE_CODE_FIELD}
          value={NORWEGIAN_LANGUAGE_CODE}
          checked={!showCustomLanguageCode && languageCode === NORWEGIAN_LANGUAGE_CODE}
          onChange={() => handleLanguageSelectionChange(NORWEGIAN_LANGUAGE_CODE)}
        />
      </FieldContainer>
      <FieldContainer>
        <Radio
          key="other"
          label={t("other-language")}
          name={LANGUAGE_CODE_FIELD}
          // oxlint-disable-next-line i18next/no-literal-string
          value="other"
          checked={showCustomLanguageCode}
          // oxlint-disable-next-line i18next/no-literal-string
          onChange={() => handleLanguageSelectionChange("other")}
        />
      </FieldContainer>

      {showCustomLanguageCode && (
        <>
          {languageCodeValidationError && (
            <div role="alert" aria-live="assertive">
              {languageCodeValidationError}
            </div>
          )}
          <FieldContainer>
            <TextField
              name={LANGUAGE_CODE_FIELD}
              control={control}
              isRequired
              label={t("language-code")}
            />
          </FieldContainer>
        </>
      )}
    </>
  )
}

export default LanguageSelection
