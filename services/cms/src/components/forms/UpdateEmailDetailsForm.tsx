"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getPlaceholderConfig } from "../../utils/emailPlaceholders"
import PlaceholderInfo from "../email/PlaceholderInfo"

import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface PlaceholderValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  detectedPlaceholders: string[]
  missingRequired: string[]
  invalidPlaceholders: string[]
}

interface UpdateEmailDetailsFormProps {
  templateType: unknown
  subject: string
  setTemplateType: React.Dispatch<React.SetStateAction<unknown>>
  setSubject: (newSubject: string) => void
  placeholderValidation: PlaceholderValidation
}

const UpdateEmailDetailsForm: React.FC<React.PropsWithChildren<UpdateEmailDetailsFormProps>> = ({
  templateType,
  subject,
  setTemplateType,
  setSubject,
  placeholderValidation,
}) => {
  const { t } = useTranslation()
  const templateTypeString =
    typeof templateType === "string" ? templateType : (templateType as unknown as string)
  const placeholderConfig = getPlaceholderConfig(templateTypeString)

  const templateTypeHelperText = useMemo(() => {
    if (placeholderConfig) {
      const requiredPlaceholders = placeholderConfig.required.map((p) => `{{${p}}}`).join(", ")
      return t("template-type-helper-text", { placeholders: requiredPlaceholders })
    }
    return t("template-type-helper-text-generic")
  }, [placeholderConfig, t])

  return (
    <div
      className={css`
        padding: 1rem 0;
      `}
    >
      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        <PlaceholderInfo templateType={templateType} validation={placeholderValidation} />
      </div>

      <div>
        <FieldContainer>
          <SelectField
            required
            label={t("label-template-type")}
            value={templateTypeString}
            onChangeByValue={(value) => {
              setTemplateType(value)
            }}
            options={[
              {
                // eslint-disable-next-line i18next/no-literal-string
                value: "reset_password_email",
                label: t("email-template-type-reset-password-email"),
              },
              {
                // eslint-disable-next-line i18next/no-literal-string
                value: "delete_user_email",
                label: t("email-template-type-delete-user-email"),
              },
              {
                // eslint-disable-next-line i18next/no-literal-string
                value: "generic",
                label: t("email-template-type-generic"),
              },
            ]}
          />
          {templateTypeHelperText && (
            <div
              className={css`
                margin-top: 0.25rem;
                font-size: 0.875rem;
                color: #6c757d;
              `}
            >
              {templateTypeHelperText}
            </div>
          )}
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("label-email-subject")}
            value={subject}
            onChangeByValue={(value) => {
              setSubject(value)
            }}
          />
          <div
            className={css`
              margin-top: 0.25rem;
              font-size: 0.875rem;
              color: #6c757d;
            `}
          >
            {t("email-subject-helper-text")}
          </div>
        </FieldContainer>
      </div>
    </div>
  )
}

export default UpdateEmailDetailsForm
