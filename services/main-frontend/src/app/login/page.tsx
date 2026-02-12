"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
import { useCallback, useContext, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { CredentialsForm } from "@/app/login/CredentialsForm"
import { VerificationForm } from "@/app/login/VerificationForm"
import ResearchOnCoursesForm from "@/components/forms/ResearchOnCoursesForm"
import { useLoginFlow } from "@/hooks/useLoginFlow"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Login: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const loginStateContext = useContext(LoginStateContext)
  const uncheckedReturnTo = useQueryParameter("return_to")

  useEffect(() => {
    if (loginStateContext.signedIn) {
      const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
      router.push(returnTo)
    }
  }, [loginStateContext.signedIn, uncheckedReturnTo, router])

  const redirect = useCallback(() => {
    const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
    router.push(returnTo)
  }, [router, uncheckedReturnTo])

  const {
    step,
    credentialsError,
    verificationError,
    error,
    isSubmittingCredentials,
    isSubmittingVerification,
    submitCredentials,
    submitVerification,
    onConsentSubmitted,
  } = useLoginFlow(redirect, t)

  return (
    <div
      className={css`
        margin: 0 auto;
        a {
          text-decoration: none;
          color: #007bff;
          :hover {
            text-decoration: underline;
          }
        }
      `}
    >
      {error && <ErrorBanner error={error} />}

      {step.step === "credentials" && (
        <CredentialsForm
          onSubmit={submitCredentials}
          error={credentialsError}
          isSubmitting={isSubmittingCredentials}
        />
      )}

      {step.step === "verification" && (
        <VerificationForm
          onSubmit={submitVerification}
          error={verificationError}
          isSubmitting={isSubmittingVerification}
        />
      )}

      {step.step === "awaiting_consent_check" && (
        <div
          className={css`
            display: flex;
            flex-direction: column;
            padding: 3rem 0rem;
            align-items: center;
          `}
        >
          <Spinner variant={"medium"} />
        </div>
      )}

      {step.step === "consent_form" && <ResearchOnCoursesForm afterSubmit={onConsentSubmitted} />}

      {step.step === "complete" && (
        <div
          className={css`
            display: flex;
            flex-direction: column;
            padding: 3rem 0rem;
            align-items: center;
          `}
        >
          <Spinner variant={"medium"} />
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(Login)
