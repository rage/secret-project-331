"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import {
  BUTTON_SECONDARY,
  CREDIT_REGISTRATION_NS,
} from "@/components/credit-registration/constants"
import {
  bandCss,
  bandedCardCss,
  cardTitleBandCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  rowCss,
} from "@/components/credit-registration/styles"
import {
  getMoocfiCourseLinkOptions,
  getUserDetailsForAuthenticatedUserOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useLogout from "@/shared-module/common/hooks/useLogout"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Link } from "@/shared-module/components"

/** Must match the reason the backend's handoff redeem redirects here with. */
const DIFFERENT_USER_SIGNED_IN = "different_user_signed_in"

/**
 * Where a handoff from mooc.fi lands when another account is already signed in here. The handoff
 * never switches accounts, so the student signs out and starts again from mooc.fi.
 */
const MoocfiHandoffErrorPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  usePageTitle(t("heading-credit-registration"))
  const { moocfiCourseId } = useParams<{ moocfiCourseId: string }>()
  const reason = useQueryParameter("reason")
  const loginState = useContext(LoginStateContext)
  const { logout } = useLogout()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const isSignedIn = loginState.signedIn === true
  const linkQuery = useQuery(
    getMoocfiCourseLinkOptions({ path: { moocfi_course_id: moocfiCourseId } }),
  )
  const userQuery = useQuery({
    ...getUserDetailsForAuthenticatedUserOptions(),
    enabled: isSignedIn,
  })
  const moocfiCourseUrl = linkQuery.data?.moocfi_course_url

  const logOut = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const body = !isSignedIn ? (
    <p>{t("credit-registration-handoff-signed-out")}</p>
  ) : reason === DIFFERENT_USER_SIGNED_IN ? (
    <>
      <p>{t("credit-registration-handoff-different-user")}</p>
      {userQuery.data ? (
        <p className={noteCss}>
          {t("credit-registration-signed-in-as", { email: userQuery.data.email })}
        </p>
      ) : null}
      <p>{t("credit-registration-handoff-log-out-and-retry")}</p>
    </>
  ) : (
    <p>{t("credit-registration-handoff-failed")}</p>
  )

  return (
    <div className={narrowPageCss}>
      <article className={bandedCardCss}>
        <header className={cardTitleBandCss}>
          <h1 className={pageTitleCss}>
            {isSignedIn && reason === DIFFERENT_USER_SIGNED_IN
              ? t("credit-registration-handoff-different-user-heading")
              : t("register-completion")}
          </h1>
        </header>
        <section className={bandCss}>
          {body}
          <div className={rowCss}>
            {isSignedIn ? (
              <Button
                variant={BUTTON_SECONDARY}
                size="medium"
                isLoading={isLoggingOut}
                onClick={() => void logOut()}
              >
                {t("logout")}
              </Button>
            ) : null}
            {moocfiCourseUrl ? (
              <Link href={moocfiCourseUrl}>{t("credit-registration-back-to-moocfi")}</Link>
            ) : null}
          </div>
        </section>
      </article>
    </div>
  )
}

export default withErrorBoundary(MoocfiHandoffErrorPage)
