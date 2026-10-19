"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useContext, useEffect, useRef, useState } from "react"
import { VisuallyHidden } from "react-aria"
import type { Control } from "react-hook-form"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS, TONE } from "@/components/credit-registration/constants"
import {
  narrowPageCss,
  noteCss,
  pageTitleCss,
  rowCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
import {
  getMyCreditRegistrationsQueryKey,
  getMyVerifiedStudentNumberQueryKey,
  previewStudentNumberVerificationTokenOptions,
  previewStudentNumberVerificationTokenQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { claimStudentNumberVerificationToken } from "@/generated/api/sdk.generated"
import type {
  ClaimStudentNumberVerificationTokenResult,
  NameReplacement,
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
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { InfoboxTone } from "@/shared-module/components"
import { Button, Infobox, Link, QueryResult, Radio, RadioGroup } from "@/shared-module/components"

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

const eyebrowCss = css`
  margin: 0 0 var(--space-3);
  color: var(--color-gray-700);
  font-size: var(--font-size-1);
  font-weight: 500;
`

const confirmationCss = css`
  display: grid;
  gap: var(--space-5);
`

const introCss = css`
  display: grid;
  gap: var(--space-3);
  font-size: var(--font-size-3);
`

const recordsCss = css`
  display: grid;
  gap: var(--space-3);
`

const recordCss = css`
  display: grid;
  padding: var(--space-4);
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
`

// The record the student checks first, so the only border on the page that reads as a boundary.
const sisuRecordCss = css`
  border-color: var(--color-gray-400);
`

const recordTitleCss = css`
  margin: 0 0 var(--space-2);
  color: var(--color-gray-700);
  font-size: 15px;
  font-weight: 500;
`

const sisuFactsCss = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3) var(--space-5);
  margin: 0;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }

  dd {
    margin: 0;
    color: var(--color-gray-700);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
  }
`

const factLabelCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

const studentNumberValueCss = css`
  font-variant-numeric: tabular-nums;
`

const accountEmailCss = css`
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-gray-700);
  font-size: var(--font-size-3);
  font-weight: 600;
`

const accountNameCss = css`
  margin: var(--space-3) 0 0;
  color: var(--color-gray-700);
  font-size: 15px;

  span:first-child {
    margin-right: var(--space-2);
    color: var(--color-gray-500);
  }
`

// Colour alone would not carry the mismatch to everyone, hence the underline.
const mismatchCss = css`
  text-decoration: underline 2px;
  text-underline-offset: 3px;
`

const mismatchHighlightCss = css`
  background: var(--color-yellow-300);
`

const outcomeCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`

/** Every way this page can end without a linked number, shared by the preview and the claim. */
const DEAD_ENDS = {
  not_found: {
    tone: TONE.WARNING,
    messageKey: "link-student-number-not-found",
  },
  expired: {
    tone: TONE.INFO,
    messageKey: "link-student-number-expired",
  },
  already_used: {
    tone: TONE.INFO,
    messageKey: "link-student-number-already-used",
  },
  already_used_by_this_account: {
    tone: TONE.INFO,
    messageKey: "link-student-number-already-used-by-this-account",
  },
  conflict: {
    tone: TONE.WARNING,
    messageKey: "link-student-number-conflict",
  },
  unusable: {
    tone: TONE.INFO,
    messageKey: "link-student-number-unusable",
  },
} as const satisfies Record<string, { tone: InfoboxTone; messageKey: string }>

type DeadEndReason = (typeof DEAD_ENDS)[keyof typeof DEAD_ENDS]

/** The heading of every state of the page, under the course the link was sent for when it is known. */
const PageHeading: React.FC<{ courseName?: string | null | undefined }> = ({ courseName }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <div>
      {courseName ? <p className={eyebrowCss}>{courseName}</p> : null}
      <h1 className={pageTitleCss}>{t("heading-link-student-number")}</h1>
    </div>
  )
}

const LinkStudentNumberPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  usePageTitle(t("heading-link-student-number"))
  const { token } = useParams<{ token: string }>()
  const loginState = useContext(LoginStateContext)

  return (
    <div className={narrowPageCss}>
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
      <PageHeading />
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
    return (
      <>
        <PageHeading courseName={result.linked_course_name} />
        <ClaimOutcome result={result} />
      </>
    )
  }
  return (
    <>
      <PageHeading courseName={preview.data?.course_name} />
      <QueryResult
        query={preview}
        contentClassName={sectionsCss}
        renderBlockingError={() => <DeadEnd reason={DEAD_ENDS.not_found} />}
      >
        {(data) => <Confirmation token={token} preview={data} onClaimed={setResult} />}
      </QueryResult>
    </>
  )
}

