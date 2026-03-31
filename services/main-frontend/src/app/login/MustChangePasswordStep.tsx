"use client"

import { css } from "@emotion/css"
import { CheckCircle, Padlock, PaperAirplane } from "@vectopus/atlas-icons-react"
import i18n from "i18next"
import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { sendResetPasswordLink } from "@/services/backend/users"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"

interface MustChangePasswordStepProps {
  email: string
  onBack: () => void
}

/** MustChangePasswordStep guides users without a stored password to request a reset email. */
export const MustChangePasswordStep: React.FC<MustChangePasswordStepProps> = ({
  email,
  onBack,
}) => {
  const { t } = useTranslation()
  const uncheckedReturnTo = useQueryParameter("return_to")
  const [emailSent, setEmailSent] = useState(false)

  const sendMutation = useToastMutation(
    () => sendResetPasswordLink(email, i18n.language),
    { method: "POST", notify: true },
    {
      onSuccess: () => setEmailSent(true),
    },
  )

  const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
  // eslint-disable-next-line i18next/no-literal-string -- route path and query key
  const resetPasswordHref = `/reset-password?return_to=${encodeURIComponent(returnTo)}`

  if (emailSent) {
    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;
          padding: 3rem 0;
          max-width: 32rem;
          gap: 1.25rem;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: ${baseTheme.colors.green[600]};
          `}
          aria-live="polite"
        >
          <CheckCircle aria-hidden size={28} />
          <h1
            className={css`
              margin: 0;
              font-size: 1.5rem;
            `}
          >
            {t("password-reset-email-sent")}
          </h1>
        </div>
        <p
          className={css`
            margin: 0;
            color: ${baseTheme.colors.gray[700]};
            line-height: 1.5;
          `}
        >
          {t("password-reset-email-sent-description", { email })}
        </p>
        <Button variant="primary" size="medium" type="button" onClick={onBack}>
          {t("must-change-password-back-to-login")}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        padding: 3rem 0;
        max-width: 32rem;
        gap: 1.25rem;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: ${baseTheme.colors.blue[600]};
        `}
      >
        <Padlock aria-hidden size={28} />
        <h1
          className={css`
            margin: 0;
            font-size: 1.5rem;
          `}
        >
          {t("must-change-password-title")}
        </h1>
      </div>
      <p
        className={css`
          margin: 0;
          color: ${baseTheme.colors.gray[700]};
          line-height: 1.5;
        `}
      >
        {t("must-change-password-description")}
      </p>
      <div
        className={css`
          padding: 0.75rem 1rem;
          border-radius: 6px;
          background: ${baseTheme.colors.gray[100]};
          color: ${baseTheme.colors.gray[600]};
          font-size: 0.95rem;
        `}
      >
        {email}
      </div>
      {sendMutation.isError && <ErrorBanner error={sendMutation.error} variant="readOnly" />}
      {sendMutation.isPending && <Spinner variant="medium" />}
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}
      >
        <Button
          variant="primary"
          size="medium"
          type="button"
          disabled={sendMutation.isPending}
          onClick={() => sendMutation.mutate()}
        >
          <span
            className={css`
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <PaperAirplane aria-hidden size={18} />
            {t("must-change-password-send-reset-email")}
          </span>
        </Button>
        <button
          type="button"
          className={css`
            background: none;
            border: none;
            padding: 0;
            cursor: pointer;
            text-align: left;
            color: ${baseTheme.colors.blue[500]};
            font-size: 0.95rem;
            text-decoration: underline;
          `}
          onClick={onBack}
        >
          {t("must-change-password-back-to-login")}
        </button>
        <Link
          href={resetPasswordHref}
          className={css`
            color: ${baseTheme.colors.blue[500]};
            font-size: 0.95rem;
          `}
        >
          {t("must-change-password-open-reset-page")}
        </Link>
      </div>
    </div>
  )
}
