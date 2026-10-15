"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/shared-module/components/components/Dialog"
import {
  ONE_TIME_CODE_LENGTH,
  OneTimeCodeForm,
} from "@/shared-module/components/components/OneTimeCodeForm"

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

const HTTP_TOO_MANY_REQUESTS = 429
/** The server refuses a resend for two minutes after a code went out. */
const RESEND_COOLDOWN_SECONDS = 120

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
  const [lastSentAt, setLastSentAt] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const formId = useId()

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
          setLastSentAt(
            new Date(
              Date.now() + (result.retry_after_seconds - RESEND_COOLDOWN_SECONDS) * 1000,
            ).toISOString(),
          )
          setResendNotice(
            t("session-verification-recently-sent", { seconds: result.retry_after_seconds }),
          )
          break
        case "daily_limit_reached":
          setResendNotice(t("session-verification-daily-limit-reached"))
          break
        case "sent":
          setLastSentAt(new Date().toISOString())
          setResendNotice(null)
          break
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
    },
    onError: (error) => setCodeError(errorMessage(error)),
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
          type: "submit",
          domProps: { form: formId },
          isLoading: verifyCode.isPending,
          disabled: code.length !== ONE_TIME_CODE_LENGTH,
        },
      ]}
    >
      <OneTimeCodeForm
        id={formId}
        message={
          maskedEmail === null
            ? t("session-verification-unrecognized-network")
            : `${t("session-verification-unrecognized-network")} ${t("session-verification-code-sent-to", { email: maskedEmail })}`
        }
        onSubmit={async (submittedCode) => {
          // Failures are shown through the mutation's own callbacks.
          await verifyCode.mutateAsync({ body: { code: submittedCode } }).catch(() => undefined)
        }}
        onCodeChange={setCode}
        error={codeError}
        isSubmitting={verifyCode.isPending}
        resend={{
          helperText: t("session-verification-didnt-get-it"),
          label: t("session-verification-send-again"),
          onResend: () => sendCode({ body: { resend: true } }),
          cooldownSeconds: RESEND_COOLDOWN_SECONDS,
          lastSentAt,
          statusMessage: resendNotice,
        }}
      />
    </Dialog>
  )
}

export default SessionVerificationDialog
