"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import OneTimeCodeForm from "@/components/forms/OneTimeCodeForm"

interface VerificationFormProps {
  onSubmit: (code: string) => Promise<void>
  error: string | null
  isSubmitting: boolean
}

// VerificationForm renders the email verification code form. The surrounding Dialog supplies the
// heading, so no title is passed here.
export const VerificationForm: React.FC<VerificationFormProps> = ({
  onSubmit,
  error,
  isSubmitting,
}) => {
  const { t } = useTranslation()

  return (
    <OneTimeCodeForm
      message={t("email-verification-message")}
      onSubmit={onSubmit}
      submitLabel={t("verify-button")}
      error={error}
      isSubmitting={isSubmitting}
      containerClassName={css`
        padding: 0;
      `}
    />
  )
}
