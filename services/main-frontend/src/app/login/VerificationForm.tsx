"use client"

import { css } from "@emotion/css"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

type VerificationFormFields = {
  verification_code: string
}

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
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<VerificationFormFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      verification_code: "",
    },
  })

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        await onSubmit(data.verification_code)
      })}
      className={css`
        display: flex;
        flex-direction: column;
        padding: 3rem 0rem;
      `}
    >
      <h1>{t("email-verification-title")}</h1>
      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {t("email-verification-message")}
      </div>
      <TextField
        label={t("verification-code-label")}
        placeholder={t("verification-code-placeholder")}
        {...register("verification_code", {
          required: t("required-field"),
        })}
        error={errors.verification_code?.message}
        required
      />
      {error && (
        <div
          aria-live="assertive"
          className={css`
            padding: 1rem;
            border: 2px solid ${baseTheme.colors.red[500]};
            font-weight: bold;
            color: ${baseTheme.colors.red[500]};
            margin-top: 1rem;
          `}
        >
          {error}
        </div>
      )}
      <Button
        className={css`
          margin: 2rem 0rem;
        `}
        variant={"primary"}
        size={"medium"}
        id={"verify-button"}
        disabled={isSubmitting}
      >
        {isSubmitting ? <Spinner variant={"small"} /> : t("verify-button")}
      </Button>
    </form>
  )
}
