"use client"

import type { TFunction } from "i18next"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  actorRoleLabel,
  adminActionLabel,
  adminActionTargetLabel,
  eventKindLabel,
  notificationKindLabel,
  sendStatusLabel,
  verificationMethodLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { useAdminCreditRegistration } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import AdminTransitionBlock from "@/components/credit-registration/admin/AdminTransitionBlock"
import SuotarApiCallDetail from "@/components/credit-registration/admin/SuotarApiCallDetail"
import {
  ABSENT,
  ALIGN_END,
  ARROW,
  MIDDLE_DOT,
  QUIET_REFRESH,
  STACKED,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import {
  registrationErrorHelp,
  registrationGradeLabel,
  registrationLedgerStateLabel,
} from "@/components/credit-registration/creditRegistrationCopy"
import {
  dividedListCss,
  emptyStateCss,
  headingCss,
  monospaceCss,
  noteCss,
  payloadCss,
  proseCss,
  rowCss,
  sectionCss,
  sectionsCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import type {
  AdminCreditRegistrationDetails,
  AdminCreditRegistrationEvent,
  AdminCreditRegistrationRow,
  AdminLinkingEmail,
  AdminNotificationEmail,
  AdminSuotarApiCall,
  CreditRegistrationAdminActionRecord,
} from "@/generated/api/types.generated"
import { creditRegistrationItemRoute, manageCourseRoute } from "@/shared-module/common/utils/routes"
import type { DescriptionListItem, TableColumn } from "@/shared-module/components"
import {
  Badge,
  Button,
  CopyButton,
  DescriptionList,
  Dialog,
  Disclosure,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

const JSON_INDENT = 2

const studentName = (row: AdminCreditRegistrationRow): string =>
  [row.first_name, row.last_name].filter(Boolean).join(" ")

/** Each id is copyable on its own: these get quoted into tickets and SQL consoles. */
const IdentifierList: React.FC<{ row: AdminCreditRegistrationRow }> = ({ row }) => {
  const { t } = useTranslation()
  const identifiers: { label: string; value: string | null | undefined }[] = [
    { label: t("label-credit-registration-registration"), value: row.id },
    { label: t("label-credit-registration-completion"), value: row.course_module_completion_id },
    { label: t("label-credit-registration-request-item-id"), value: row.request_item_id },
    { label: t("label-credit-registration-enrolment"), value: row.selected_enrolment_id },
    {
      label: t("credit-registration-admin-submitted-attainment-id"),
      value: row.submitted_attainment_id,
    },
    { label: t("credit-registration-admin-registry-attainment-id"), value: row.sisu_attainment_id },
    { label: t("label-user-id"), value: row.user_id },
    { label: t("label-course-module-id"), value: row.course_module_id },
  ]
  return (
    <Disclosure title={t("credit-registration-heading-identifiers")}>
      <DescriptionList
        layout={STACKED}
        items={identifiers
          .filter((identifier) => Boolean(identifier.value))
          .map((identifier) => ({
            label: identifier.label,
            value: (
              <span className={rowCss}>
                <span className={monospaceCss}>{identifier.value}</span>
                <CopyButton
                  value={identifier.value ?? ""}
                  label={t("credit-registration-admin-copy-identifier", {
                    label: identifier.label,
                  })}
                />
              </span>
            ),
          }))}
      />
    </Disclosure>
  )
}

const HeaderSection: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation()
  const row = details.registration
  const errorHelp = registrationErrorHelp(t, row.error_code)
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>
        {studentName(row)}
        {MIDDLE_DOT}
        {row.course_name}
      </h2>
      <div className={rowCss}>
        <AdminStateBadge
          state={row.state}
          pendingReason={row.pending_reason}
          superseded={row.superseded}
          attemptNumber={row.attempt_number}
        />
      </div>
      {errorHelp ? (
        <div className={subsectionCss}>
          <p className={proseCss}>{errorHelp}</p>
          {/* Untranslated on purpose: this is the code an operator quotes to the registry. */}
          <p className={noteCss}>
            <code>{row.error_code}</code>
          </p>
        </div>
      ) : (
        <p className={proseCss}>
          {t("credit-registration-admin-state-sentence", {
            state: registrationLedgerStateLabel(t, row.state),
          })}
        </p>
      )}
    </section>
  )
}

const FactsSection: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation()
  const row = details.registration
  const studentNumber = row.verified_student_number ?? row.student_number
  const verifiedVia = verificationMethodLabel(t, row.verified_student_number_via)
  // Next to the grade we sent, which is the comparison that explains a "no improvement" verdict.
  const heldGrade: DescriptionListItem[] = details.not_improved_attainment
    ? [
        {
          label: t("label-credit-registration-registry-held-grade"),
          value: registrationGradeLabel(
            t,
            details.not_improved_attainment.grade_id,
            details.not_improved_attainment.grade_scale_id,
          ),
        },
      ]
    : []

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-what-was-sent")}</h2>
      <StatTileList ariaLabel={t("credit-registration-heading-what-was-sent")}>
        <StatTile label={t("credit-registration-admin-submits")} value={row.submit_retry_count} />
        <StatTile
          label={t("credit-registration-admin-verify-checks")}
          value={row.verify_attempt_count}
        />
      </StatTileList>
      <DescriptionList
        layout={STACKED}
        items={[
          {
            label: t("label-student"),
            value: [studentName(row), row.email].filter(Boolean).join(MIDDLE_DOT),
          },
          {
            label: t("label-student-number"),
            value: studentNumber ? (
              <span className={rowCss}>
                <span className={monospaceCss}>{studentNumber}</span>
                {verifiedVia}
              </span>
            ) : (
              ABSENT
            ),
          },
          {
            label: t("label-course"),
            value: (
              <>
                <Link href={manageCourseRoute(row.course_id)}>{row.course_name}</Link>
                {row.course_module_name ? `${MIDDLE_DOT}${row.course_module_name}` : null}
                {row.uh_course_code ? (
                  <>
                    {MIDDLE_DOT}
                    <code>{row.uh_course_code}</code>
                  </>
                ) : null}
              </>
            ),
          },
          {
            label: t("label-credit-registration-grade"),
            value: [
              registrationGradeLabel(t, row.grade_id, row.grade_scale_id),
              row.credits === null || row.credits === undefined
                ? null
                : t("credit-registration-admin-credits", { credits: row.credits }),
            ]
              .filter(Boolean)
              .join(MIDDLE_DOT),
          },
          ...heldGrade,
          {
            label: t("label-credit-registration-completion"),
            value: <RelativeTime at={row.completion_date} />,
          },
          {
            label: t("label-credit-registration-time-in-state"),
            value: <RelativeTime at={row.state_entered_at} absoluteTime={TIME_IN_TITLE} />,
          },
          {
            label: t("label-credit-registration-next-attempt"),
            value: <RelativeTime at={row.next_attempt_at} absoluteTime={TIME_IN_TITLE} />,
          },
        ]}
      />
      <IdentifierList row={row} />
    </section>
  )
}

