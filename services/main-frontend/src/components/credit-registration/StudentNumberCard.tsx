"use client"

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
  Disclosure,
  Infobox,
  Link,
  QueryResult,
} from "@/shared-module/components"

import { TONE } from "./constants"
import { LinkingEmailLine } from "./EmailStatusLine"
import { headingCss, rowCss, sectionCss, studentNumberCss } from "./styles"

/** A student disputing a wrong number needs to know how the link was proved. */
const PROVENANCE_KEYS = {
  emailed_link: "student-number-verified-via-emailed-link",
  email_match_fast_track: "student-number-verified-via-email-match",
  admin_manual: "student-number-verified-via-admin-manual",
} as const satisfies Record<StudentNumberVerificationMethod, string>

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
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("heading-student-number")}</h2>
      <QueryResult
        query={linkQuery}
        treatNullAsEmpty
        emptyFallback={<NotLinked linkingEmail={linkingEmail} />}
      >
        {(link) => (link ? <Linked link={link} /> : null)}
      </QueryResult>
    </section>
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
      <div className={rowCss}>
        <span className={studentNumberCss}>{link.student_number}</span>
        <Badge tone={TONE.SUCCESS}>{t("badge-student-number-linked")}</Badge>
      </div>
      <p>{t("student-number-credits-registered-under-this-number")}</p>
      <DescriptionList items={items} />
      {link.linked_automatically && !link.auto_link_notice_dismissed && (
        <AutoLinkNotice link={link} onUnlink={askAndUnlink} unlinkPending={unlink.isPending} />
      )}
      {/* A grid child otherwise stretches the button's own box to the section's full width. */}
      <div>
        <Button
          variant="secondary"
          size="medium"
          isLoading={unlink.isPending}
          onClick={askAndUnlink}
        >
          {t("button-remove-student-number")}
        </Button>
      </div>
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
        <div className={rowCss}>
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
      <div>
        <Badge tone={TONE.NEUTRAL}>{t("badge-student-number-not-linked")}</Badge>
      </div>
      <p>{t("student-number-not-linked")}</p>
      <p>{t("student-number-how-the-link-arrives")}</p>
      <LinkingEmailLine linkingEmail={linkingEmail} />
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
      <Disclosure title={t("student-number-cannot-reach-that-mailbox-disclosure-title")}>
        <p>{t("student-number-cannot-reach-that-mailbox")}</p>
      </Disclosure>
    </>
  )
}

export default withErrorBoundary(StudentNumberCard)
