"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useContext, useEffect, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS, TONE } from "@/components/credit-registration/constants"
import type { StudentNumberLinkProblem } from "@/components/credit-registration/studentSupportMail"
import { studentNumberLinkSupportMail } from "@/components/credit-registration/studentSupportMail"
import {
  cardCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  rowCss,
  sectionsCss,
  studentNumberCss,
} from "@/components/credit-registration/styles"
import SupportMailLink from "@/components/credit-registration/SupportMailLink"
import { useCanConfirmEmailAddress } from "@/components/credit-registration/useCanConfirmEmailAddress"
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
  profileStudiesRoute,
  signUpRoute,
  userSettingsRoute,
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { InfoboxTone } from "@/shared-module/components"
import { Button, DescriptionList, Infobox, Link, QueryResult } from "@/shared-module/components"

const wrongAccountActionCss = css`
  color: var(--color-green-700);
  text-decoration: underline;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;

  &:hover {
    color: var(--color-green-800);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--space-1);
  }
`

const outcomeCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`

/**
 * Every way this page can end without a linked number, shared by the preview and the claim.
 *
 * `support` names what a mail to support would have to ask for, and `null` marks the one ending
 * that needs nothing: the number is already on this account.
 */
const DEAD_ENDS = {
  not_found: {
    tone: TONE.WARNING,
    messageKey: "link-student-number-not-found",
    support: "need_a_new_link",
  },
  expired: {
    tone: TONE.INFO,
    messageKey: "link-student-number-expired",
    support: "need_a_new_link",
  },
  already_used: {
    tone: TONE.INFO,
    messageKey: "link-student-number-already-used",
    support: "used_by_someone_else",
  },
  already_used_by_this_account: {
    tone: TONE.INFO,
    messageKey: "link-student-number-already-used-by-this-account",
    support: null,
  },
  conflict: {
    tone: TONE.WARNING,
    messageKey: "link-student-number-conflict",
    support: "linked_to_another_account",
  },
  unusable: {
    tone: TONE.INFO,
    messageKey: "link-student-number-unusable",
    support: "need_a_new_link",
  },
} as const satisfies Record<
  string,
  { tone: InfoboxTone; messageKey: string; support: StudentNumberLinkProblem | null }
>

type DeadEndReason = (typeof DEAD_ENDS)[keyof typeof DEAD_ENDS]

const LinkStudentNumberPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
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
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
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
    return <ClaimOutcome result={result} studentNumber={preview.data?.student_number} />
  }
  return (
    <QueryResult
      query={preview}
      contentClassName={sectionsCss}
      renderBlockingError={() => <DeadEnd reason={DEAD_ENDS.not_found} />}
    >
      {(data) => <Confirmation token={token} preview={data} onClaimed={setResult} />}
    </QueryResult>
  )
}

/**
 * A link that cannot be used again, with the ways out of it: a mail that already says what went
 * wrong, the fast track that needs no mail at all, and the page where the number's state lives.
 */
const DeadEnd: React.FC<{ reason: DeadEndReason; studentNumber?: string | null | undefined }> = ({
  reason,
  studentNumber,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const canConfirmEmail = useCanConfirmEmailAddress()

  return (
    <>
      <Infobox tone={reason.tone}>{t(reason.messageKey)}</Infobox>
      <div className={rowCss}>
        {canConfirmEmail && reason.support === "need_a_new_link" ? (
          <Link href={userSettingsRoute()} styledAsButton variant="primary" size="medium">
            {t("button-confirm-your-email-address")}
          </Link>
        ) : null}
        <Link
          href={userSettingsStudentNumberRoute()}
          styledAsButton
          variant="secondary"
          size="medium"
        >
          {t("credit-registration-about-your-student-number")}
        </Link>
      </div>
      {reason.support ? (
        <SupportMailLink {...studentNumberLinkSupportMail(t, reason.support, studentNumber)} />
      ) : null}
    </>
  )
}

const Confirmation: React.FC<{
  token: string
  preview: StudentNumberVerificationTokenPreview
  onClaimed: (result: ClaimStudentNumberVerificationTokenResult) => void
}> = ({ token, preview, onClaimed }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
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
    return <DeadEnd reason={unusableLinkReason(preview)} studentNumber={preview.student_number} />
  }

  const sisuName = [preview.first_names, preview.last_name].filter(Boolean).join(" ")
  const items = [
    ...(sisuName ? [{ label: t("label-name-in-university-records"), value: sisuName }] : []),
    { label: t("label-mooc-fi-account"), value: preview.target_account_email },
  ]
  // Opening the mail while logged in to the wrong account is the common mistake.
  const logoutLink = (
    // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
    <button type="button" className={wrongAccountActionCss} onClick={() => void logout()} />
  )

  return (
    <>
      {claim.isError && (
        <Infobox tone={TONE.WARNING} announce>
          {t("link-student-number-could-not-link")}
        </Infobox>
      )}
      {preview.course_name ? (
        <p>{t("link-student-number-why-you-got-this", { course: preview.course_name })}</p>
      ) : null}
      {/* The one moment of consent in the flow, so it says what the number will be used for. */}
      <p>{t("link-student-number-what-linking-means")}</p>
      <div className={cardCss}>
        <div>
          <p className={noteCss}>{t("label-student-number")}</p>
          <p className={studentNumberCss}>{preview.student_number}</p>
        </div>
        <DescriptionList items={items} />
      </div>
      <p>{t("link-student-number-confirm-question")}</p>
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
        <Link href={profileStudiesRoute()}>{t("button-text-cancel")}</Link>
      </div>
      <p className={noteCss}>
        <Trans t={t} i18nKey="link-student-number-wrong-account" components={{ logoutLink }} />
      </p>
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

const ClaimOutcomeBody: React.FC<{
  result: ClaimStudentNumberVerificationTokenResult
  studentNumber: string | null | undefined
}> = ({ result, studentNumber }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const failure = CLAIM_FAILURE_REASONS[result.outcome]
  if (failure) {
    return <DeadEnd reason={failure} studentNumber={studentNumber} />
  }
  const hasUnblockedRegistrations = result.newly_unblocked_registration_count > 0
  return (
    <>
      <Infobox tone={TONE.SUCCESS} heading={t("link-student-number-success-heading")}>
        {result.outcome === "already_linked_to_this_account"
          ? t("link-student-number-already-linked-to-this-account", {
              studentNumber: result.student_number,
            })
          : t("link-student-number-success", { studentNumber: result.student_number })}
      </Infobox>
      {hasUnblockedRegistrations ? (
        <>
          <p>
            {t("link-student-number-success-unblocked", {
              count: result.newly_unblocked_registration_count,
            })}
          </p>
          <p>{t("link-student-number-success-what-next")}</p>
        </>
      ) : null}
      <div className={rowCss}>
        <Link href={profileStudiesRoute()} styledAsButton variant="primary" size="medium">
          {hasUnblockedRegistrations
            ? t("link-text-follow-the-registration")
            : t("heading-my-studies")}
        </Link>
      </div>
    </>
  )
}

const ClaimOutcome: React.FC<{
  result: ClaimStudentNumberVerificationTokenResult
  studentNumber: string | null | undefined
}> = ({ result, studentNumber }) => {
  // The subtree swapped under the button that was pressed, so focus has to follow it or it falls
  // back to the document and the outcome goes unread.
  const outcomeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    outcomeRef.current?.focus()
  }, [])

  return (
    <div className={outcomeCss} ref={outcomeRef} tabIndex={-1}>
      <ClaimOutcomeBody result={result} studentNumber={studentNumber} />
    </div>
  )
}

export default withErrorBoundary(LinkStudentNumberPage)