const AttemptChainSection: React.FC<{ attempts: AdminCreditRegistrationRow[] }> = ({
  attempts,
}) => {
  const { t } = useTranslation()
  if (attempts.length < 2) {
    return null
  }
  const chain = attempts.toSorted((a, b) => a.attempt_number - b.attempt_number)
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-attempt-chain")}</h2>
      <div className={rowCss}>
        {chain.map((attempt) => (
          <Link key={attempt.id} href={creditRegistrationItemRoute(attempt.id)}>
            {t("credit-registration-attempt-n", { n: attempt.attempt_number })}
            {MIDDLE_DOT}
            <code>{attempt.state}</code>
          </Link>
        ))}
      </div>
      <p className={noteCss}>{t("credit-registration-admin-attempt-chain-note")}</p>
    </section>
  )
}

const PayloadDialog: React.FC<{ title: string; payload: unknown }> = ({ title, payload }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const text = JSON.stringify(payload, null, JSON_INDENT)
  return (
    <>
      <Button variant="tertiary" size="small" onClick={() => setOpen(true)}>
        {t("credit-registration-admin-show-exchange")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="wide" title={title}>
        <p className={noteCss}>{t("credit-registration-admin-scrubbing-note")}</p>
        <pre className={payloadCss}>{text}</pre>
        <CopyButton value={text} label={t("credit-registration-admin-copy-stored-body")} />
      </Dialog>
    </>
  )
}

const TimelineEntry: React.FC<{ event: AdminCreditRegistrationEvent }> = ({ event }) => {
  const { t } = useTranslation()
  return (
    <li className={subsectionCss}>
      <span className={rowCss}>
        <RelativeTime at={event.created_at} />
        <Badge tone={TONE.NEUTRAL}>{eventKindLabel(t, event.kind)}</Badge>
        {event.to_state && (
          <code>{[event.from_state, event.to_state].filter(Boolean).join(ARROW)}</code>
        )}
        {event.error_code && <code>{event.error_code}</code>}
      </span>
      {event.message && <span>{event.message}</span>}
      {event.details !== null && event.details !== undefined && (
        <span>
          <PayloadDialog
            title={t("credit-registration-heading-exchange", {
              kind: eventKindLabel(t, event.kind),
            })}
            payload={event.details}
          />
        </span>
      )}
    </li>
  )
}

const TimelineSection: React.FC<{ events: AdminCreditRegistrationEvent[] }> = ({ events }) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-timeline")}</h2>
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role */}
      <ol className={dividedListCss} role="list">
        {events.toReversed().map((event) => (
          <TimelineEntry key={event.id} event={event} />
        ))}
      </ol>
    </section>
  )
}

