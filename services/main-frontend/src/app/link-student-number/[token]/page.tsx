"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import {
  getMyCreditRegistrationsQueryKey,
  getMyVerifiedStudentNumberQueryKey,
  previewStudentNumberVerificationTokenOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { claimStudentNumberVerificationToken } from "@/generated/api/sdk.generated"
import type {
  ClaimStudentNumberVerificationTokenResult,
  StudentNumberVerificationTokenPreview,
} from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useLogout from "@/shared-module/common/hooks/useLogout"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import {
  linkStudentNumberRoute,
  loginRoute,
  profileCreditRegistrationRoute,
  signUpRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, DescriptionList, Infobox, Link, QueryResult } from "@/shared-module/components"

const pageCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 640px;
  margin: 3rem auto 5rem;

  h1 {
    margin: 0;
  }

  p {
    margin: 0;
    line-height: 1.55;
  }
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
`

const quietActionCss = css`
  background: none;
  border: 0;
  padding: 0;
  color: var(--color-blue-600);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
`

const LinkStudentNumberPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("heading-link-student-number"))
  const { token } = useParams<{ token: string }>()
  const loginState = useContext(LoginStateContext)

  return (
    <main className={pageCss}>
      <h1>{t("heading-link-student-number")}</h1>
      {loginState.signedIn === true ? (
        <SignedIn token={token} />
      ) : loginState.signedIn === false ? (
        <SignInOrSignUp token={token} />
      ) : null}
    </main>
  )
}

/** Signup sits beside login: a first-time visitor arriving from this mail has no account yet. */
const SignInOrSignUp: React.FC<{ token: string }> = ({ token }) => {
  const { t } = useTranslation()
  const returnTo = linkStudentNumberRoute(token)
  return (
    <>
      <p>{t("link-student-number-sign-in-required")}</p>
      <div className={actionsCss}>
        <Link href={loginRoute(returnTo)} styledAsButton variant="primary" size="medium">
          {t("login")}
        </Link>
        <Link href={signUpRoute(returnTo)} styledAsButton variant="secondary" size="medium">
          {t("create-an-account")}
        </Link>
      </div>
    </>
  )
}

const SignedIn: React.FC<{ token: string }> = ({ token }) => {
  const { t } = useTranslation()
  const [result, setResult] = useState<ClaimStudentNumberVerificationTokenResult | null>(null)
  const preview = useQuery({
    ...previewStudentNumberVerificationTokenOptions({ path: { token } }),
    // The token is single use; refetching a preview is pointless and a stale one is misleading.
    refetchOnWindowFocus: false,
  })

  if (result) {
    return <ClaimOutcome result={result} />
  }
  return (
    <QueryResult
      query={preview}
      renderBlockingError={() => (
        <Infobox tone={TONE.WARNING}>{t("link-student-number-not-found")}</Infobox>
      )}
    >
      {(data) => <Confirmation token={token} preview={data} onClaimed={setResult} />}
    </QueryResult>
  )
}

const Confirmation: React.FC<{
  token: string
  preview: StudentNumberVerificationTokenPreview
  onClaimed: (result: ClaimStudentNumberVerificationTokenResult) => void
}> = ({ token, preview, onClaimed }) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { logout } = useLogout()

  const claim = useToastMutation<ClaimStudentNumberVerificationTokenResult, unknown, void>(
    async () => await claimStudentNumberVerificationToken({ path: { token } }),
    { notify: false },
    {
      onSuccess: async (claimResult) => {
        onClaimed(claimResult)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getMyVerifiedStudentNumberQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
        ])
      },
    },
  )

  if (!preview.claimable) {
    return <UnusableLink preview={preview} />
  }

  const sisuName = [preview.first_names, preview.last_name].filter(Boolean).join(" ")
  const items = [
    { label: t("label-student-number"), value: preview.student_number },
    ...(sisuName ? [{ label: t("label-name-in-university-records"), value: sisuName }] : []),
    { label: t("label-this-account"), value: preview.target_account_email },
    ...(preview.course_name ? [{ label: t("label-course"), value: preview.course_name }] : []),
    {
      label: t("label-link-expires-at"),
      value: new Date(preview.expires_at).toLocaleDateString(i18n.language),
    },
  ]

  return (
    <>
      {claim.isError && <ErrorBanner variant={"readOnly"} error={claim.error} />}
      <p>{t("link-student-number-confirm-question")}</p>
      <DescriptionList items={items} />
      {preview.current_student_number ? (
        <Infobox tone={TONE.WARNING}>
          {t("link-student-number-replaces-current", {
            current: preview.current_student_number,
          })}
        </Infobox>
      ) : null}
      <div className={actionsCss}>
        <Button
          variant="primary"
          size="medium"
          isLoading={claim.isPending}
          onClick={() => claim.mutate()}
          data-testid="link-student-number-confirm-button"
        >
          {t("link-student-number-confirm")}
        </Button>
        <Link href={profileCreditRegistrationRoute()}>{t("button-text-cancel")}</Link>
      </div>
      <p>
        {/* Opening the mail while logged in to the wrong account is the common mistake. */}
        <button type="button" className={quietActionCss} onClick={() => void logout()}>
          {t("link-student-number-wrong-account")}
        </button>
      </p>
    </>
  )
}

const UnusableLink: React.FC<{ preview: StudentNumberVerificationTokenPreview }> = ({
  preview,
}) => {
  const { t } = useTranslation()
  if (preview.conflicts_with_other_account) {
    return <Infobox tone={TONE.WARNING}>{t("link-student-number-conflict")}</Infobox>
  }
  if (preview.already_used) {
    return (
      <Infobox>
        {preview.already_used_by_this_account
          ? t("link-student-number-already-used-by-this-account")
          : t("link-student-number-already-used")}
      </Infobox>
    )
  }
  if (preview.expired) {
    return <Infobox>{t("link-student-number-expired")}</Infobox>
  }
  return <Infobox>{t("link-student-number-unusable")}</Infobox>
}

const ClaimOutcome: React.FC<{ result: ClaimStudentNumberVerificationTokenResult }> = ({
  result,
}) => {
  const { t } = useTranslation()
  if (result.outcome === "expired") {
    return <Infobox>{t("link-student-number-expired")}</Infobox>
  }
  if (result.outcome === "already_used") {
    return <Infobox>{t("link-student-number-already-used")}</Infobox>
  }
  if (result.outcome === "student_number_already_linked_to_another_account") {
    return <Infobox tone={TONE.WARNING}>{t("link-student-number-conflict")}</Infobox>
  }
  return (
    <>
      <Infobox heading={t("link-student-number-success-heading")}>
        {result.outcome === "already_linked_to_this_account"
          ? t("link-student-number-already-linked-to-this-account", {
              studentNumber: result.student_number,
            })
          : t("link-student-number-success", { studentNumber: result.student_number })}
      </Infobox>
      {result.newly_unblocked_registration_count > 0 ? (
        <p>
          {t("link-student-number-success-unblocked", {
            count: result.newly_unblocked_registration_count,
          })}
        </p>
      ) : null}
      <div className={actionsCss}>
        <Link
          href={profileCreditRegistrationRoute()}
          styledAsButton
          variant="primary"
          size="medium"
        >
          {t("credit-registration-see-all-my-registrations")}
        </Link>
      </div>
    </>
  )
}

export default withErrorBoundary(LinkStudentNumberPage)
