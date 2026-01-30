"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme } from "@/shared-module/common/styles"

interface VerifyPasswordFormProps {
  onSubmit: (password: string) => void
  isPending: boolean
  credentialsError: boolean
}

const VerifyPasswordForm: React.FC<VerifyPasswordFormProps> = ({
  onSubmit,
  isPending,
  credentialsError,
}) => {
  const { t } = useTranslation()
  // eslint-disable-next-line i18next/no-literal-string
  const { register, handleSubmit } = useForm<{ password: string }>({ mode: "onChange" })

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data.password))}
      aria-describedby={credentialsError ? "password-error" : undefined}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}
      >
        <p>{t("delete-account-info")}</p>
        <TextField
          type="password"
          label={t("label-password")}
          className={css`
            margin-bottom: 0px;
          `}
          aria-invalid={credentialsError}
          aria-describedby={credentialsError ? "password-error" : undefined}
          {...register("password", { required: true })}
        />
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
            {t("incorrect-password")}
          </div>
        )}
        <Button type="submit" variant="primary" disabled={isPending} size={"medium"}>
          {t("confirm")}
        </Button>
      </div>
    </form>
  )
}

export default VerifyPasswordForm
