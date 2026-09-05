"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import {
  cardCss,
  narrowPageCss,
  pageTitleCss,
  rowCss,
  studentNumberCss,
} from "@/components/credit-registration/styles"
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
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useLogout from "@/shared-module/common/hooks/useLogout"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import {
  linkStudentNumberRoute,
  loginRoute,
  profileCreditRegistrationRoute,
  signUpRoute,
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"
import { humanReadableDate } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { InfoboxTone } from "@/shared-module/components"
import { Button, DescriptionList, Infobox, Link, QueryResult } from "@/shared-module/components"

const claimSummaryCss = cx(
  cardCss,
  css`
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
  `,
)

const outcomeCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &:focus {
    outline: none;
  }
`

/** Every way this page can end without a linked number, shared by the preview and the claim. */
const DEAD_ENDS = {
  not_found: { tone: TONE.WARNING, messageKey: "link-student-number-not-found" },
  expired: { tone: TONE.INFO, messageKey: "link-student-number-expired" },
  already_used: { tone: TONE.INFO, messageKey: "link-student-number-already-used" },
  already_used_by_this_account: {
    tone: TONE.INFO,
    messageKey: "link-student-number-already-used-by-this-account",
  },
  conflict: { tone: TONE.WARNING, messageKey: "link-student-number-conflict" },
  unusable: { tone: TONE.INFO, messageKey: "link-student-number-unusable" },
} as const satisfies Record<string, { tone: InfoboxTone; messageKey: string }>

type DeadEndReason = (typeof DEAD_ENDS)[keyof typeof DEAD_ENDS]

const LinkStudentNumberPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("heading-link-student-number"))
  const { token } = useParams<{ token: string }>()
  const loginState = useContext(LoginStateContext)

  return (
    <div className={narrowPageCss}>
      <h1 className={pageTitleCss}>{t("heading-link-student-number")}</h1>
      {loginState.signedIn === true ? (
        <SignedIn token={token} />
      ) : loginState.signedIn === false ? (
        <SignInOrSignUp token={token} />
      ) : null}
    </div>
  )
}

/** Signup sits beside login: a first-time visitor arriving from this mail has no account yet. */
const SignInOrSignUp: React.FC<{ token: string }> = ({ token }) => {
  const { t } = useTranslation()
  const returnTo = linkStudentNumberRoute(token)
  return (
    <>
      <p>{t("link-student-number-sign-in-required")}</p>
      <div className={rowCss}>
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
      renderBlockingError={() => <DeadEnd reason={DEAD_ENDS.not_found} />}
    >
      {(data) => <Confirmation token={token} preview={data} onClaimed={setResult} />}
    </QueryResult>
  )
}

/**
 * A link that cannot be used again. Always paired with somewhere to go, since the student number
 * page is where the state and the remaining options are.
 */
const DeadEnd: React.FC<{ reason: DeadEndReason }> = ({ reason }) => {
  const { t } = useTranslation()
  return (
    <>
      <Infobox tone={reason.tone}>{t(reason.messageKey)}</Infobox>
      <div className={rowCss}>
        <Link
          href={userSettingsStudentNumberRoute()}
          styledAsButton
          variant="secondary"
          size="medium"
        >
          {t("credit-registration-about-your-student-number")}
        </Link>
      </div>
    </>
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
    return <DeadEnd reason={unusableLinkReason(preview)} />
  }

  const sisuName = [preview.first_names, preview.last_name].filter(Boolean).join(" ")
  const expiresAt = humanReadableDate(preview.expires_at, i18n.language)
  const secondaryItems = [
    ...(sisuName ? [{ label: t("label-name-in-university-records"), value: sisuName }] : []),
    ...(preview.course_name ? [{ label: t("label-course"), value: preview.course_name }] : []),
    ...(expiresAt ? [{ label: t("label-link-expires-at"), value: expiresAt }] : []),
  ]

  return (
    <>
      {claim.isError && (
        <Infobox tone={TONE.WARNING} announce>
          {t("link-student-number-could-not-link")}
        </Infobox>
      )}
      <p>{t("link-student-number-confirm-question")}</p>
      <div className={claimSummaryCss}>
        <span className={studentNumberCss}>{preview.student_number}</span>
        <span>
          {t("link-student-number-to-this-account", { account: preview.target_account_email })}
        </span>
      </div>
      <DescriptionList items={secondaryItems} />
      {preview.current_student_number ? (
        <Infobox tone={TONE.WARNING}>
          {t("link-student-number-replaces-current", {
            current: preview.current_student_number,
          })}
        </Infobox>
      ) : null}
      <div className={rowCss}>
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
      {/* Opening the mail while logged in to the wrong account is the common mistake. */}
      <div className={rowCss}>
        <Button variant="tertiary" size="small" onClick={() => void logout()}>
          {t("link-student-number-wrong-account")}
        </Button>
      </div>
    </>
  )
}

const unusableLinkReason = (preview: StudentNumberVerificationTokenPreview): DeadEndReason => {
  if (preview.conflicts_with_other_account) {
    return DEAD_ENDS.conflict
  }
  if (preview.already_used) {
    return preview.already_used_by_this_account
      ? DEAD_ENDS.already_used_by_this_account
      : DEAD_ENDS.already_used
  }
  if (preview.expired) {
    return DEAD_ENDS.expired
  }
  return DEAD_ENDS.unusable
}

const CLAIM_FAILURE_REASONS: Partial<
  Record<ClaimStudentNumberVerificationTokenResult["outcome"], DeadEndReason>
> = {
  expired: DEAD_ENDS.expired,
  already_used: DEAD_ENDS.already_used,
  student_number_already_linked_to_another_account: DEAD_ENDS.conflict,
}

const ClaimOutcomeBody: React.FC<{ result: ClaimStudentNumberVerificationTokenResult }> = ({
  result,
}) => {
  const { t } = useTranslation()
  const failure = CLAIM_FAILURE_REASONS[result.outcome]
  if (failure) {
    return <DeadEnd reason={failure} />
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
      <div className={rowCss}>
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

const ClaimOutcome: React.FC<{ result: ClaimStudentNumberVerificationTokenResult }> = ({
  result,
}) => {
  // The subtree swapped under the button that was pressed, so focus has to follow it or it falls
  // back to the document and the outcome goes unread.
  const outcomeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    outcomeRef.current?.focus()
  }, [])

  return (
    <div className={outcomeCss} ref={outcomeRef} tabIndex={-1}>
      <ClaimOutcomeBody result={result} />
    </div>
  )
}

export default withErrorBoundary(LinkStudentNumberPage)
