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
          {t("insert-single-use-code-accoutnt-deletion")}
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
            onClick={onResend}
            className={css`
              padding-left: 4px !important;
              color: ${baseTheme.colors.green[600]}!important;
            `}
          >
            {t("resend")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default VerifyOneTimeCodeForm
