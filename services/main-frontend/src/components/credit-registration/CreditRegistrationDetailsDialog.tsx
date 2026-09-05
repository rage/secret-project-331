"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCreditRegistrationDetailsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import {
  Badge,
  DescriptionList,
  Dialog,
  QueryResult,
  RelativeTime,
  Table,
} from "@/shared-module/components"

import { eventKindLabel } from "./admin/adminCreditRegistrationCopy"
import ResendLinkingEmailBlock from "./admin/ResendLinkingEmailBlock"
import { STACKED, TIME_IN_TITLE } from "./constants"
import {
  registrationErrorHelp,
  registrationExplanation,
  registrationGradeLabel,
  registrationLedgerStateLabel,
  registrationStatusLabel,
} from "./creditRegistrationCopy"
import RetryCreditRegistrationBlock from "./RetryCreditRegistrationBlock"
import { headingCss, monospaceCss, noteCss, stackedCellCss } from "./styles"
import {
  isAdminEstablishedLink,
  linkingEmailSentence,
  notificationEmailLabel,
  notificationEmailSentence,
  studentNumberVerificationLabel,
} from "./teacherCreditRegistrations"

interface Props {
  registration: CourseCreditRegistration
  open: boolean
  onClose: () => void
}

const timelineSectionCss = css`
  margin-top: 1.5rem;
`

// A support-established link rests on judgement, so it is toned apart from a confirmed one.
// oxlint-disable-next-line i18next/no-literal-string
const SUPPORT_LINK_TONE = "warning" as const
// oxlint-disable-next-line i18next/no-literal-string
const CONFIRMED_LINK_TONE = "neutral" as const
// The one stage where a resend can help: nothing moves until a student number is linked.
// oxlint-disable-next-line i18next/no-literal-string
const WAITING_FOR_STUDENT_NUMBER = "needs_student_number" as const

const CreditRegistrationDetailsDialog: React.FC<Props> = ({ registration, open, onClose }) => {
  const { t, i18n } = useTranslation()
  const detailsQuery = useQuery({
    ...getCreditRegistrationDetailsOptions({
      path: { credit_registration_id: registration.id },
    }),
    enabled: open,
  })

  const errorHelp = registrationErrorHelp(t, registration.error_code)
  const verificationLabel = studentNumberVerificationLabel(
    t,
    registration.student_number_verified_via,
  )
  const items = [
    {
      label: t("label-status"),
      value: registrationStatusLabel(t, registration.student_facing_status),
    },
    {
      label: t("label-explanation"),
      value: registrationExplanation(t, registration.student_facing_status),
    },
    {
      label: t("label-verified-student-number"),
      value: registration.student_number ? (
        <span
          className={css`
            display: inline-flex;
            gap: 0.5rem;
            align-items: center;
            flex-wrap: wrap;
          `}
        >
          <span>{registration.student_number}</span>
          {verificationLabel && (
            <Badge
              tone={
                isAdminEstablishedLink(registration.student_number_verified_via)
                  ? SUPPORT_LINK_TONE
                  : CONFIRMED_LINK_TONE
              }
            >
              {verificationLabel}
            </Badge>
          )}
        </span>
      ) : (
        t("credit-registration-no-student-number-linked")
      ),
    },
  ]
  if (errorHelp) {
    items.push({ label: t("label-reason"), value: errorHelp })
  }
  if (registration.enrolment_realisation_name) {
    items.push({
      label: t("label-credit-registration-realisation"),
      value: registration.enrolment_realisation_name,
    })
  }
  if (registration.sisu_attainment_id) {
    items.push({
      label: t("label-attainment-id"),
      value: registration.sisu_attainment_id,
    })
  }
  if (registration.linking_email) {
    items.push({
      label: t("label-credit-registration-linking-email"),
      value: linkingEmailSentence(
        t,
        registration.linking_email.email_send_status,
        registration.linking_email.sent_at,
        registration.linking_email.emailed_to_masked,
        i18n.language,
      ),
    })
  }

  if (registration.notification_email) {
    items.push({
      label: notificationEmailLabel(t, registration.notification_email.kind),
      value: notificationEmailSentence(t, registration.notification_email, i18n.language),
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("heading-credit-registration-details")}
      size="wide"
    >
      <DescriptionList items={items} layout={STACKED} />
      {registration.student_facing_status === WAITING_FOR_STUDENT_NUMBER && (
        <ResendLinkingEmailBlock registration={registration} />
      )}
      <RetryCreditRegistrationBlock registration={registration} />
      <QueryResult query={detailsQuery}>
        {(details) => (
          <>
            {/* The grade already in the registry, which is why a better one was turned down. */}
            {details.not_improved_attainment ? (
              <DescriptionList
                layout={STACKED}
                items={[
                  {
                    label: t("label-credit-registration-registry-held-grade"),
                    value: registrationGradeLabel(
                      t,
                      details.not_improved_attainment.grade_id,
                      details.not_improved_attainment.grade_scale_id,
                    ),
                  },
                ]}
              />
            ) : null}
            <div className={timelineSectionCss}>
              <h3 className={headingCss}>{t("heading-credit-registration-timeline")}</h3>
              <Table
                caption={t("heading-credit-registration-timeline")}
                rowKey={(event) => event.id}
                rows={details.events}
                columns={[
                  {
                    header: t("label-when"),
                    cell: (event) => (
                      <RelativeTime at={event.created_at} absoluteTime={TIME_IN_TITLE} />
                    ),
                  },
                  {
                    header: t("label-what-happened"),
                    cell: (event) => (
                      <span className={stackedCellCss}>
                        <span>
                          {event.to_state
                            ? registrationLedgerStateLabel(t, event.to_state)
                            : eventKindLabel(t, event.kind)}
                        </span>
                        {/* Untranslated on purpose: this is what a teacher quotes to support. */}
                        <span className={cx(noteCss, monospaceCss)}>
                          {event.to_state ?? event.kind}
                        </span>
                      </span>
                    ),
                  },
                  { header: t("label-details"), cell: (event) => event.message ?? "" },
                ]}
              />
            </div>
          </>
        )}
      </QueryResult>
    </Dialog>
  )
}

export default CreditRegistrationDetailsDialog
