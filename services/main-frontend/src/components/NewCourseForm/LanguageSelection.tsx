import React, { useId, useState } from "react"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  AMERICAN_ENGLISH_LANGUAGE_CODE,
  FieldContainer,
  FINNISH_LANGUAGE_CODE,
  FormFields,
  SWEDISH_LANGUAGE_CODE,
} from "."

import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { normalizeIETFLanguageTag } from "@/shared-module/common/utils/strings"

interface LanguageSelectionProps {
  form: UseFormReturn<FormFields>
}

const LanguageSelection: React.FC<LanguageSelectionProps> = ({ form }) => {
  const courseLanguageHeading = useId()
  const { t } = useTranslation()
  const { register, setValue } = form
  const [showCustomLanguageCode, setShowCustomLanguageCode] = useState(false)
  const [languageCodeValidationError, setLanguageCodeValidationError] = useState<string | null>(
    null,
  )

  const handleLanguageSelectionChange = (value: string) => {
    if (value === "other") {
      setShowCustomLanguageCode(true)
    } else {
      setShowCustomLanguageCode(false)
      setValue("language_code", value)
    }
  }

  return (
    <>
      <div id={courseLanguageHeading}>{t("course-language")}</div>
      <FieldContainer aria-labelledby={courseLanguageHeading}>
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
          {languageCodeValidationError && (
            <div role="alert" aria-live="assertive">
              {languageCodeValidationError}
            </div>
          )}
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
    </>
  )
}

export default LanguageSelection
