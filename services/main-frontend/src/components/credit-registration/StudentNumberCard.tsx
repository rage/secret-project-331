"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import {
  getMyCreditRegistrationsOptions,
  getMyCreditRegistrationsQueryKey,
  getMyStudiesOptions,
  getMyVerifiedStudentNumberOptions,
  getMyVerifiedStudentNumberQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { dismissMyAutoLinkNotice, unlinkMyStudentNumber } from "@/generated/api/sdk.generated"
import type {
  LinkingEmailStatus,
  MyVerifiedStudentNumber,
  StudentNumberVerificationMethod,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import {
  profileStudiesRoute,
  userSettingsRoute,
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"
import { humanReadableDate } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Badge,
  Button,
  ConfirmDialog,
  DescriptionList,
  Infobox,
  Link,
  QueryResult,
} from "@/shared-module/components"

import { BUTTON_TERTIARY, CREDIT_REGISTRATION_NS, TONE } from "./constants"
import { LinkingEmailLine, sentLinkingEmail } from "./EmailStatusLine"
import {
  headingCss,
  monospaceCss,
  noteCss,
  rowCss,
  sectionCss,
  sectionHeaderCss,
  stepsCss,
  studentNumberCss,
  subheadingCss,
} from "./styles"
import { useCanConfirmEmailAddress } from "./useCanConfirmEmailAddress"

/** A student disputing a wrong number needs to know how the link was proved. */
const PROVENANCE_VALUE_KEYS = {
  emailed_link: "student-number-confirmed-by-emailed-link",
  email_match_fast_track: "student-number-confirmed-by-email-match",
  admin_manual: "student-number-confirmed-by-admin-manual",
} as const satisfies Record<StudentNumberVerificationMethod, string>

/** Separates the destructive action from the provenance above it by weight, not just position. */
const dangerZoneCss = css`
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-clear-300);
`

const StudentNumberCard: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const linkQuery = useQuery({ ...getMyVerifiedStudentNumberOptions() })
  const registrationsQuery = useQuery({ ...getMyCreditRegistrationsOptions() })
  const myStudiesQuery = useQuery({ ...getMyStudiesOptions() })
  // Unknown while myStudiesQuery is still loading: default to the has-a-registering-course
  // wording rather than flash the "none of your courses register credits" line before that is
  // known to be true.
  const hasRegisteringCourse =
    myStudiesQuery.data?.any_module_supports_credit_registration !== false

  const linkingEmail =
    registrationsQuery.data?.find(
      (registration) =>
        registration.student_facing_status === "needs_student_number" && registration.linking_email,
    )?.linking_email ?? null

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("heading-student-number")}</h2>
      <QueryResult
        query={linkQuery}
        treatNullAsEmpty
        contentClassName={sectionCss}
        emptyFallback={<NotLinked linkingEmail={linkingEmail} />}
      >
        {(link) =>
          link ? <Linked link={link} hasRegisteringCourse={hasRegisteringCourse} /> : null
        }
      </QueryResult>
    </section>
  )
}

const Linked: React.FC<{ link: MyVerifiedStudentNumber; hasRegisteringCourse: boolean }> = ({
  link,
  hasRegisteringCourse,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  const unlink = useToastMutation<void, unknown, void>(
    async () => {
      await unlinkMyStudentNumber()
    },
    { notify: true, method: "DELETE" },
    {
      onSuccess: async () => {
        // Unlinking moves unsent registrations back to waiting for a student number.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getMyVerifiedStudentNumberQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
        ])
      },
    },
  )

  const sisuName = [link.first_names, link.last_name].filter(Boolean).join(" ")
  const items = [
    {
      label: t("label-confirmed-on"),
      value: humanReadableDate(link.verified_at, i18n.language) ?? "",
    },
    {
      label: t("label-confirmed-by"),
      value: t(PROVENANCE_VALUE_KEYS[link.verified_via]),
    },
  ]

  return (
    <>
      <div className={sectionHeaderCss}>
        {sisuName ? (
          <>
            <p className={noteCss}>{t("label-name-in-university-records")}</p>
            <p className={subheadingCss}>{sisuName}</p>
          </>
        ) : null}
        <span className={studentNumberCss}>{link.student_number}</span>
      </div>
      <DescriptionList items={items} />
      {hasRegisteringCourse ? (
        <p>
          {t("student-number-credits-registered-under-this-number")}{" "}
          <Link href={profileStudiesRoute()}>{t("link-text-see-my-credits")}</Link>
        </p>
      ) : (
        <p>{t("student-number-no-registering-courses")}</p>
      )}
      <p>{t("student-number-check-the-name-is-yours")}</p>
      {link.linked_automatically && !link.auto_link_notice_dismissed && (
        <AutoLinkNotice link={link} onUnlink={() => setIsRemoveDialogOpen(true)} />
      )}
      <div className={dangerZoneCss}>
        <h3 className={subheadingCss}>{t("heading-wrong-number")}</h3>
        <div>
          <Button
            variant={BUTTON_TERTIARY}
            size="small"
            isLoading={unlink.isPending}
            onClick={() => setIsRemoveDialogOpen(true)}
          >
            {t("button-remove-student-number")}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={isRemoveDialogOpen}
        onClose={() => setIsRemoveDialogOpen(false)}
        title={t("confirm-remove-student-number-title")}
        description={t("confirm-remove-student-number-message")}
        confirmLabel={t("button-remove-student-number")}
        isDestructive
        onConfirm={async () => {
          await unlink.mutateAsync()
          setIsRemoveDialogOpen(false)
        }}
      />
    </>
  )
}

