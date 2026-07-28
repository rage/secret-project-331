"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import PasswordField from "@/components/forms/PasswordField"
import { baseTheme } from "@/shared-module/common/styles"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { signUpRoute } from "@/shared-module/common/utils/routes"
import { Button, TextField } from "@/shared-module/components"

interface CredentialsFormProps {
  onSubmit: (email: string, password: string) => Promise<void>
  error: boolean
  isSubmitting: boolean
}

interface CredentialsFields {
  email: string
  password: string
}

// CredentialsForm renders the login credentials form for email and password.
export const CredentialsForm: React.FC<CredentialsFormProps> = ({
  onSubmit,
  error,
  isSubmitting,
}) => {
  const { t } = useTranslation()
  const pathname = usePathname()
  const returnToForLinkToSignupPage = useCurrentPagePathForReturnTo(pathname)
  const { control, handleSubmit, watch, setFocus } = useForm<CredentialsFields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    // oxlint-disable-next-line i18next/no-literal-string
    setFocus("email")
  }, [setFocus])

  const email = watch("email")
  const password = watch("password")

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data.email, data.password))}
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 3rem 0rem;
      `}
    >
      <h1>{t("login")}</h1>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {t("login-description")}{" "}
        <a
          className={css`
            color: ${baseTheme.colors.blue[600]};
          `}
          href="https://mooc.fi"
        >
          {t("login.linkMooc")}
        </a>{" "}
        {t("login-description2")}
      </div>
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
            color: ${baseTheme.colors.red[500]};
          }
        `}
      >
        {error ? t("incorrect-email-or-password") : null}
      </div>
      <Button
        className={css`
          margin: 1rem 0rem;
        `}
        variant="primary"
        size="medium"
        type="submit"
        // oxlint-disable-next-line i18next/no-literal-string
        domProps={{ id: "login-button" }}
        isLoading={isSubmitting}
        disabled={!email || !password}
      >
        {t("login")}
      </Button>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.25rem;

          a {
            color: ${baseTheme.colors.blue[600]};
          }
        `}
      >
        <Link href="/reset-password">{t("forgot-password")}</Link>
        <a href={signUpRoute(returnToForLinkToSignupPage)}>{t("create-an-account")}</a>
      </div>
    </form>
  )
}