const ApiCallSection: React.FC<{ calls: AdminSuotarApiCall[] }> = ({ calls }) => {
  const { t } = useTranslation()
  if (calls.length === 0) {
    return null
  }
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-api-calls")}</h2>
      <Table
        caption={t("credit-registration-heading-api-calls")}
        rowKey={(call) => call.id}
        rows={calls}
        columns={[
          {
            header: t("label-time"),
            cell: (call) => <RelativeTime at={call.started_at} absoluteTime={TIME_IN_TITLE} />,
          },
          { header: t("label-endpoint"), cell: (call) => <code>{call.endpoint}</code> },
          {
            header: t("label-credit-registration-http-status"),
            align: ALIGN_END,
            cell: (call) => call.http_status ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-column-items"),
            cell: (call) =>
              t("credit-registration-admin-ok-error-items", {
                ok: call.ok_item_count,
                error: call.error_item_count,
                total: call.request_item_count,
              }),
          },
          {
            header: t("label-actions"),
            cell: (call) => <SuotarApiCallDetail suotarApiCallId={call.id} />,
          },
        ]}
      />
    </section>
  )
}

/** Every mail table shares a send-status and retries column; only the surrounding columns differ. */
const sendStatusColumns = <T extends { send_status: AdminLinkingEmail["send_status"] }>(
  t: TFunction,
): [TableColumn<T>, TableColumn<T>] => [
  {
    header: t("credit-registration-admin-send-status-header"),
    cell: (mail) =>
      [sendStatusLabel(t, mail.send_status.email_send_status), mail.send_status.failure_code]
        .filter(Boolean)
        .join(MIDDLE_DOT),
  },
  {
    header: t("label-credit-registration-retries"),
    align: ALIGN_END,
    cell: (mail) => mail.send_status.retry_count,
  },
]

