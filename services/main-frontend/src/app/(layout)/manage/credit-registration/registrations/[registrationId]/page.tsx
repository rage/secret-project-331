"use client"

import { css, cx } from "@emotion/css"
import type { TFunction } from "i18next"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  actorRoleLabel,
  adminActionLabel,
  adminActionTargetLabel,
  eventKindLabel,
  notificationKindLabel,
  sendStatusLabel,
  stateTone,
  verificationMethodLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { useAdminCreditRegistration } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import AdminTransitionBlock from "@/components/credit-registration/admin/AdminTransitionBlock"
import HttpStatusBadge from "@/components/credit-registration/admin/HttpStatusBadge"
import PayloadBlock from "@/components/credit-registration/admin/PayloadBlock"
import SuotarApiCallDetail from "@/components/credit-registration/admin/SuotarApiCallDetail"
import {
  ABSENT,
  ALIGN_END,
  ARROW,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  STACKED,
  TIME_COMPACT,
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
  proseCss,
  rowCss,
  sectionCss,
  sectionHeaderCss,
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
import { formatUserName } from "@/hooks/useUserDetails"
import {
  creditRegistrationItemRoute,
  creditRegistrationRegistrationsRoute,
  manageCourseRoute,
} from "@/shared-module/common/utils/routes"
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
  RegistrationStatusHeadline,
  RelativeTime,
  Table,
} from "@/shared-module/components"

/** A left gutter for the timeline's timestamps, so the kind of each entry starts on one line. */
const timelineEntryCss = css`
  display: grid;
  gap: var(--space-2) var(--space-4);
  grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);

  @media (max-width: 40rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const timelineBodyCss = css`
  display: grid;
  gap: var(--space-2);
