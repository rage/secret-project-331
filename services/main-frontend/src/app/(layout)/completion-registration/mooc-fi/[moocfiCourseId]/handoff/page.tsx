"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useContext, useEffect } from "react"
import { useTranslation } from "react-i18next"

import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CREDIT_REGISTRATION_NS,
  TONE,
} from "@/components/credit-registration/constants"
import {
  bandCss,
  bandedCardCss,
  cardTitleBandCss,
  narrowPageCss,
  pageTitleCss,
  rowCss,
} from "@/components/credit-registration/styles"
import {
  getMoocfiCourseLinkOptions,
  getPendingMoocfiHandoffOptions,
  getUserDetailsForAuthenticatedUserOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { continueMoocfiHandoff } from "@/generated/api/sdk.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useLogout from "@/shared-module/common/hooks/useLogout"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import { loginRoute, moocfiCompletionRegistrationRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Infobox, Link, Spinner } from "@/shared-module/components"

/** Must match the reasons the backend's handoff redeem redirects here with. */
const REASON_DIFFERENT_ACCOUNT = "different_account"
const REASON_RATE_LIMITED = "rate_limited"

/**
 * Where a handoff from mooc.fi lands when it cannot sign the student in by itself: another account
 * is signed in here, or the student came from another site and confirms the account first.
 */
const MoocfiHandoffPage: React.FC = () => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  usePageTitle(t("heading-credit-registration"))
  const { moocfiCourseId } = useParams<{ moocfiCourseId: string }>()
  const reason = useQueryParameter("reason")
  const loginState = useContext(LoginStateContext)
  const { logout } = useLogout()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const isSignedIn = loginState.signedIn === true
  const pendingQuery = useQuery({
    ...getPendingMoocfiHandoffOptions({ query: { moocfi_course_id: moocfiCourseId } }),
    retry: false,
  })
  const linkQuery = useQuery(
    getMoocfiCourseLinkOptions({
      path: { moocfi_course_id: moocfiCourseId },
      query: { ui_language: i18n.language },
    }),
  )
  const userQuery = useQuery({
    ...getUserDetailsForAuthenticatedUserOptions(),
    enabled: isSignedIn,
  })
  const pending = pendingQuery.data
  const continueHandoff = useMutation({
    mutationFn: async () => {
      if (!pending) {
        throw new Error("No sign-in is waiting")
      }
      const continued = await continueMoocfiHandoff({
        body: {
          moocfi_course_id: moocfiCourseId,
          expected_signed_in_account: pending.signed_in_account,
        },
      })
      return continued.redirect_path
    },
    // A full navigation, so the page loads as the account now signed in.
    onSuccess: (redirectPath) => window.location.assign(redirectPath),
  })

  // `pending` has already spent the continuation: the right account is signed in.
  useEffect(() => {
    if (pending?.signed_in_account === "same") {
      window.location.assign(pending.redirect_path)
    }
  }, [pending?.signed_in_account, pending?.redirect_path])

  const logOutAndSignIn = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      window.location.assign(loginRoute(moocfiCompletionRegistrationRoute(moocfiCourseId)))
    } finally {
      setIsLoggingOut(false)
    }
  }

  const moocfiCourseUrl = linkQuery.data?.moocfi_course_url
  const backToMoocfi = moocfiCourseUrl ? (
    <Link href={moocfiCourseUrl}>{t("credit-registration-back-to-moocfi")}</Link>
  ) : null
  const continueFailed = continueHandoff.isError ? (
    <Infobox tone={TONE.DANGER} announce>
      {t("credit-registration-handoff-continue-failed")}
    </Infobox>
  ) : null
  const continueButton = (label: string) => (
    <Button
      variant={BUTTON_PRIMARY}
      size="medium"
      isLoading={continueHandoff.isPending}
      onClick={() => continueHandoff.mutate()}
    >
      {label}
    </Button>
  )

  if (pendingQuery.isPending || pending?.signed_in_account === "same") {
    return (
      <LandingCard heading={t("register-completion")}>
        <Spinner label={t("credit-registration-handoff-continuing")} />
      </LandingCard>
    )
  }

  if (pending?.signed_in_account === "different") {
    return (
      <LandingCard heading={t("credit-registration-handoff-different-account-heading")}>
        <p>
          {userQuery.data
            ? t("credit-registration-handoff-different-account", {
                handoffEmail: pending.email,
                signedInEmail: userQuery.data.email,
              })
            : t("credit-registration-handoff-confirm", { email: pending.email })}
        </p>
        {continueFailed}
        <div className={rowCss}>
          {continueButton(t("credit-registration-handoff-log-out-and-continue"))}
          {backToMoocfi}
        </div>
      </LandingCard>
    )
  }

  if (pending?.signed_in_account === "none") {
    return (
      <LandingCard heading={t("credit-registration-handoff-confirm-heading")}>
        <p>{t("credit-registration-handoff-confirm", { email: pending.email })}</p>
        {continueFailed}
        <div className={rowCss}>
          {continueButton(t("credit-registration-handoff-continue-as", { email: pending.email }))}
          <Link href={loginRoute(moocfiCompletionRegistrationRoute(moocfiCourseId))}>
            {t("credit-registration-handoff-sign-in-another-account")}
          </Link>
        </div>
      </LandingCard>
    )
  }

  // Nothing is waiting: the handoff expired, or came from another IP, so nobody is signed in by it.
  if (reason === REASON_DIFFERENT_ACCOUNT && isSignedIn) {
    return (
      <LandingCard heading={t("credit-registration-handoff-different-account-heading")}>
        <p>{t("credit-registration-handoff-different-account-unknown")}</p>
        <p>{t("credit-registration-handoff-different-account-sign-in")}</p>
        <div className={rowCss}>
          <Button
            variant={BUTTON_SECONDARY}
            size="medium"
            isLoading={isLoggingOut}
            onClick={() => void logOutAndSignIn()}
          >
            {t("logout")}
          </Button>
          {backToMoocfi}
        </div>
      </LandingCard>
    )
  }

  return (
    <LandingCard heading={t("register-completion")}>
      <p>
        {reason === REASON_RATE_LIMITED
          ? t("credit-registration-handoff-rate-limited")
          : isSignedIn
            ? t("credit-registration-handoff-failed")
            : t("credit-registration-handoff-signed-out")}
      </p>
      <div className={rowCss}>{backToMoocfi}</div>
    </LandingCard>
  )
}

const LandingCard: React.FC<{ heading: string; children: React.ReactNode }> = ({
  heading,
  children,
}) => (
  <div className={narrowPageCss}>
    <article className={bandedCardCss}>
      <header className={cardTitleBandCss}>
        <h1 className={pageTitleCss}>{heading}</h1>
      </header>
      <section className={bandCss}>{children}</section>
    </article>
  </div>
)

export default withErrorBoundary(MoocfiHandoffPage)
