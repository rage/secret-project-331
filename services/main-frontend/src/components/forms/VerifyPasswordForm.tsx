"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, TextField } from "@/shared-module/components"

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
  // oxlint-disable-next-line i18next/no-literal-string
  const { control, handleSubmit } = useForm<{ password: string }>({ mode: "onChange" })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data.password))}>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}
      >
        <p>{t("delete-account-info")}</p>
        <TextField
          name="password"
          control={control}
          rules={{ required: true }}
          type="password"
          label={t("label-password")}
          className={css`
            margin-bottom: 0px;
          `}
          {...(credentialsError ? { errorMessage: t("incorrect-password") } : {})}
        />
        <Button type="submit" variant="primary" disabled={isPending} size={"medium"}>
          {t("confirm")}
        </Button>
      </div>
    </form>
  )
}

export default VerifyPasswordForm
