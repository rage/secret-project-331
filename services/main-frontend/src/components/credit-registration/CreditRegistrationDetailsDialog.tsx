"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCreditRegistrationDetailsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import {
  Badge,
  CopyButton,
  DescriptionList,
  Dialog,
  Disclosure,
  QueryResult,
  RegistrationStatusHeadline,
  RelativeTime,
  Table,
} from "@/shared-module/components"

import { eventKindLabel } from "./admin/adminCreditRegistrationCopy"
import ResendLinkingEmailBlock from "./admin/ResendLinkingEmailBlock"
import {
  CREDIT_REGISTRATION_NS,
  MIDDLE_DOT,
  PLAIN_DISCLOSURE,
  STACKED,
  TIME_COMPACT,
  TONE,
} from "./constants"
import {
  registrationErrorTeacherHelp,
  registrationGradeLabel,
  registrationLedgerStateLabel,
  registrationStatusState,
  registrationStatusTeacherLabel,
  registrationTeacherExplanation,
} from "./creditRegistrationCopy"
import RetryCreditRegistrationBlock from "./RetryCreditRegistrationBlock"
import {
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionsCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "./styles"
import {
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

// The one stage where a resend can help: nothing moves until a student number is linked.
const WAITING_FOR_STUDENT_NUMBER = "needs_student_number" as const

const leadCss = css`
  display: grid;
  gap: var(--space-2);
`

// Keeps the reference and its copy button on one line, truncating the id rather than wrapping the
// button away from what it copies; the full value is still reachable in `title`.
const supportReferenceRowCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
`

const supportReferenceValueCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CreditRegistrationDetailsDialog: React.FC<Props> = ({ registration, open, onClose }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const detailsQuery = useQuery({
    ...getCreditRegistrationDetailsOptions({
      path: { credit_registration_id: registration.id },
    }),
    enabled: open,
  })

  const studentName = formatUserName(registration) || t("missing-name")
  const moduleName = registration.course_module_name ?? t("default-module")
  // Why this row is where it is: the failure when there is one, otherwise what the stage means.
  const leadSentence =
    registrationErrorTeacherHelp(t, registration.error_code) ??
    registrationTeacherExplanation(t, registration.student_facing_status)
  const verificationLabel = studentNumberVerificationLabel(
    t,
    registration.student_number_verified_via,
  )
  const items = [
    {
      label: t("label-verified-student-number"),
      value: registration.student_number ? (
        <span className={rowCss}>
          <span className={monospaceCss}>{registration.student_number}</span>
          {verificationLabel && <Badge tone={TONE.NEUTRAL}>{verificationLabel}</Badge>}
        </span>
      ) : (
        t("credit-registration-no-student-number-linked")
      ),
    },
  ]
  if (registration.enrolment_realisation_name) {
    items.push({
      label: t("label-credit-registration-sisu-course-instance"),
      value: registration.enrolment_realisation_name,
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

  // The untranslated identifiers support asks for, in one copyable string rather than on every row.
  const supportReference = [
    registration.id,
    registration.state,
    registration.error_code,
    registration.sisu_attainment_id,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <Dialog open={open} onClose={onClose} title={`${studentName}${MIDDLE_DOT}${moduleName}`}>
      <div className={sectionsCss}>
        <div className={leadCss}>
          <RegistrationStatusHeadline
            state={registrationStatusState(registration.student_facing_status)}
          >
            {registrationStatusTeacherLabel(t, registration.student_facing_status)}
          </RegistrationStatusHeadline>
          <p className={proseCss}>{leadSentence}</p>
        </div>
        <DescriptionList items={items} layout={STACKED} />
        {registration.student_facing_status === WAITING_FOR_STUDENT_NUMBER && (
          <ResendLinkingEmailBlock registration={registration} />
        )}
        <RetryCreditRegistrationBlock registration={registration} />
        <QueryResult query={detailsQuery}>
          {(details) => (
            <>
              {/* The grade already in Sisu, which is why a better one was turned down. */}
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
              <div className={subsectionCss}>
                <h3 className={subheadingCss}>{t("credit-registration-heading-timeline")}</h3>
                <Table
                  caption={t("credit-registration-heading-timeline")}
                  rowKey={(event) => event.id}
                  rows={details.events}
                  columns={[
                    {
                      header: t("label-when"),
                      nowrap: true,
                      cell: (event) => (
                        <RelativeTime at={event.created_at} absoluteTime={TIME_COMPACT} />
                      ),
                    },
                    {
                      header: t("label-event"),
                      grow: true,
                      cell: (event) => {
                        const name = event.to_state
                          ? registrationLedgerStateLabel(t, event.to_state)
                          : eventKindLabel(t, event.kind)
                        return (
                          <span className={stackedCellCss}>
                            <span>{name}</span>
                            {event.message && <span className={noteCss}>{event.message}</span>}
                          </span>
                        )
                      },
                    },
                  ]}
                />
              </div>
            </>
          )}
        </QueryResult>
        <Disclosure variant={PLAIN_DISCLOSURE} title={t("credit-registration-heading-for-support")}>
          <div className={supportReferenceRowCss}>
            <span className={cx(monospaceCss, supportReferenceValueCss)} title={supportReference}>
              {supportReference}
            </span>
            <CopyButton
              value={supportReference}
              label={t("button-text-copy-credit-registration-support-reference")}
            >
              {t("button-text-copy")}
            </CopyButton>
          </div>
        </Disclosure>
      </div>
    </Dialog>
  )
}

export default CreditRegistrationDetailsDialog