/** A link that cannot be used again, with a way to the page where the number's state lives. */
const DeadEnd: React.FC<{ reason: DeadEndReason }> = ({ reason }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

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

interface NameForm {
  firstName: string
}

const Confirmation: React.FC<{
  token: string
  preview: StudentNumberVerificationTokenPreview
  onClaimed: (result: ClaimStudentNumberVerificationTokenResult) => void
}> = ({ token, preview, onClaimed }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const { logout } = useLogout()
  const nameChange = preview.name_change ?? null
  const { control, getValues, reset } = useForm<NameForm>({
    defaultValues: { firstName: nameChange?.suggested_first_name ?? "" },
  })
  // A refetched preview may offer other names: the claim rejects any the server no longer offers.
  useEffect(() => {
    reset({ firstName: nameChange?.suggested_first_name ?? "" })
  }, [nameChange, reset])

  const claim = useToastMutation<ClaimStudentNumberVerificationTokenResult, unknown, void>(
    async () =>
      await claimStudentNumberVerificationToken({
        path: { token },
        body: { first_name: nameChange ? getValues("firstName") : null },
      }),
    { notify: false },
    {
      onSuccess: async (claimResult) => {
        onClaimed(claimResult)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getMyVerifiedStudentNumberQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
        ])
      },
      // The account's name may have changed since the preview, which makes the claim refuse it.
      onError: async () => {
        await queryClient.invalidateQueries({
          queryKey: previewStudentNumberVerificationTokenQueryKey({ path: { token } }),
        })
      },
    },
  )

  if (!preview.claimable) {
    return <DeadEnd reason={unusableLinkReason(preview)} />
  }

  const namesDiffer = nameChange?.resembles_nothing ?? false
  // Opening the mail while logged in to the wrong account is the common mistake.
  const logoutLink = (
    // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
    <button type="button" className={wrongAccountActionCss} onClick={() => void logout()} />
  )
  const mismatchNote = namesDiffer ? (
    <VisuallyHidden> {t("link-student-number-names-differ-note")}</VisuallyHidden>
  ) : null

  return (
    <div className={confirmationCss}>
      <div className={introCss}>
        <p>{t("link-student-number-lead")}</p>
      </div>

      <div className={recordsCss}>
        <section className={cx(recordCss, sisuRecordCss)} aria-labelledby="link-sisu-record">
          <h2 id="link-sisu-record" className={recordTitleCss}>
            {t("link-student-number-in-sisu")}
          </h2>
          <dl className={sisuFactsCss}>
            {preview.sisu_full_name ? (
              <div>
                <dt className={factLabelCss}>{t("label-name")}</dt>
                <dd>
                  <span className={cx(namesDiffer && mismatchCss)}>{preview.sisu_full_name}</span>
                  {mismatchNote}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className={factLabelCss}>{t("label-student-number")}</dt>
              <dd className={studentNumberValueCss}>{preview.student_number}</dd>
            </div>
          </dl>
        </section>

        <section className={recordCss} aria-labelledby="link-account-record">
          <h2 id="link-account-record" className={recordTitleCss}>
            {t("link-student-number-logged-in-as")}
          </h2>
          <p className={accountEmailCss}>{preview.target_account_email}</p>
          <p className={noteCss}>
            <Trans t={t} i18nKey="link-student-number-wrong-account" components={{ logoutLink }} />
          </p>
          {preview.target_account_name ? (
            <p className={accountNameCss}>
              <span>{t("link-student-number-name-on-mooc-fi")}</span>
              <span className={cx(namesDiffer && mismatchCss, namesDiffer && mismatchHighlightCss)}>
                {preview.target_account_name}
              </span>
              {mismatchNote}
            </p>
          ) : null}
        </section>
      </div>

      {namesDiffer ? (
        <Infobox tone={TONE.WARNING} heading={t("link-student-number-names-differ-heading")}>
          <Trans
            t={t}
            i18nKey="link-student-number-names-differ"
            values={{ notMine: t("link-student-number-not-mine") }}
            components={{ logoutLink }}
          />
        </Infobox>
      ) : null}

      {nameChange ? (
        <NameChoice control={control} nameChange={nameChange} />
      ) : preview.target_account_name ? (
        <p>
          <Trans
            t={t}
            i18nKey="link-student-number-name-stays"
            values={{ name: preview.target_account_name }}
            components={{ name: <strong /> }}
          />
        </p>
      ) : null}

      {preview.current_student_number ? (
        <Infobox tone={TONE.WARNING}>
          {t("link-student-number-replaces-current", {
            current: preview.current_student_number,
          })}
        </Infobox>
      ) : null}
      {claim.isError && (
        <Infobox tone={TONE.WARNING} announce>
          {t("link-student-number-could-not-link")}
        </Infobox>
      )}
      <div className={rowCss}>
        <Button
          variant="primary"
          size="medium"
          isLoading={claim.isPending}
          onClick={() => claim.mutate()}
          data-testid="link-student-number-confirm-button"
        >
          {namesDiffer
            ? t("link-student-number-confirm-names-differ")
            : t("link-student-number-confirm")}
        </Button>
        <Link href={profileStudiesRoute()} styledAsButton variant="secondary" size="medium">
          {t("link-student-number-not-mine")}
        </Link>
      </div>
    </div>
  )
}

/** The question linking has to ask, kept quiet: the records above are what the student checks. */
const NameChoice: React.FC<{
  control: Control<NameForm>
  nameChange: NameReplacement
}> = ({ control, nameChange }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const fullName = (firstName: string) => `${firstName} ${nameChange.last_name}`

  const [onlyOption, ...otherOptions] = nameChange.first_name_options
  if (onlyOption !== undefined && otherOptions.length === 0) {
    return (
      <p>
        <Trans
          t={t}
          i18nKey="link-student-number-name-will-be"
          values={{ name: fullName(onlyOption) }}
          components={{ name: <strong /> }}
        />
      </p>
    )
  }
  return (
    <RadioGroup
      name="firstName"
      control={control}
      label={t("link-student-number-name-question")}
      description={t("link-student-number-name-hint")}
    >
      {nameChange.first_name_options.map((firstName) => (
        <Radio key={firstName} value={firstName} label={fullName(firstName)} />
      ))}
    </RadioGroup>
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
}> = ({ result }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const failure = CLAIM_FAILURE_REASONS[result.outcome]
  if (failure) {
    return <DeadEnd reason={failure} />
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
}> = ({ result }) => {
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