/**
 * The only way a student finds out we linked a number without asking them. It sits below the
 * provenance it asks them to judge, and its unlink button is the whole point, so dismissing must
 * not be the easier of the two to hit.
 */
const AutoLinkNotice: React.FC<{
  link: MyVerifiedStudentNumber
  onUnlink: () => void
}> = ({ link, onUnlink }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()

  const dismiss = useToastMutation<void, unknown, void>(
    async () => {
      await dismissMyAutoLinkNotice()
    },
    { notify: false },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getMyVerifiedStudentNumberQueryKey() })
      },
    },
  )

  return (
    <div data-testid="auto-link-notice">
      <Infobox tone={TONE.INFO}>
        <p>
          {t("student-number-linked-automatically-notice", {
            number: link.student_number,
            email: link.verified_via_email_masked ?? "",
          })}
        </p>
        <div className={rowCss}>
          <Button variant="secondary" size="medium" onClick={onUnlink}>
            {t("button-not-my-student-number-unlink")}
          </Button>
          <Button
            variant={BUTTON_TERTIARY}
            size="medium"
            isLoading={dismiss.isPending}
            onClick={() => dismiss.mutate()}
          >
            {t("button-dismiss-notice")}
          </Button>
        </div>
      </Infobox>
    </div>
  )
}

/**
 * No number linked: the steps that link one, and the two levers a student actually has.
 *
 * There is no student-facing resend, so the fast track is confirming the account's own address —
 * an address the University also holds links the number with no mail at all — and the fallback is
 * a mail to support that already asks for a new link.
 */
const NotLinked: React.FC<{ linkingEmail: LinkingEmailStatus | null }> = ({ linkingEmail }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const canConfirmEmail = useCanConfirmEmailAddress()
  const sent = sentLinkingEmail(linkingEmail)

  return (
    <>
      <div>
        <Badge tone={TONE.NEUTRAL}>{t("badge-student-number-not-linked")}</Badge>
      </div>
      <p>{t("student-number-not-linked")}</p>
      <ol className={stepsCss}>
        <li>
          {sent
            ? t("credit-registration-student-number-step-open-the-emailed-link", {
                email: sent.emailMasked,
                date: humanReadableDate(sent.sentAt, i18n.language),
              })
            : t("student-number-step-link-arrives-by-email")}
        </li>
        <li>{t("credit-registration-student-number-step-stay-logged-in")}</li>
      </ol>
      {sent ? null : <LinkingEmailLine linkingEmail={linkingEmail} />}
      {canConfirmEmail ? (
        <>
          <p>{t("student-number-confirming-your-address-can-link-it")}</p>
          <div>
            <Link href={userSettingsRoute()} styledAsButton variant="primary" size="medium">
              {t("button-confirm-your-email-address")}
            </Link>
          </div>
        </>
      ) : null}
    </>
  )
}

export interface StudentNumberSummaryLineProps {
  /**
   * Whether a registration already needs the student's attention, in the list above. It is then
   * said louder there, with its levers, so this line stays quiet rather than repeating it as a
   * footnote — including for a failure, which this line must never caption as nothing to do yet.
   */
  hasAttentionItems: boolean
}

/**
 * Which number this account's credits go to, for a page whose point is the registrations rather
 * than the number itself. The full card lives under user settings.
 */
const StudentNumberSummaryLineComponent: React.FC<StudentNumberSummaryLineProps> = ({
  hasAttentionItems,
}) => {
  const linkQuery = useQuery({ ...getMyVerifiedStudentNumberOptions() })

  return (
    <QueryResult
      query={linkQuery}
      treatNullAsEmpty
      minHeight={32}
      emptyFallback={hasAttentionItems ? null : <NotLinkedSummary />}
    >
      {(link) => (link ? <LinkedSummary studentNumber={link.student_number} /> : null)}
    </QueryResult>
  )
}

const LinkedSummary: React.FC<{ studentNumber: string }> = ({ studentNumber }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  // Not a flex row: that spreads the sentence's own text nodes apart and strands the full stop
  // behind a gap.
  return (
    <p>
      <Trans
        t={t}
        i18nKey="student-number-summary-linked"
        values={{ studentNumber }}
        components={{ number: <span className={monospaceCss} /> }}
      />{" "}
      <Link href={userSettingsStudentNumberRoute()}>{t("student-number-summary-change-link")}</Link>
    </p>
  )
}

const NotLinkedSummary: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <p className={noteCss}>
      {t("student-number-summary-not-linked")}{" "}
      <Link href={userSettingsStudentNumberRoute()}>
        {t("credit-registration-about-your-student-number")}
      </Link>
    </p>
  )
}

export const StudentNumberSummaryLine = withErrorBoundary(StudentNumberSummaryLineComponent)

export default withErrorBoundary(StudentNumberCard)
