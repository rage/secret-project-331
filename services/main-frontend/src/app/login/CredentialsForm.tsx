"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { signUpRoute } from "@/shared-module/common/utils/routes"

interface CredentialsFormProps {
  onSubmit: (email: string, password: string) => Promise<void>
  error: boolean
  isSubmitting: boolean
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
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        await onSubmit(email, password)
      }}
      className={css`
        display: flex;
        flex-direction: column;
        padding: 3rem 0rem;
      `}
    >
      <h1>{t("login")}</h1>
      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {t("login-description")}{" "}
        <a
          className={css`
            color: ${baseTheme.colors.blue[500]}!important;
          `}
          href="https://mooc.fi"
        >
          {t("login.linkMooc")}
        </a>{" "}
        {t("login-description2")}
      </div>
      <TextField
        label={t("label-email")}
        onChange={(event) => {
          setEmail(event.target.value)
        }}
        required
      />
      <TextField
        type="password"
        label={t("label-password")}
        onChange={(event) => {
          setPassword(event.target.value)
        }}
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
          {t("incorrect-email-or-password")}
        </div>
      )}
      <Button
        className={css`
          margin: 2rem 0rem;
        `}
        variant={"primary"}
        size={"medium"}
        id={"login-button"}
        disabled={!email || !password || email === "" || password === "" || isSubmitting}
      >
        {isSubmitting ? <Spinner variant={"small"} /> : t("login")}
      </Button>
      <div
        className={css`
          margin-bottom: 1.5rem;
          display: none;
        `}
      >
        <Link
          className={css`
            color: ${baseTheme.colors.blue[500]}!important;
          `}
          href="/sign-up"
        >
          {t("create-new-account")}
        </Link>
      </div>
      <div
        className={css`
          margin-bottom: 1.5rem;
        `}
      >
        <Link
          className={css`
            color: ${baseTheme.colors.blue[500]}!important;
          `}
          href="/reset-password"
        >
          {t("forgot-password")}
        </Link>
      </div>
      <div
        className={css`
          margin-bottom: 1.5rem;
        `}
      >
        <a
          className={css`
            color: ${baseTheme.colors.blue[500]}!important;
          `}
          href={signUpRoute(returnToForLinkToSignupPage)}
        >
          {t("create-an-account")}
        </a>
      </div>
    </form>
  )
}
