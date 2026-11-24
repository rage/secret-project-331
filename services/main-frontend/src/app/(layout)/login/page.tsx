"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useContext, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { CredentialsForm } from "@/app/(layout)/login/CredentialsForm"
import { VerificationForm } from "@/app/(layout)/login/VerificationForm"
import { AuthCard, AuthCardFooterLink } from "@/components/auth/AuthCard"
import ResearchOnCoursesForm from "@/components/forms/ResearchOnCoursesForm"
import { useLoginFlow } from "@/hooks/useLoginFlow"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import {
  useCurrentPagePathForReturnTo,
  validateReturnToRouteOrDefault,
} from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { signUpRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Dialog, ErrorNotice, Link, LoadingRegion } from "@/shared-module/components"

const Login: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("login"))
  const router = useRouter()
  const loginStateContext = useContext(LoginStateContext)
  const uncheckedReturnTo = useQueryParameter("return_to")
  const pathname = usePathname()
  const returnToForLinkToSignupPage = useCurrentPagePathForReturnTo(pathname)

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
    cancelVerification,
    onConsentSubmitted,
  } = useLoginFlow(redirect, t)

  useEffect(() => {
    if (loginStateContext.signedIn && step.step === "credentials") {
      const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
      router.push(returnTo)
    }
  }, [loginStateContext.signedIn, uncheckedReturnTo, router, step.step])

  const isCredentialsStep = step.step === "credentials" || step.step === "verification"

  return (
    <>
      {isCredentialsStep ? (
        <AuthCard
          title={t("login")}
          lede={
            <>
              {t("login-description")} <Link href="https://mooc.fi">{t("login.linkMooc")}</Link>{" "}
              {t("login-description2")}
            </>
          }
          footer={
            <AuthCardFooterLink
              prompt={t("dont-have-an-account")}
              href={signUpRoute(returnToForLinkToSignupPage)}
            >
              {t("title-sign-up")}
            </AuthCardFooterLink>
          }
        >
          {/* oxlint-disable-next-line i18next/no-literal-string -- ErrorNotice enum value */}
          {error && <ErrorNotice error={error} density="compact" />}
          <CredentialsForm
            onSubmit={submitCredentials}
            error={credentialsError}
            isSubmitting={isSubmittingCredentials}
          />
        </AuthCard>
      ) : (
        error && <ErrorNotice error={error} />
      )}

      <Dialog
        open={step.step === "verification"}
        size="small"
        onClose={cancelVerification}
        title={t("email-verification-title")}
      >
        <VerificationForm
          onSubmit={submitVerification}
          error={verificationError}
          isSubmitting={isSubmittingVerification}
        />
      </Dialog>

      {step.step === "awaiting_consent_check" && <LoadingRegion />}

      {step.step === "consent_form" && <ResearchOnCoursesForm afterSubmit={onConsentSubmitted} />}

      {step.step === "complete" && <LoadingRegion />}
    </>
  )
}

export default withErrorBoundary(Login)
