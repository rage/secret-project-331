"use client"

import React, { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { useAccountFormReport } from "@/components/forms/accountFormReport/useAccountFormReport"
import {
  postAuthConfirmSignup,
  postAuthResendSignupCode,
} from "@/shared-module/common/generated/auth-api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import "@/shared-module/common/init/registerAuthApiClients"
import {
  EMAIL_OWNERSHIP_RESEND_COOLDOWN_SECONDS,
  OneTimeCodeForm,
} from "@/shared-module/components"

interface SignupConfirmationFormProps {
  /** The address the code went to. */
  email: string
  /** Called once the code created the account and signed the session in. */
  onConfirmed: () => void | Promise<void>
  /** Called when the address got an account while the code was on its way. */
  onAccountExists: () => void
}

/** The code step that finishes a signup: the account is created when the mailed code is typed. */
const SignupConfirmationForm: React.FC<SignupConfirmationFormProps> = ({
  email,
  onConfirmed,
  onAccountExists,
}) => {
  const { t } = useTranslation()
  const accountFormReport = useAccountFormReport()
  const [codeRefused, setCodeRefused] = useState(false)
  const [sentAt, setSentAt] = useState(() => new Date().toISOString())

  const confirm = useToastMutation(
    async (code: string) => await postAuthConfirmSignup({ body: { code } }),
    { notify: false },
    {
      onSuccess: async (result) => {
        setCodeRefused(result === "invalid")
        if (result === "confirmed") {
          await onConfirmed()
        } else if (result === "account_exists") {
          onAccountExists()
        }
      },
    },
  )

  const resend = useToastMutation(
    async () =>
      await postAuthResendSignupCode({ body: { client_info: accountFormReport.report() } }),
    { notify: false },
    {
      onSuccess: () => {
        setCodeRefused(false)
        setSentAt(new Date().toISOString())
      },
    },
  )

  return (
    <OneTimeCodeForm
      title={t("heading-check-your-email")}
      message={
        <Trans
          t={t}
          i18nKey="message-signup-code-sent-to"
          values={{ email }}
          components={{ email: <strong /> }}
        />
      }
      description={t("message-signup-code-delivery-help")}
      onSubmit={async (code) => {
        await confirm.mutateAsync(code)
      }}
      submitLabel={t("button-text-verify")}
      error={codeRefused ? t("message-code-did-not-work") : null}
      isSubmitting={confirm.isPending}
      submitOnComplete
      resend={{
        helperText: t("message-did-not-receive-the-verification-code"),
        label: t("resend"),
        onResend: () => resend.mutate(),
        cooldownSeconds: EMAIL_OWNERSHIP_RESEND_COOLDOWN_SECONDS,
        lastSentAt: sentAt,
      }}
    />
  )
}

export default SignupConfirmationForm
