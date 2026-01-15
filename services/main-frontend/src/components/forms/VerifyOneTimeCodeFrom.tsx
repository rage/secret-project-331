"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import OneTimePassCodeField from "@/shared-module/common/components/InputFields/OneTimePasscodeField"
import { baseTheme } from "@/shared-module/common/styles"

interface Props {
  onSubmit: (code: string) => void
  onResend: () => void
  credentialsError?: boolean
}

const VerifyOneTimeCodeForm: React.FC<Props> = ({ onSubmit, onResend, credentialsError }) => {
  const { t } = useTranslation()
  const { handleSubmit, setValue, watch } = useForm<{ code: string }>({
    defaultValues: { code: "" },
  })
  const code = watch("code")
  const [resendCooldown, startCooldown] = useCooldown()

  return (
    <form
      onSubmit={handleSubmit(({ code }) => onSubmit(code))}
      aria-describedby={credentialsError ? "code-error" : undefined}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}
      >
        <p
          className={css`
            padding-top: 10px;
          `}
        >
          {t("insert-single-use-code-account-deletion")}
        </p>

        <OneTimePassCodeField onChange={(val) => setValue("code", val, { shouldValidate: true })} />

        {credentialsError && (
          <div
            id="code-error"
            aria-live="assertive"
            className={css`
              padding: 10px;
              border: 2px solid ${baseTheme.colors.red[500]};
              font-weight: bold;
              color: ${baseTheme.colors.red[500]};
            `}
          >
            {t("incorrect-code")}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size={"medium"}
          disabled={(code?.length ?? 0) !== 6}
          className={css`
            padding-top: 10px;
          `}
        >
          {t("button-text-verify")}
        </Button>

        <div
          className={css`
            display: flex;
            flex-direction: row;
            align-items: baseline;
          `}
        >
          <p>{t("delete-account-did-not-receive-email")}</p>
          <Button
            variant="icon"
            size={"small"}
            transform="none"
            disabled={resendCooldown > 0}
            onClick={() => {
              onResend()
              startCooldown(60)
            }}
            className={css`
              padding-left: 4px !important;
              color: ${baseTheme.colors.green[600]}!important;
            `}
          >
            {resendCooldown > 0 ? `${t("resend")} (${resendCooldown})` : t("resend")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default VerifyOneTimeCodeForm

function useCooldown(initial = 0) {
  const [timeLeft, setTimeLeft] = React.useState(initial)

  const start = (seconds: number) => {
    if (timeLeft > 0) {
      return
    }
    setTimeLeft(seconds)
  }

  React.useEffect(() => {
    if (timeLeft <= 0) {
      return
    }
    const timeout = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    return () => clearTimeout(timeout)
  }, [timeLeft])

  return [timeLeft, start] as const
}
