"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCreditRegistrationDetailsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { monospaceFont } from "@/shared-module/common/styles"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"
import { Badge, DescriptionList, Dialog, QueryResult } from "@/shared-module/components"

import ResendLinkingEmailBlock from "./admin/ResendLinkingEmailBlock"
import { STACKED } from "./constants"
import {
  registrationErrorHelp,
  registrationExplanation,
  registrationGradeLabel,
  registrationStatusLabel,
} from "./creditRegistrationCopy"
import RetryCreditRegistrationBlock from "./RetryCreditRegistrationBlock"
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

const timelineCss = css`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

const timelineRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.875rem;
`

const timestampCss = css`
  color: var(--color-gray-500);
  font-variant-numeric: tabular-nums;
`

const ledgerStateCss = css`
  font-family: ${monospaceFont};
  color: var(--color-gray-600);
`

const sectionHeadingCss = css`
  font-weight: 500;
  margin: 1.5rem 0 0.5rem;
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
            <div className={sectionHeadingCss}>{t("heading-credit-registration-timeline")}</div>
            <ul className={timelineCss}>
              {details.events.map((event) => (
                <li className={timelineRowCss} key={event.id}>
                  <span className={timestampCss}>
                    {humanReadableDateTime(event.created_at, i18n.language)}
                  </span>
                  {/* Deliberately untranslated: this is what a teacher quotes to support. */}
                  <span className={ledgerStateCss}>{event.to_state ?? event.kind}</span>
                  {event.message && <span>{event.message}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </QueryResult>
    </Dialog>
  )
}

export default CreditRegistrationDetailsDialog
