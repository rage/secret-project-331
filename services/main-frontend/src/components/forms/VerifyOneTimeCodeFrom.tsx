import { css } from "@emotion/css"
import React, { useState } from "react"
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
  const [code, setCode] = useState("")
  const [resendCooldown, startCooldown] = useCooldown()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(code)
      }}
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

        <OneTimePassCodeField onChange={setCode} />
        {credentialsError && (
          <div
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
          <p>{t("delete-account-did-not-recieve-email")}</p>
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