const LinkingSection: React.FC<{ mails: AdminLinkingEmail[] }> = ({ mails }) => {
  const { t } = useTranslation()
  const [sendStatusColumn, retriesColumn] = sendStatusColumns<AdminLinkingEmail>(t)
  if (mails.length === 0) {
    return null
  }
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-linking-emails")}</h2>
      <Table
        caption={t("credit-registration-heading-linking-emails")}
        rowKey={(mail) => mail.id}
        rows={mails}
        columns={[
          { header: t("label-email"), cell: (mail) => mail.emailed_to },
          sendStatusColumn,
          {
            header: t("label-credit-registration-handed-over"),
            cell: (mail) => (
              <RelativeTime at={mail.send_status.sent_at} absoluteTime={TIME_IN_TITLE} />
            ),
          },
          retriesColumn,
          {
            header: t("label-credit-registration-token-claimed"),
            cell: (mail) =>
              mail.token_used_at ? (
                <RelativeTime at={mail.token_used_at} absoluteTime={TIME_IN_TITLE} />
              ) : (
                <Badge tone={TONE.NEUTRAL}>{t("credit-registration-admin-token-unclaimed")}</Badge>
              ),
          },
        ]}
      />
    </section>
  )
}

const NotificationSection: React.FC<{ mails: AdminNotificationEmail[] }> = ({ mails }) => {
  const { t } = useTranslation()
  const [sendStatusColumn, retriesColumn] = sendStatusColumns<AdminNotificationEmail>(t)
  if (mails.length === 0) {
    return null
  }
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-notification-emails")}</h2>
      <Table
        caption={t("credit-registration-heading-notification-emails")}
        rowKey={(mail) => mail.kind}
        rows={mails}
        columns={[
          { header: t("label-kind"), cell: (mail) => notificationKindLabel(t, mail.kind) },
          sendStatusColumn,
          {
            header: t("label-credit-registration-handed-over"),
            cell: (mail) => (
              <RelativeTime at={mail.send_status.sent_at} absoluteTime={TIME_IN_TITLE} />
            ),
          },
          retriesColumn,
        ]}
      />
    </section>
  )
}

const AuditSection: React.FC<{ actions: CreditRegistrationAdminActionRecord[] }> = ({
  actions,
}) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-audit")}</h2>
      {actions.length === 0 ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-actions-yet")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-audit")}
          rowKey={(action) => action.id}
          rows={actions}
          columns={[
            {
              header: t("label-time"),
              cell: (action) => (
                <RelativeTime at={action.created_at} absoluteTime={TIME_IN_TITLE} />
              ),
            },
            {
              header: t("credit-registration-admin-column-action"),
              cell: (action) => adminActionLabel(t, action.action),
            },
            {
              header: t("credit-registration-admin-column-target"),
              cell: (action) => adminActionTargetLabel(t, action.target_kind),
            },
            {
              header: t("label-role"),
              cell: (action) => actorRoleLabel(t, action.actor_role),
            },
            { header: t("label-reason"), cell: (action) => action.reason },
          ]}
        />
      )}
    </section>
  )
}

/** One ledger row end to end: what it is, what an admin can do to it, and everything it has done. */
const RegistrationDetailPage: React.FC = () => {
  const params = useParams<{ registrationId: string }>()
  const detailsQuery = useAdminCreditRegistration(params.registrationId)

  return (
    <QueryResult query={detailsQuery} refreshIndicator={QUIET_REFRESH}>
      {(details) => (
        <div className={sectionsCss}>
          <HeaderSection details={details} />
          <FactsSection details={details} />
          <section className={sectionCss}>
            <AdminTransitionBlock registration={details.registration} />
          </section>
          <AttemptChainSection attempts={details.attempts} />
          <TimelineSection events={details.events} />
          <ApiCallSection calls={details.suotar_api_calls} />
          <LinkingSection mails={details.linking_emails} />
          <NotificationSection mails={details.notification_emails} />
          <AuditSection actions={details.actions} />
        </div>
      )}
    </QueryResult>
  )
}

export default RegistrationDetailPage
