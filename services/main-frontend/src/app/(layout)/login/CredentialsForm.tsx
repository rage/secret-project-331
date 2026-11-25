"use client"

import { css } from "@emotion/css"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { authCardStackCss } from "@/components/auth/AuthCard"
import { PasswordField } from "@/components/forms/PasswordField"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, TextField, Link } from "@/shared-module/components"

interface CredentialsFormProps {
  onSubmit: (email: string, password: string) => Promise<void>
  error: boolean
  isSubmitting: boolean
  resetPasswordHref: string
}

interface CredentialsFields {
  email: string
  password: string
}

// CredentialsForm renders the login credentials form for email and password; the page supplies the
// heading and the sign-up link around it.
export const CredentialsForm: React.FC<CredentialsFormProps> = ({
  onSubmit,
  error,
  isSubmitting,
  resetPasswordHref,
}) => {
  const { t } = useTranslation()
  const { control, handleSubmit, setFocus } = useForm<CredentialsFields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    // oxlint-disable-next-line i18next/no-literal-string
    setFocus("email")
  }, [setFocus])

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data.email, data.password))}
      className={authCardStackCss}
    >
      <TextField
        name="email"
        control={control}
        label={t("label-email")}
        type="email"
        autoComplete="username"
        isRequired
        rules={{ required: t("required-field") }}
      />
      <PasswordField
        name="password"
        control={control}
        label={t("label-password")}
        autoComplete="current-password"
        isRequired
        rules={{ required: t("required-field") }}
      />
      {/* Live region stays in the DOM so assistive tech registers it before the error text is
          inserted; otherwise the announcement can be missed. */}
      <div
        aria-live="assertive"
        className={css`
          &:not(:empty) {
            padding: 1rem;
            border: 2px solid ${baseTheme.colors.red[500]};
            font-weight: bold;
            color: ${baseTheme.colors.red[700]};
          }
        `}
      >
        {error ? t("incorrect-email-or-password") : null}
      </div>
      <Link
        href={resetPasswordHref}
        className={css`
          align-self: flex-start;
          font-size: var(--font-size-1);
        `}
      >
        {t("forgot-password")}
      </Link>
      <Button
        variant="primary"
        size="large"
        type="submit"
        isFullWidth
        // oxlint-disable-next-line i18next/no-literal-string
        domProps={{ id: "login-button" }}
        isLoading={isSubmitting}
      >
        {t("login")}
      </Button>
    </form>
  )
}
