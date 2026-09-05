"use client"

import { css } from "@emotion/css"
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
  stateName,
  verificationMethodLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { useAdminCreditRegistration } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import AdminTransitionBlock from "@/components/credit-registration/admin/AdminTransitionBlock"
import SuotarApiCallDetail from "@/components/credit-registration/admin/SuotarApiCallDetail"
import {
  ALIGN_END,
  MIDDLE_DOT,
  QUIET_REFRESH,
  STACKED,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import {
  registrationErrorHelp,
  registrationGradeLabel,
} from "@/components/credit-registration/creditRegistrationCopy"
import {
  cardCss,
  headingCss,
  monospaceCss,
  noteCss,
  rowCss,
  sectionCss,
  sectionsCss,
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
  Infobox,
  QueryResult,
  RelativeTime,
  RELATIVE_TIME_ABSENT_LABEL,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const ARROW = " → "
const JSON_INDENT = 2

const titleCss = css`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
`

const sentenceCss = css`
  margin: 0;
`

const bodyCss = css`
  font-size: 0.8125rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-100);
  border-radius: 6px;
  padding: 0.6rem;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
`

const identifierRowCss = css`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`

const timelineCss = css`
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

const entryCss = css`
  display: grid;
  gap: 0.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-clear-300);
`

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
              <span className={identifierRowCss}>
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
      <div className={cardCss}>
        <h2 className={titleCss}>
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
          {row.needs_admin_attention && (
            <Badge tone={TONE.WARNING}>{t("label-credit-registration-needs-attention")}</Badge>
          )}
        </div>
        {errorHelp ? (
          <Infobox tone={TONE.WARNING} heading={row.error_code}>
            {errorHelp}
          </Infobox>
        ) : (
          <p className={sentenceCss}>
            {t("credit-registration-admin-state-sentence", { state: stateName(row.state) })}
          </p>
        )}
        <AdminTransitionBlock registration={row} />
      </div>
    </section>
  )
}

const FactsSection: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation()
  const row = details.registration
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
        <StatTile
          label={t("label-credit-registration-time-in-state")}
          value={<RelativeTime at={row.state_entered_at} absoluteTime={TIME_IN_TITLE} />}
        />
        <StatTile
          label={t("label-credit-registration-next-attempt")}
          value={<RelativeTime at={row.next_attempt_at} absoluteTime={TIME_IN_TITLE} />}
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
            value: [
              row.verified_student_number ?? row.student_number,
              verificationMethodLabel(t, row.verified_student_number_via),
            ]
              .filter(Boolean)
              .join(MIDDLE_DOT),
          },
          {
            label: t("label-course"),
            value: (
              <>
                <Link href={manageCourseRoute(row.course_id)}>{row.course_name}</Link>
                {MIDDLE_DOT}
                {row.course_module_name ?? RELATIVE_TIME_ABSENT_LABEL}
                {MIDDLE_DOT}
                {row.uh_course_code ?? RELATIVE_TIME_ABSENT_LABEL}
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
            <AdminStateBadge
              state={attempt.state}
              pendingReason={attempt.pending_reason}
              superseded={attempt.superseded}
              attemptNumber={attempt.attempt_number}
            />
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
        <pre className={bodyCss}>{text}</pre>
        <CopyButton value={text} label={t("credit-registration-admin-copy-stored-body")} />
      </Dialog>
    </>
  )
}

const TimelineEntry: React.FC<{ event: AdminCreditRegistrationEvent }> = ({ event }) => {
  const { t } = useTranslation()
  return (
    <li className={entryCss}>
      <span className={rowCss}>
        <RelativeTime at={event.created_at} />
        <Badge tone={TONE.NEUTRAL}>{eventKindLabel(t, event.kind)}</Badge>
        {event.to_state && (
          <span className={rowCss}>
            {event.from_state && (
              <>
                <AdminStateBadge state={event.from_state} />
                {ARROW}
              </>
            )}
            <AdminStateBadge state={event.to_state} />
          </span>
        )}
        {event.error_code && <span className={monospaceCss}>{event.error_code}</span>}
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
      <p className={noteCss}>{t("credit-registration-admin-scrubbing-note")}</p>
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role */}
      <ol className={timelineCss} role="list">
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
            cell: (call) => call.http_status ?? RELATIVE_TIME_ABSENT_LABEL,
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
        <p className={noteCss}>{t("credit-registration-admin-no-actions-yet")}</p>
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
