"use client"

import { css } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/shared-module/components/components/Dialog"
import { OtpField } from "@/shared-module/components/components/OtpField"

import { isAppApiError } from "../errors/AppApiError"
import {
  getAuthSessionStatusQueryKey,
  postAuthSessionStatusEmailCodeMutation,
  postAuthSessionStatusVerifyMutation,
} from "../generated/auth-api/@tanstack/react-query.generated"
import type { SessionVerifyResult } from "../generated/auth-api/types.generated"
import useLogout from "../hooks/useLogout"
import useSessionVerificationRequired from "../hooks/useSessionVerificationRequired"
import "../init/registerAuthApiClients"

const CODE_LENGTH = 6
const HTTP_TOO_MANY_REQUESTS = 429

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  p {
    margin: 0;
  }
`

const resendCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

const resendButtonCss = css`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--color-green-700);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: 2px;
    border-radius: 2px;
  }
`

/**
 * Blocking "is it really you" dialog; renders nothing unless the session needs verification.
 * Mount once inside the login-state and query providers of a normal page layout.
 */
const SessionVerificationDialog: React.FC = () => {
  const { t } = useTranslation("shared-module")
  const queryClient = useQueryClient()
  const { logout } = useLogout()
  const isVerificationRequired = useSessionVerificationRequired()
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [resendNotice, setResendNotice] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const { control, handleSubmit, watch, reset } = useForm<{ code: string }>({
    defaultValues: { code: "" },
  })
  const code = watch("code")

  const requestEmailCode = useMutation({
    ...postAuthSessionStatusEmailCodeMutation(),
    onSuccess: (result) => {
      if (result.type === "not_required") {
        void queryClient.invalidateQueries({ queryKey: getAuthSessionStatusQueryKey() })
        return
      }
      setMaskedEmail(result.masked_email)
      switch (result.type) {
        case "recently_sent":
          setResendNotice(
            t("session-verification-recently-sent", { seconds: result.retry_after_seconds }),
          )
          break
        case "daily_limit_reached":
          setResendNotice(t("session-verification-daily-limit-reached"))
          break
        case "sent":
        case "already_sent":
          setResendNotice(null)
          break
      }
    },
    onError: (error) => setResendNotice(errorMessage(error)),
  })
  const { mutate: sendCode } = requestEmailCode

  const verifyCode = useMutation({
    ...postAuthSessionStatusVerifyMutation(),
    onSuccess: (result) => {
      if (result.type === "verified" || result.type === "not_required") {
        void queryClient.invalidateQueries({ queryKey: getAuthSessionStatusQueryKey() })
        return
      }
      setCodeError(verifyFailureMessage(result.type))
      reset({ code: "" })
    },
    onError: (error) => {
      setCodeError(errorMessage(error))
      reset({ code: "" })
    },
  })

  useEffect(() => {
    if (isVerificationRequired) {
      sendCode({ body: { resend: false } })
    }
  }, [isVerificationRequired, sendCode])

  useEffect(() => {
    if (code.length > 0) {
      setCodeError(null)
    }
  }, [code])

  const errorMessage = (error: unknown) =>
    isAppApiError(error) && error.status === HTTP_TOO_MANY_REQUESTS
      ? t("session-verification-rate-limited")
      : t("session-verification-failed")

  const verifyFailureMessage = (
    type: Exclude<SessionVerifyResult["type"], "verified" | "not_required">,
  ) => {
    switch (type) {
      case "invalid_code":
        return t("session-verification-invalid-code")
      case "expired_code":
        return t("session-verification-expired-code")
      case "too_many_attempts":
        return t("session-verification-too-many-attempts")
    }
  }

  const submit = handleSubmit((values) => verifyCode.mutate({ body: { code: values.code } }))

  return (
    <Dialog
      open={isVerificationRequired}
      // Not dismissible: closing is only by verifying or logging out.
      onClose={() => {}}
      showCloseButton={false}
      title={t("session-verification-title")}
      data-testid="session-verification-dialog"
      actions={[
        { label: t("log-out"), variant: "secondary", onPress: () => void logout() },
        {
          label: t("session-verification-verify"),
          variant: "primary",
          isLoading: verifyCode.isPending,
          disabled: code.length !== CODE_LENGTH,
          onPress: () => void submit(),
        },
      ]}
    >
      <div className={bodyCss}>
        <p>
          {t("session-verification-unrecognized-network")}
          {maskedEmail !== null &&
            ` ${t("session-verification-code-sent-to", { email: maskedEmail })}`}
        </p>
        <OtpField
          name="code"
          control={control}
          label={t("session-verification-code-label")}
          length={CODE_LENGTH}
          // oxlint-disable-next-line i18next/no-literal-string
          fieldSize="lg"
          isFullWidth
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists only to take the code
          autoFocus
          autoComplete="one-time-code"
          errorMessage={codeError ?? undefined}
        />
        <p className={resendCss}>
          {resendNotice !== null ? <span role="status">{resendNotice}</span> : null}{" "}
          {t("session-verification-didnt-get-it")}{" "}
          <button
            type="button"
            className={resendButtonCss}
            disabled={requestEmailCode.isPending}
            onClick={() => sendCode({ body: { resend: true } })}
          >
            {t("session-verification-send-again")}
          </button>
        </p>
      </div>
    </Dialog>
  )
}

export default SessionVerificationDialog
