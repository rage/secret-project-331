"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getMyCreditRegistrationsOptions,
  getMyCreditRegistrationsQueryKey,
  getMyEmailVerificationStatusOptions,
  getMyVerifiedStudentNumberOptions,
  getMyVerifiedStudentNumberQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { dismissMyAutoLinkNotice, unlinkMyStudentNumber } from "@/generated/api/sdk.generated"
import type {
  LinkingEmailStatus,
  MyVerifiedStudentNumber,
  StudentNumberVerificationMethod,
} from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { userSettingsRoute } from "@/shared-module/common/utils/routes"
import { humanReadableDate } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Badge,
  Button,
  DescriptionList,
  Infobox,
  Link,
  QueryResult,
} from "@/shared-module/components"

import { TONE } from "./constants"
import { LinkingEmailLine } from "./EmailStatusLine"
import SectionCard from "./SectionCard"

/** A student disputing a wrong number needs to know how the link was proved. */
const PROVENANCE_KEYS = {
  emailed_link: "student-number-verified-via-emailed-link",
  email_match_fast_track: "student-number-verified-via-email-match",
  admin_manual: "student-number-verified-via-admin-manual",
} as const satisfies Record<StudentNumberVerificationMethod, string>

const numberRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`

const studentNumberCss = css`
  font-size: var(--font-size-4);
  font-weight: 700;
  color: var(--color-gray-700);
  font-variant-numeric: tabular-nums;
`

const noticeActionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`

const StudentNumberCard: React.FC = () => {
  const { t } = useTranslation()
  const linkQuery = useQuery({ ...getMyVerifiedStudentNumberOptions() })
  const registrationsQuery = useQuery({ ...getMyCreditRegistrationsOptions() })

  const linkingEmail =
    registrationsQuery.data?.find(
      (registration) =>
        registration.student_facing_status === "needs_student_number" && registration.linking_email,
    )?.linking_email ?? null

  return (
    <SectionCard title={t("heading-student-number")}>
      <QueryResult
        query={linkQuery}
        treatNullAsEmpty
        emptyFallback={<NotLinked linkingEmail={linkingEmail} />}
      >
        {(link) => (link ? <Linked link={link} /> : null)}
      </QueryResult>
    </SectionCard>
  )
}

const Linked: React.FC<{ link: MyVerifiedStudentNumber }> = ({ link }) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()

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

  const askAndUnlink = async () => {
    const confirmed = await confirm(
      t("confirm-remove-student-number-message"),
      t("confirm-remove-student-number-title"),
    )
    if (confirmed) {
      unlink.mutate()
    }
  }

  const sisuName = [link.first_names, link.last_name].filter(Boolean).join(" ")
  const items = [
    ...(sisuName ? [{ label: t("label-name-in-university-records"), value: sisuName }] : []),
    {
      label: t("label-confirmed-at"),
      value: humanReadableDate(link.verified_at, i18n.language) ?? "",
    },
    {
      label: t("label-how-it-was-confirmed"),
      value: t(PROVENANCE_KEYS[link.verified_via], {
        email: link.verified_via_email_masked ?? "",
      }),
    },
  ]

  return (
    <>
      <div className={numberRowCss}>
        <span className={studentNumberCss}>{link.student_number}</span>
        <Badge tone={TONE.SUCCESS}>{t("badge-student-number-linked")}</Badge>
      </div>
      <p>{t("student-number-credits-registered-under-this-number")}</p>
      <DescriptionList items={items} />
      {link.linked_automatically && !link.auto_link_notice_dismissed && (
        <AutoLinkNotice link={link} onUnlink={askAndUnlink} unlinkPending={unlink.isPending} />
      )}
      <Button variant="secondary" size="medium" isLoading={unlink.isPending} onClick={askAndUnlink}>
        {t("button-remove-student-number")}
      </Button>
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
  onUnlink: () => void | Promise<void>
  unlinkPending: boolean
}> = ({ link, onUnlink, unlinkPending }) => {
  const { t } = useTranslation()
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
        <div className={noticeActionsCss}>
          <Button variant="secondary" size="medium" isLoading={unlinkPending} onClick={onUnlink}>
            {t("button-not-my-student-number-unlink")}
          </Button>
          <Button
            variant="tertiary"
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
 * There is no student-facing resend, so the one action this state can offer is confirming the
 * account's own address: an address the University also holds links the number with no mail at all.
 */
const NotLinked: React.FC<{ linkingEmail: LinkingEmailStatus | null }> = ({ linkingEmail }) => {
  const { t } = useTranslation()
  const emailStatus = useQuery({ ...getMyEmailVerificationStatusOptions() }).data
  const canConfirmEmail =
    emailStatus?.verification_enabled === true &&
    emailStatus.template_configured &&
    !emailStatus.email_verified_at

  return (
    <>
      <p>{t("student-number-not-linked")}</p>
      <p>{t("student-number-how-the-link-arrives")}</p>
      <LinkingEmailLine linkingEmail={linkingEmail} />
      {canConfirmEmail ? (
        <>
          <p>{t("student-number-confirming-your-address-can-link-it")}</p>
          <Link href={userSettingsRoute()} styledAsButton variant="primary" size="medium">
            {t("button-confirm-your-email-address")}
          </Link>
        </>
      ) : null}
      <p>{t("student-number-cannot-reach-that-mailbox")}</p>
    </>
  )
}

export default withErrorBoundary(StudentNumberCard)
