"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle, Envelope } from "@vectopus/atlas-icons-react"
import { useSearchParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { claimEmailVerificationLink } from "@/generated/api/sdk.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult } from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const ACCOUNT_SETTINGS_PATH = "/user-settings/account"
// oxlint-disable-next-line i18next/no-literal-string
const HOME_PATH = "/"
const TOKEN_QUERY_PARAM = "token"

const panelCss = css`
  padding: var(--space-5);
  margin-bottom: var(--space-4);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--space-3);
  background: var(--color-gray-50);

  h1 {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0 0 var(--space-3);
    font-size: var(--font-size-5);
  }

  p {
    margin: 0;
    color: var(--color-gray-700);
  }
`

const verifiedPanelCss = css`
  border-color: var(--color-green-300);
  background: var(--color-green-100);
`

const hintCss = css`
  margin-top: var(--space-4);
  color: var(--color-gray-600);
  font-size: var(--font-size-1);
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
`

const EmailVerifiedPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-email-verified"))
  const token = useSearchParams().get(TOKEN_QUERY_PARAM)

  // A query rather than a mutation on purpose. The claim has to fire on load, and react-query caches
  // per token, so a remount (React strict mode double-invokes effects) cannot spend the link a second
  // time and then report it back as already used.
  const claim = useQuery({
    queryKey: ["claim-email-verification-link", token],
    queryFn: async () => await claimEmailVerificationLink({ body: { token: token ?? "" } }),
    enabled: token !== null,
    staleTime: Infinity,
    retry: false,
  })

  // Reached by anyone who types the URL, and by tmc.mooc.fi's own confirmation redirect, which carries
  // no token of ours. Saying "verified" here is what this page used to do and what it must not do.
  if (token === null) {
    return (
      <Outcome
        heading={t("heading-email-not-verified")}
        message={t("message-email-verification-link-carried-no-token")}
      />
    )
  }

  return <QueryResult query={claim}>{(result) => <ClaimOutcome result={result} />}</QueryResult>
}

const ClaimOutcome: React.FC<{ result: string }> = ({ result }) => {
  const { t } = useTranslation()
  switch (result) {
    case "verified":
      return (
        <Outcome
          verified
          heading={t("message-your-email-has-been-verified")}
          message={t("message-email-verification-what-it-means")}
        />
      )
    case "already_used":
      return (
        <Outcome
          heading={t("heading-email-verification-link-already-used")}
          message={t("message-email-verification-link-already-used")}
        />
      )
    case "expired":
      return (
        <Outcome
          heading={t("heading-email-verification-link-expired")}
          message={t("message-email-verification-link-expired")}
        />
      )
    case "email_changed":
      return (
        <Outcome
          heading={t("heading-email-not-verified")}
          message={t("message-email-verification-link-was-for-another-address")}
        />
      )
    default:
      return (
        <Outcome
          heading={t("heading-email-not-verified")}
          message={t("message-email-verification-link-invalid")}
        />
      )
  }
}

interface OutcomeProps {
  heading: string
  message: string
  verified?: boolean
}

const Outcome: React.FC<OutcomeProps> = ({ heading, message, verified = false }) => {
  const { t } = useTranslation()
  return (
    <div data-testid="email-verification-outcome">
      <div className={verified ? `${panelCss} ${verifiedPanelCss}` : panelCss}>
        <h1>
          {verified ? <CheckCircle size={28} /> : <Envelope size={28} />}
          {heading}
        </h1>
        <p>{message}</p>
        {verified ? null : (
          <p className={hintCss}>{t("message-email-verification-request-a-new-link-hint")}</p>
        )}
      </div>

      <div className={actionsCss}>
        <Link href={HOME_PATH} styledAsButton variant="primary" size="medium">
          {t("home-page")}
        </Link>
        <Link href={ACCOUNT_SETTINGS_PATH} styledAsButton variant="secondary" size="medium">
          {t("link-account-settings")}
        </Link>
      </div>
    </div>
  )
}

export default withErrorBoundary(EmailVerifiedPage)
