"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  sendStatusLabel,
  verificationMethodLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { useAdminCreditRegistration } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import AdminTransitionBlock from "@/components/credit-registration/admin/AdminTransitionBlock"
import RelativeTime from "@/components/credit-registration/admin/RelativeTime"
import { registrationErrorHelp } from "@/components/credit-registration/creditRegistrationCopy"
import type {
  AdminCreditRegistrationDetails,
  AdminCreditRegistrationRow,
  AdminLinkingEmail,
  AdminSuotarApiCall,
  CreditRegistrationAdminActionRecord,
} from "@/generated/api/types.generated"
import { creditRegistrationItemRoute, manageCourseRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  DescriptionList,
  Disclosure,
  Infobox,
  QueryResult,
  Table,
} from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const NEUTRAL_BADGE = "neutral" as const
// oxlint-disable-next-line i18next/no-literal-string
const WARNING_BADGE = "warning" as const
// oxlint-disable-next-line i18next/no-literal-string
const INFO_TONE = "info" as const
// oxlint-disable-next-line i18next/no-literal-string
const STACKED = "stacked" as const
const ABSENT = "-"
/** Separators between identifiers on one line. Not prose, so not translated. */
// oxlint-disable-next-line i18next/no-literal-string
const DOT = " · "
// oxlint-disable-next-line i18next/no-literal-string
const ARROW = " → "
// oxlint-disable-next-line i18next/no-literal-string
const SLASH = " / "
const JSON_INDENT = 2

const sectionsCss = css`
  display: grid;
  gap: 2rem;
`

const sectionCss = css`
  display: grid;
  gap: 0.75rem;
`

const headingCss = css`
  font-weight: 500;
  margin: 0;
`

const headerRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
`

const noteCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
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
  max-height: 24rem;
  overflow: auto;
`

const attemptChainCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`

const HeaderSection: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation()
  const row = details.registration
  return (
    <section className={sectionCss}>
      <div className={headerRowCss}>
        <AdminStateBadge
          state={row.state}
          superseded={row.superseded}
          attemptNumber={row.attempt_number}
        />
        {row.needs_admin_attention && (
          <Badge tone={WARNING_BADGE}>{t("label-credit-registration-needs-attention")}</Badge>
        )}
        {details.consent_given === false && (
          <Badge tone={WARNING_BADGE}>{t("credit-registration-admin-no-consent")}</Badge>
        )}
      </div>
      {row.error_code && (
        <Infobox tone={INFO_TONE} heading={<code>{row.error_code}</code>}>
          {registrationErrorHelp(t, row.error_code)}
        </Infobox>
      )}
      <DescriptionList
        layout={STACKED}
        items={[
          {
            label: t("label-student"),
            value: [row.first_name, row.last_name, row.email].filter(Boolean).join(DOT),
          },
          {
            label: t("label-student-number"),
            value: [
              row.verified_student_number ?? row.student_number,
              verificationMethodLabel(t, row.verified_student_number_via),
            ]
              .filter(Boolean)
              .join(DOT),
          },
          {
            label: t("label-course"),
            value: (
              <>
                <Link href={manageCourseRoute(row.course_id)}>{row.course_name}</Link>
                {DOT}
                {row.course_module_name ?? ABSENT}
                {DOT}
                <code>{row.uh_course_code ?? ABSENT}</code>
              </>
            ),
          },
          {
            label: t("label-credit-registration-completion"),
            value: (
              <>
                <code>{row.course_module_completion_id}</code>
                {DOT}
                <RelativeTime at={row.completion_date} />
              </>
            ),
          },
          {
            label: t("label-credit-registration-grade"),
            value:
              [row.grade_scale_id ?? ABSENT, row.grade_id ?? ABSENT].join(SLASH) +
              DOT +
              (row.credits ?? ABSENT),
          },
          {
            label: t("label-credit-registration-enrolment"),
            value: <code>{row.selected_enrolment_id ?? ABSENT}</code>,
          },
          {
            label: t("label-credit-registration-request-item-id"),
            value: <code>{row.request_item_id}</code>,
          },
          {
            label: t("label-credit-registration-attainment-ids"),
            value: (
              <>
                <code>{row.submitted_attainment_id ?? ABSENT}</code>
                {ARROW}
                <code>{row.sisu_attainment_id ?? ABSENT}</code>
              </>
            ),
          },
          {
            label: t("label-credit-registration-attempts"),
            value: t("credit-registration-admin-submit-verify-attempts", {
              submits: row.submit_retry_count,
              verifies: row.verify_attempt_count,
            }),
          },
          {
            label: t("label-credit-registration-next-attempt"),
            value: <RelativeTime at={row.next_attempt_at} />,
          },
          {
            label: t("label-credit-registration-time-in-state"),
            value: <RelativeTime at={row.state_entered_at} />,
          },
        ]}
      />
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
      <div className={attemptChainCss}>
        {chain.map((attempt) => (
          <Link key={attempt.id} href={creditRegistrationItemRoute(attempt.id)}>
            <AdminStateBadge
              state={attempt.state}
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

const TimelineSection: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation()
  const events = details.events.toReversed()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-timeline")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-scrubbing-note")}</p>
      <Table
        caption={t("credit-registration-heading-timeline")}
        rowKey={(event) => event.id}
        rows={events}
        columns={[
          { header: t("label-time"), cell: (event) => <RelativeTime at={event.created_at} /> },
          { header: t("label-kind"), cell: (event) => <code>{event.kind}</code> },
          {
            header: t("label-state"),
            cell: (event) =>
              event.to_state ? (
                <>
                  {event.from_state && (
                    <>
                      <code>{event.from_state}</code>
                      {ARROW}
                    </>
                  )}
                  <AdminStateBadge state={event.to_state} />
                </>
              ) : null,
          },
          {
            header: t("label-error-code"),
            cell: (event) => (event.error_code ? <code>{event.error_code}</code> : null),
          },
          { header: t("label-message"), cell: (event) => event.message },
          {
            header: t("label-credit-registration-exchange"),
            cell: (event) =>
              event.details ? (
                <Disclosure title={t("credit-registration-admin-show-exchange")}>
                  <pre className={bodyCss}>{JSON.stringify(event.details, null, JSON_INDENT)}</pre>
                </Disclosure>
              ) : null,
          },
        ]}
      />
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
          { header: t("label-time"), cell: (call) => <RelativeTime at={call.started_at} /> },
          { header: t("label-endpoint"), cell: (call) => <code>{call.endpoint}</code> },
          {
            header: t("label-credit-registration-http-status"),
            cell: (call) => call.http_status ?? ABSENT,
          },
          {
            header: t("label-credit-registration-duration-ms"),
            cell: (call) => call.duration_ms ?? ABSENT,
          },
          {
            header: t("label-credit-registration-items"),
            cell: (call) =>
              t("credit-registration-admin-ok-error-items", {
                ok: call.ok_item_count,
                error: call.error_item_count,
                total: call.request_item_count,
              }),
          },
          {
            header: t("label-error-code"),
            cell: (call) =>
              call.request_level_error_code ? <code>{call.request_level_error_code}</code> : null,
          },
          { header: t("label-credit-registration-worker"), cell: (call) => call.worker_name },
          {
            header: t("label-credit-registration-bodies"),
            cell: (call) => (
              <Disclosure title={t("credit-registration-admin-show-bodies")}>
                <pre className={bodyCss}>
                  {JSON.stringify(
                    { request: call.request_body_sample, response: call.response_body_sample },
                    null,
                    JSON_INDENT,
                  )}
                </pre>
              </Disclosure>
            ),
          },
        ]}
      />
    </section>
  )
}

const LinkingSection: React.FC<{ mails: AdminLinkingEmail[] }> = ({ mails }) => {
  const { t } = useTranslation()
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
          {
            header: t("credit-registration-admin-send-status-header"),
            cell: (mail) =>
              [
                sendStatusLabel(t, mail.send_status.email_send_status),
                mail.send_status.failure_code,
              ]
                .filter(Boolean)
                .join(DOT),
          },
          {
            header: t("label-credit-registration-claimed-slot"),
            cell: (mail) => <RelativeTime at={mail.claimed_at} />,
          },
          {
            header: t("label-credit-registration-handed-over"),
            cell: (mail) => <RelativeTime at={mail.send_status.sent_at} />,
          },
          {
            header: t("label-credit-registration-retries"),
            cell: (mail) => mail.send_status.retry_count,
          },
          {
            header: t("label-credit-registration-token-claimed"),
            cell: (mail) =>
              mail.token_used_at ? (
                <RelativeTime at={mail.token_used_at} />
              ) : (
                <Badge tone={NEUTRAL_BADGE}>{t("credit-registration-admin-token-unclaimed")}</Badge>
              ),
          },
        ]}
      />
    </section>
  )
}

const AuditSection: React.FC<{ actions: CreditRegistrationAdminActionRecord[] }> = ({
  actions,
}) => {
  const { t } = useTranslation()
  if (actions.length === 0) {
    return <p className={noteCss}>{t("credit-registration-admin-no-actions-yet")}</p>
  }
  return (
    <Table
      caption={t("credit-registration-heading-audit")}
      rowKey={(action) => action.id}
      rows={actions}
      columns={[
        { header: t("label-time"), cell: (action) => <RelativeTime at={action.created_at} /> },
        { header: t("label-action"), cell: (action) => <code>{action.action}</code> },
        { header: t("label-role"), cell: (action) => <code>{action.actor_role}</code> },
        { header: t("label-actor"), cell: (action) => <code>{action.actor_user_id}</code> },
        { header: t("label-reason"), cell: (action) => action.reason },
      ]}
    />
  )
}

/** The single most useful screen for support: one row, and everything that happened to it. */
const RegistrationDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const params = useParams<{ registrationId: string }>()
  const detailsQuery = useAdminCreditRegistration(params.registrationId)

  return (
    <QueryResult query={detailsQuery}>
      {(details) => (
        <div className={sectionsCss}>
          <HeaderSection details={details} />
          <AttemptChainSection attempts={details.attempts} />
          <TimelineSection details={details} />
          <ApiCallSection calls={details.suotar_api_calls} />
          <LinkingSection mails={details.linking_emails} />
          <section className={sectionCss}>
            <h2 className={headingCss}>{t("credit-registration-heading-actions")}</h2>
            <AdminTransitionBlock registration={details.registration} />
            <h3 className={headingCss}>{t("credit-registration-heading-audit")}</h3>
            <AuditSection actions={details.actions} />
          </section>
        </div>
      )}
    </QueryResult>
  )
}

export default RegistrationDetailPage
