"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Padlock } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getAuthReauthenticationStatusOptions } from "@/shared-module/common/generated/auth-api/@tanstack/react-query.generated"
import {
  postAuthReauthenticateWithCode,
  postAuthReauthenticateWithPassword,
  postAuthSendReauthenticationCode,
} from "@/shared-module/common/generated/auth-api/sdk.generated"
import type { ReauthenticationResult } from "@/shared-module/common/generated/auth-api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, ErrorNotice, TextField } from "@/shared-module/components"
import {
  settingsCardCss,
  settingsCardHeaderCss,
  settingsCardIconChipCss,
} from "@/styles/sharedStyles"
import "@/shared-module/common/init/registerAuthApiClients"

import OneTimeCodeForm from "./forms/OneTimeCodeForm"

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: flex-start;

  p {
    margin: 0;
    color: var(--color-gray-700);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-self: stretch;
    max-width: 24rem;
  }
`

const codeFormCss = css`
  padding: 0;
  align-self: stretch;
  max-width: 24rem;
`

/**
 * Whether this session was signed in through mooc.fi or Elements of AI and must confirm the
 * account before changing its email or password, or deleting it. `undefined` until known: keep the
 * controls disabled then, but do not explain why.
 */
export const useIsReauthenticationRequired = (): boolean | undefined => {
  const statusQuery = useQuery(getAuthReauthenticationStatusOptions())
  // The server refuses the changes anyway, so a failed status read must not lock the controls.
  if (statusQuery.isError) {
    return false
  }
  return statusQuery.data?.is_required
}

/** Lets a session signed in through a handoff confirm the account. Nothing when not needed. */
const ReauthenticationSection: React.FC<{ email: string }> = ({ email }) => {
  const { t } = useTranslation()
  if (useIsReauthenticationRequired() !== true) {
    return null
  }
  return (
    <div className={settingsCardCss} data-testid="reauthentication-section">
      <div className={settingsCardHeaderCss}>
        <div className={settingsCardIconChipCss}>
          <Padlock size={16} />
        </div>
        <h2>{t("heading-confirm-your-account")}</h2>
      </div>
      <Body email={email} />
    </div>
  )
}

const Body: React.FC<{ email: string }> = ({ email }) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [result, setResult] = useState<ReauthenticationResult | null>(null)
  // oxlint-disable-next-line i18next/no-literal-string
  const { control, handleSubmit } = useForm<{ password: string }>({ mode: "onChange" })

  const onResult = async (outcome: ReauthenticationResult) => {
    setResult(outcome)
    if (outcome.type === "reauthenticated") {
      await queryClient.invalidateQueries({
        queryKey: getAuthReauthenticationStatusOptions().queryKey,
      })
    }
  }

  const withPassword = useToastMutation(
    async (password: string) => await postAuthReauthenticateWithPassword({ body: { password } }),
    { notify: false },
    { onSuccess: onResult },
  )
  const sendCode = useToastMutation(
    async () => await postAuthSendReauthenticationCode({ body: { language: i18n.language } }),
    { notify: false },
    { onSuccess: () => setResult(null) },
  )
  const withCode = useToastMutation(
    async (code: string) => await postAuthReauthenticateWithCode({ body: { code } }),
    { notify: false },
    { onSuccess: onResult },
  )

  const codeError =
    result?.type === "invalid_code"
      ? t("reauthentication-code-incorrect")
      : result?.type === "too_many_attempts"
        ? t("reauthentication-code-too-many-attempts")
        : null
  const failed = [withPassword, sendCode, withCode].find((mutation) => mutation.isError)

  return (
    <div className={bodyCss}>
      <p>{t("reauthentication-explanation")}</p>
      {failed && <ErrorNotice error={failed.error} />}
      {sendCode.isSuccess ? (
        <OneTimeCodeForm
          containerClassName={codeFormCss}
          message={t("reauthentication-code-sent", { email })}
          onSubmit={async (code) => {
            await withCode.mutateAsync(code)
          }}
          submitLabel={t("confirm")}
          error={codeError}
          isSubmitting={withCode.isPending}
          resend={{
            helperText: t("reauthentication-code-did-not-arrive"),
            label: t("resend"),
            onResend: () => sendCode.mutate(),
            ...(sendCode.data.type === "recently_sent"
              ? { statusMessage: t("reauthentication-code-recently-sent") }
              : {}),
          }}
        />
      ) : (
        <>
          <form onSubmit={handleSubmit((data) => withPassword.mutate(data.password))}>
            <TextField
              name="password"
              control={control}
              rules={{ required: t("required-field") }}
              type="password"
              label={t("label-password")}
              {...(result?.type === "incorrect_password"
                ? { errorMessage: t("reauthentication-password-incorrect") }
                : {})}
            />
            <div>
              <Button
                type="submit"
                variant="primary"
                size="medium"
                isLoading={withPassword.isPending}
              >
                {t("confirm")}
              </Button>
            </div>
          </form>
          <p>{t("reauthentication-code-instead")}</p>
          <Button
            variant="secondary"
            size="medium"
            isLoading={sendCode.isPending}
            onClick={() => sendCode.mutate()}
          >
            {t("reauthentication-send-code", { email })}
          </Button>
        </>
      )}
    </div>
  )
}

export default ReauthenticationSection
