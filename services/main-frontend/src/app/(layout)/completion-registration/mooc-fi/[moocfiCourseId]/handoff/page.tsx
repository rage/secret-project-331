"use client"

import { css } from "@emotion/css"
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
import { CardHeading } from "@/components/credit-registration/CreditRegistrationStatus"
import {
  bandCss,
  bandedCardCss,
  headingCss,
  narrowPageCss,
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
import { Button, DescriptionList, Infobox, Link, Spinner } from "@/shared-module/components"

/** The account the student must recognise before a sign-in happens on their behalf. */
const accountBoxCss = css`
  padding: var(--space-4);
  border: 1px solid var(--color-clear-400);
  border-radius: var(--surface-radius);
  background: var(--color-clear-100);
`

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
  const courseName = linkQuery.data?.course_name ?? ""
  const backToMoocfi = moocfiCourseUrl ? (
    <Link href={moocfiCourseUrl}>{t("credit-registration-back-to-moocfi")}</Link>
  ) : null
  const signedInNow = userQuery.data
    ? [{ label: t("label-signed-in-now"), value: <strong>{userQuery.data.email}</strong> }]
    : []
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
      <LandingCard courseName={courseName}>
        <Spinner label={t("credit-registration-handoff-continuing")} />
      </LandingCard>
    )
  }

  if (pending?.signed_in_account === "different") {
    return (
      <LandingCard
        courseName={courseName}
        heading={t("credit-registration-handoff-different-account-heading")}
      >
        <p>
          {userQuery.data
            ? t("credit-registration-handoff-different-account")
            : t("credit-registration-handoff-confirm")}
        </p>
        <AccountBox
          items={[
            ...signedInNow,
            {
              label: t(userQuery.data ? "label-handoff-signs-in-as" : "label-handoff-account"),
              value: <strong>{pending.email}</strong>,
            },
          ]}
        />
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
      <LandingCard
        courseName={courseName}
        heading={t("credit-registration-handoff-confirm-heading")}
      >
        <p>{t("credit-registration-handoff-confirm")}</p>
        <AccountBox
          items={[{ label: t("label-handoff-account"), value: <strong>{pending.email}</strong> }]}
        />
        {continueFailed}
        <div className={rowCss}>
          {continueButton(t("credit-registration-handoff-continue-with-account"))}
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
      <LandingCard
        courseName={courseName}
        heading={t("credit-registration-handoff-different-account-heading")}
      >
        <p>
          {t("credit-registration-handoff-different-account-unknown")}{" "}
          {t("credit-registration-handoff-different-account-sign-in")}
        </p>
        {signedInNow.length > 0 ? <AccountBox items={signedInNow} /> : null}
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

  const deadEnd =
    reason === REASON_RATE_LIMITED
      ? {
          heading: t("credit-registration-handoff-rate-limited-heading"),
          body: t("credit-registration-handoff-rate-limited"),
        }
      : isSignedIn
        ? {
            heading: t("credit-registration-handoff-failed-heading"),
            body: t("credit-registration-handoff-failed"),
          }
        : {
            heading: t("credit-registration-handoff-signed-out-heading"),
            body: t("credit-registration-handoff-signed-out"),
          }
  return (
    <LandingCard courseName={courseName} heading={deadEnd.heading}>
      <p>{deadEnd.body}</p>
      {moocfiCourseUrl ? (
        <div className={rowCss}>
          <Link href={moocfiCourseUrl} styledAsButton variant={BUTTON_PRIMARY} size="medium">
            {t("credit-registration-back-to-moocfi")}
          </Link>
        </div>
      ) : null}
    </LandingCard>
  )
}

/** The registration card's title band, with this page's state as the band below it. */
const LandingCard: React.FC<{
  courseName: string
  heading?: string
  children: React.ReactNode
}> = ({ courseName, heading, children }) => (
  <div className={narrowPageCss}>
    <article className={bandedCardCss}>
      <CardHeading courseName={courseName} moduleName={null} ectsCredits={null} />
      <section className={bandCss}>
        {heading ? <h2 className={headingCss}>{heading}</h2> : null}
        {children}
      </section>
    </article>
  </div>
)

const AccountBox: React.FC<{ items: { label: string; value: React.ReactNode }[] }> = ({
  items,
}) => (
  <div className={accountBoxCss}>
    <DescriptionList items={items} />
  </div>
)

export default withErrorBoundary(MoocfiHandoffPage)