`

const idRowCss = cx(
  rowCss,
  css`
    gap: var(--space-2);
  `,
)

const chainListCss = cx(
  rowCss,
  css`
    margin: 0;
    padding: 0;
    list-style: none;
  `,
)

/** Each id is copyable on its own: these get quoted into tickets and SQL consoles. */
const IdentifierList: React.FC<{ row: AdminCreditRegistrationRow }> = ({ row }) => {
  const { t } = useTranslation()
  // The registration's own id is in the page header; this is everything else it points at.
  const identifiers: { label: string; value: string | null | undefined }[] = [
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
    <Disclosure title={t("credit-registration-heading-identifiers")} variant="plain">
      <DescriptionList
        layout={STACKED}
        items={identifiers
          .filter((identifier): identifier is { label: string; value: string } =>
            Boolean(identifier.value),
          )
          .map((identifier) => ({
            label: identifier.label,
            value: (
              <span className={rowCss}>
                <span className={monospaceCss}>{identifier.value}</span>
                <CopyButton
                  value={identifier.value}
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

const HeaderSection: React.FC<{
  details: AdminCreditRegistrationDetails
  isLive: boolean
  updatedAt: number
}> = ({ details, isLive, updatedAt }) => {
  const { t } = useTranslation()
  const row = details.registration
  const errorHelp = registrationErrorHelp(t, row.error_code)
  return (
    <section className={sectionCss}>
      <div className={sectionHeaderCss}>
        <h2 className={headingCss}>
          {formatUserName(row)}
          {MIDDLE_DOT}
          {row.course_name}
        </h2>
        <span className={idRowCss}>
          <span className={cx(noteCss, monospaceCss)}>{row.id}</span>
          <CopyButton
            value={row.id}
            label={t("credit-registration-admin-copy-identifier", {
              label: t("label-credit-registration-registration"),
            })}
          />
          {isLive && (
            <span className={noteCss}>
              {t("credit-registration-admin-live-updated")}{" "}
              {/* The distance is the point here, not the clock time: this line exists to explain
                  why the values move under the cursor. */}
              <RelativeTime at={new Date(updatedAt).toISOString()} absoluteTime={TIME_IN_TITLE} />
            </span>
          )}
        </span>
      </div>
      <RegistrationStatusHeadline state={stateTone(row.state, row.pending_reason)}>
        {registrationLedgerStateLabel(t, row.state)}
      </RegistrationStatusHeadline>
      {/* The state above is true of this attempt and misleading about the completion, so the
          replacement has to be said before anything else on the page is read. */}
      {row.superseded && (
        <Infobox tone={TONE.INFO}>
          <p>{t("credit-registration-admin-superseded-no-actions")}</p>
          {row.superseded_by_id && (
            <Link href={creditRegistrationItemRoute(row.superseded_by_id)} prefetch={false}>
              {t("credit-registration-admin-open-replacement")}
            </Link>
          )}
        </Infobox>
      )}
      {errorHelp && (
        <div className={sectionHeaderCss}>
          <p className={proseCss}>{errorHelp}</p>
          {/* Untranslated on purpose: this is the identifier an operator quotes. */}
          <p className={noteCss}>
            <code>{row.error_code}</code>
          </p>
        </div>
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
  // A row that has finished, or that a later attempt replaced, has no next attempt; the stored
  // instant is whatever it was last scheduled for, which reads as a bug under that label.
  const nextAttempt: DescriptionListItem[] =
    row.terminal_at || row.superseded
      ? []
      : [
          {
            label: t("label-credit-registration-next-attempt"),
            value: <RelativeTime at={row.next_attempt_at} absoluteTime={TIME_COMPACT} />,
          },
        ]

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-registration-facts")}</h2>
      <DescriptionList
        layout={STACKED}
        items={[
          {
            label: t("label-student"),
            value: [formatUserName(row), row.email].filter(Boolean).join(MIDDLE_DOT),
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
            value: <RelativeTime at={row.state_entered_at} absoluteTime={TIME_COMPACT} />,
          },
          ...nextAttempt,
          {
            label: t("credit-registration-admin-attempts-made"),
            value: t("credit-registration-admin-sent-and-verified", {
              submits: row.submit_retry_count,
              verifies: row.verify_attempt_count,
            }),
          },
        ]}
      />
      <IdentifierList row={row} />
    </section>
  )
}

const AttemptChainSection: React.FC<{
  attempts: AdminCreditRegistrationRow[]
  currentId: string
}> = ({ attempts, currentId }) => {
  const { t } = useTranslation()
  if (attempts.length < 2) {
    return null
  }
  const chain = attempts.toSorted((a, b) => a.attempt_number - b.attempt_number)
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-attempt-chain")}</h2>
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role */}
      <ul className={chainListCss} role="list">
        {chain.map((attempt) => {
          const label = (
            <>
              {t("credit-registration-attempt-n", { n: attempt.attempt_number })}
              {MIDDLE_DOT}
              <AdminStateBadge state={attempt.state} superseded={attempt.superseded} />
            </>
          )
          return (
            <li key={attempt.id} className={rowCss}>
              {attempt.id === currentId ? (
                // Text, not a link: the one attempt you cannot navigate to is the one you are on.
                <span aria-current="page" className={rowCss}>
                  {label}
                </span>
              ) : (
                <Link href={creditRegistrationItemRoute(attempt.id)} prefetch={false}>
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-attempt-chain-note")}</p>
    </section>
  )
}

const PayloadDialog: React.FC<{ title: string; payload: unknown }> = ({ title, payload }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="tertiary" size="small" onClick={() => setOpen(true)}>
        {t("credit-registration-admin-show-exchange")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="wide" title={title}>
        <p className={noteCss}>{t("credit-registration-admin-scrubbing-note")}</p>
        <PayloadBlock body={payload} />
      </Dialog>
    </>
  )
}

const TimelineEntry: React.FC<{ event: AdminCreditRegistrationEvent }> = ({ event }) => {
  const { t } = useTranslation()
  return (
    <li className={timelineEntryCss}>
      <span className={noteCss}>
        <RelativeTime at={event.created_at} absoluteTime={TIME_COMPACT} />
      </span>
      <span className={timelineBodyCss}>
        <span className={rowCss}>
          <Badge tone={TONE.NEUTRAL} size="compact">
            {eventKindLabel(t, event.kind)}
          </Badge>
          {event.to_state && (
            <>
              {event.from_state && <AdminStateBadge state={event.from_state} />}
              <span aria-hidden="true">{ARROW}</span>
              <AdminStateBadge state={event.to_state} />
            </>
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
      </span>
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
        density={DENSITY_COMPACT}
        rowKey={(call) => call.id}
        rows={calls}
        columns={[
          {
            header: t("label-time"),
            minWidth: "8rem",
            nowrap: true,
            cell: (call) => <RelativeTime at={call.started_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            header: t("label-endpoint"),
            grow: true,
            minWidth: "10rem",
            cell: (call) => <code>{call.endpoint}</code>,
          },
          {
            header: t("label-credit-registration-http-status"),
            minWidth: "6rem",
            nowrap: true,
            cell: (call) => (
              <HttpStatusBadge
                httpStatus={call.http_status}
                succeeded={call.succeeded}
                errorItemCount={call.error_item_count}
              />
            ),
          },
          {
            header: t("credit-registration-admin-column-items"),
            minWidth: "9rem",
            cell: (call) =>
              t("credit-registration-admin-ok-error-items", {
                ok: call.ok_item_count,
                error: call.error_item_count,
                total: call.request_item_count,
              }),
          },
          {
            header: t("label-actions"),
            minWidth: "7rem",
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
    minWidth: "10rem",
    cell: (mail) =>
      [sendStatusLabel(t, mail.send_status.email_send_status), mail.send_status.failure_code]
        .filter(Boolean)
        .join(MIDDLE_DOT),
  },
  {
    header: t("label-credit-registration-retries"),
    align: ALIGN_END,
    minWidth: "5rem",
    nowrap: true,
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
        density={DENSITY_COMPACT}
        rowKey={(mail) => mail.id}
        rows={mails}
        columns={[
          {
            header: t("label-email"),
            grow: true,
            minWidth: "12rem",
            cell: (mail) => mail.emailed_to,
          },
          sendStatusColumn,
          {
            header: t("label-credit-registration-handed-over"),
            minWidth: "8rem",
            nowrap: true,
            cell: (mail) => (
              <RelativeTime at={mail.send_status.sent_at} absoluteTime={TIME_COMPACT} />
            ),
          },
          retriesColumn,
          {
            header: t("label-credit-registration-token-claimed"),
            minWidth: "8rem",
            nowrap: true,
            cell: (mail) =>
              mail.token_used_at ? (
                <RelativeTime at={mail.token_used_at} absoluteTime={TIME_COMPACT} />
              ) : (
                <Badge tone={TONE.NEUTRAL} size="compact">
                  {t("credit-registration-admin-token-unclaimed")}
                </Badge>
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
        density={DENSITY_COMPACT}
        rowKey={(mail) => mail.kind}
        rows={mails}
        columns={[
          {
            header: t("label-kind"),
            grow: true,
            minWidth: "12rem",
            cell: (mail) => notificationKindLabel(t, mail.kind),
          },
          sendStatusColumn,
          {
            header: t("label-credit-registration-handed-over"),
            minWidth: "8rem",
            nowrap: true,
            cell: (mail) => (
              <RelativeTime at={mail.send_status.sent_at} absoluteTime={TIME_COMPACT} />
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
      <Table
        caption={t("credit-registration-heading-audit")}
        density={DENSITY_COMPACT}
        rowKey={(action) => action.id}
        rows={actions}
        emptyState={
          <span className={emptyStateCss}>{t("credit-registration-admin-no-actions-yet")}</span>
        }
        columns={[
          {
            header: t("label-time"),
            minWidth: "8rem",
            nowrap: true,
            cell: (action) => <RelativeTime at={action.created_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            header: t("credit-registration-admin-column-action"),
            minWidth: "12rem",
            cell: (action) => adminActionLabel(t, action.action),
          },
          {
            header: t("credit-registration-admin-column-target"),
            minWidth: "8rem",
            cell: (action) => adminActionTargetLabel(t, action.target_kind),
          },
          {
            header: t("label-role"),
            minWidth: "7rem",
            cell: (action) => actorRoleLabel(t, action.actor_role),
          },
          {
            header: t("label-reason"),
            grow: true,
            minWidth: "14rem",
            nowrap: false,
            cell: (action) => action.reason,
          },
        ]}
      />
    </section>
  )
}

/** One ledger row end to end: what it is, what an admin can do to it, and everything it has done. */
const RegistrationDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const params = useParams<{ registrationId: string }>()
  const detailsQuery = useAdminCreditRegistration(params.registrationId)

  const row = detailsQuery.data?.registration
  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("credit-registration-tab-registrations"),
        href: creditRegistrationRegistrationsRoute(),
      },
      row
        ? {
            isLoading: false as const,
            label: `${formatUserName(row)}${MIDDLE_DOT}${row.course_name}`,
          }
        : { isLoading: true as const },
    ],
    [t, row],
  )
  useRegisterBreadcrumbs({ key: "credit-registration-item", order: 40, crumbs })

  return (
    <QueryResult query={detailsQuery} refreshIndicator={QUIET_REFRESH}>
      {(details) => (
        <div className={sectionsCss}>
          <HeaderSection
            details={details}
            isLive={!details.registration.terminal_at}
            updatedAt={detailsQuery.dataUpdatedAt}
          />
          <FactsSection details={details} />
          <section className={sectionCss}>
            <h2 className={headingCss}>{t("label-actions")}</h2>
            <AdminTransitionBlock registration={details.registration} />
          </section>
          <AttemptChainSection attempts={details.attempts} currentId={details.registration.id} />
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
