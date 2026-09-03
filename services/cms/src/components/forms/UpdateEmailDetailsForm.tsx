"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useMemo } from "react"
import type { Control } from "react-hook-form"

import type { EmailTemplateType } from "@/generated/api"
import { Select, TextField } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { PlaceholderValidationResult } from "../../utils/emailPlaceholders"
import { getPlaceholderConfig } from "../../utils/emailPlaceholders"
import PlaceholderInfo from "../email/PlaceholderInfo"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

export interface EmailDetailsFormFields {
  templateType: EmailTemplateType
  subject: string
}

export const TEMPLATE_TYPE_FIELD_NAME = "templateType"
export const SUBJECT_FIELD_NAME = "subject"

interface UpdateEmailDetailsFormProps {
  control: Control<EmailDetailsFormFields>
  templateType: EmailTemplateType
  placeholderValidation: PlaceholderValidationResult
}

const UpdateEmailDetailsForm: React.FC<React.PropsWithChildren<UpdateEmailDetailsFormProps>> = ({
  control,
  templateType,
  placeholderValidation,
}) => {
  const { t } = useTranslation()
  const placeholderConfig = getPlaceholderConfig(templateType)

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
          <Select
            name={TEMPLATE_TYPE_FIELD_NAME}
            control={control}
            isRequired
            label={t("label-template-type")}
            options={[
              {
                // oxlint-disable-next-line i18next/no-literal-string
                value: "reset_password_email",
                label: t("email-template-type-reset-password-email"),
              },
              {
                // oxlint-disable-next-line i18next/no-literal-string
                value: "delete_user_email",
                label: t("email-template-type-delete-user-email"),
              },
              {
                // oxlint-disable-next-line i18next/no-literal-string
                value: "generic",
                label: t("email-template-type-generic"),
              },
              {
                // oxlint-disable-next-line i18next/no-literal-string
                value: "confirm_email_code",
                label: t("email-template-type-confirm-email-code"),
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
            name={SUBJECT_FIELD_NAME}
            control={control}
            isRequired
            label={t("label-email-subject")}
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
