"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import OneTimeCodeForm from "@/components/forms/OneTimeCodeForm"

interface VerificationFormProps {
  onSubmit: (code: string) => Promise<void>
  error: string | null
  isSubmitting: boolean
}

// VerificationForm renders the email verification code form step.
export const VerificationForm: React.FC<VerificationFormProps> = ({
  onSubmit,
  error,
  isSubmitting,
}) => {
  const { t } = useTranslation()

  return (
    <OneTimeCodeForm
      title={t("email-verification-title")}
      message={t("email-verification-message")}
      onSubmit={onSubmit}
      submitLabel={t("verify-button")}
      error={error}
      isSubmitting={isSubmitting}
    />
  )
}
