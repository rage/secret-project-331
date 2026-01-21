"use client"

import type { TFunction } from "i18next"
import { useContext, useEffect, useState } from "react"

import useUserResearchConsentQuery from "@/hooks/useUserResearchConsentQuery"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { login, verifyEmail } from "@/shared-module/common/services/backend/auth"

export type LoginStep =
  | { step: "credentials" }
  | { step: "verification"; token: string }
  | { step: "awaiting_consent_check" }
  | { step: "consent_form" }
  | { step: "complete" }

export interface UseLoginFlowReturn {
  step: LoginStep
  credentialsError: boolean
  verificationError: string | null
  error: string | null
  isSubmittingCredentials: boolean
  isSubmittingVerification: boolean
  submitCredentials: (email: string, password: string) => Promise<void>
  submitVerification: (code: string) => Promise<void>
  onConsentSubmitted: () => void
}

/**
 * useLoginFlow coordinates login, email verification, and research consent steps.
 */
export const useLoginFlow = (onComplete: () => void, t: TFunction): UseLoginFlowReturn => {
  const loginStateContext = useContext(LoginStateContext)
  const [step, setStep] = useState<LoginStep>({ step: "credentials" })
  const [credentialsError, setCredentialsError] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verificationToken, setVerificationToken] = useState<string | null>(null)

  const getUserConsent = useUserResearchConsentQuery()

  const loginMutation = useToastMutation(
    async (credentials: { email: string; password: string }) => {
      const response = await login(credentials.email, credentials.password)
      setError(null)
      setCredentialsError(false)

      if (response.type === "success") {
        await loginStateContext.refresh()
        setStep({ step: "awaiting_consent_check" })
        return true
      } else if (response.type === "requires_email_verification") {
        setVerificationToken(response.email_verification_token)
        setStep({ step: "verification", token: response.email_verification_token })
        return false
      } else {
        setCredentialsError(true)
        return false
      }
    },
    { notify: false },
  )

  const verifyMutation = useToastMutation(
    async (code: string) => {
      const currentToken = step.step === "verification" ? step.token : verificationToken
      if (!currentToken) {
        setError(t("verification-failed"))
        throw new Error(t("verification-failed"))
      }
      setError(null)
      setVerificationError(null)
      const success = await verifyEmail(currentToken, code)
      if (success) {
        await loginStateContext.refresh()
        setStep({ step: "awaiting_consent_check" })
        return true
      } else {
        setVerificationError("verification-failed")
        return false
      }
    },
    { notify: false },
  )

  useEffect(() => {
    if (step.step === "awaiting_consent_check") {
      if (getUserConsent.status === "error") {
        setStep({ step: "consent_form" })
      } else if (getUserConsent.status === "success") {
        setStep({ step: "complete" })
      }
    }
  }, [step.step, getUserConsent.status])

  useEffect(() => {
    if (step.step === "complete") {
      onComplete()
    }
  }, [step.step, onComplete])

  const submitCredentials = async (email: string, password: string) => {
    try {
      await loginMutation.mutateAsync({ email, password })
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e
      }
      console.error("failed to login: ", e)
      setError(t("failed-to-authenticate"))
    }
  }

  const submitVerification = async (code: string) => {
    try {
      await verifyMutation.mutateAsync(code)
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e
      }
      console.error("failed to verify: ", e)
      setError(t("verification-failed"))
    }
  }

  const onConsentSubmitted = () => {
    setStep({ step: "complete" })
  }

  return {
    step,
    credentialsError,
    verificationError,
    error,
    isSubmittingCredentials: loginMutation.isPending,
    isSubmittingVerification: verifyMutation.isPending,
    submitCredentials,
    submitVerification,
    onConsentSubmitted,
  }
}
