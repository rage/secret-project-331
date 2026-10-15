"use client"

import { css } from "@emotion/css"
import React, { useImperativeHandle } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { TextField } from "@/shared-module/components"

export interface VerifyPasswordFormHandle {
  submit: () => void
}

interface VerifyPasswordFormProps {
  onSubmit: (password: string) => void
  credentialsError: boolean
}

const VerifyPasswordForm = React.forwardRef<VerifyPasswordFormHandle, VerifyPasswordFormProps>(
  function VerifyPasswordForm({ onSubmit, credentialsError }, ref) {
    const { t } = useTranslation()
    // oxlint-disable-next-line i18next/no-literal-string
    const { control, handleSubmit } = useForm<{ password: string }>({ mode: "onChange" })

    const submitForm = handleSubmit((data) => onSubmit(data.password))

    useImperativeHandle(ref, () => ({ submit: () => void submitForm() }), [submitForm])

    return (
      <form onSubmit={submitForm}>
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
        </div>
      </form>
    )
  },
)

VerifyPasswordForm.displayName = "VerifyPasswordForm"

export default VerifyPasswordForm
