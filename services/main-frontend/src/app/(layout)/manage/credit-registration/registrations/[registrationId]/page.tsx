"use client"

import { css, cx } from "@emotion/css"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  adminActionLabel,
  notificationKindLabel,
  registrationErrorAdminHelp,
  sendStatusLabel,
  stateTone,
  verificationMethodLabel,
  adminLedgerStateLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useAdminCreditRegistration,
  useCreditRegistrationAdminActions,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateLabel from "@/components/credit-registration/admin/AdminStateLabel"
import AdminTransitionBlock from "@/components/credit-registration/admin/AdminTransitionBlock"
import RegistrationStepper from "@/components/credit-registration/admin/RegistrationStepper"
import {
  attentionReasonLabel,
  subStateExplanations,
} from "@/components/credit-registration/admin/registrationSubStates"
import RegistrationTimeline from "@/components/credit-registration/admin/RegistrationTimeline"
import StudentCell from "@/components/credit-registration/admin/StudentCell"
import { RegistrationCallItem } from "@/components/credit-registration/admin/SuotarApiCallDetail"
import {
  CallStatusCell,
  SuotarEndpointCell,
  tookColumn,
} from "@/components/credit-registration/admin/suotarCallColumns"
import {
  ABSENT,
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  STACKED,
  STATE_SUPERSEDED,
  TABLE_STACK,
  TIME_DATE,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
import { registrationGradeLabel } from "@/components/credit-registration/creditRegistrationCopy"
import {
  dividedListCss,
  emptyStateCss,
  headingCss,
  codeValueCss,
  noteCss,
  pageTitleCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionCss,
  sectionHeaderCss,
  spacedRowCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import { ZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type {
  AdminCreditRegistrationDetails,
  AdminCreditRegistrationEvent,
  AdminCreditRegistrationRow,
  AdminLinkingEmail,
  AdminNotificationEmail,
  AdminSuotarApiCall,
  CreditRegistrationAdminActionRow,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  creditRegistrationAuditRoute,
  creditRegistrationItemRoute,
  creditRegistrationRegistrationsRoute,
  manageCourseRoute,
} from "@/shared-module/common/utils/routes"
import type { DescriptionListItem, TableColumn } from "@/shared-module/components"
import {
  Badge,
  CopyButton,
  DescriptionList,
  Disclosure,
  QueryResult,
  RegistrationStatusHeadline,
  RelativeTime,
  Table,
} from "@/shared-module/components"

/** Actions on this one row; anything older than these is a click away in the audit log. */
const AUDIT_ROWS = 25

/** A stable empty page, so the actor lookup below is not rebuilt on every render. */
const NO_ACTIONS: CreditRegistrationAdminActionRow[] = []

type AdminActionsQuery = ReturnType<typeof useCreditRegistrationAdminActions>

const idRowCss = cx(
  rowCss,
  css`
    gap: var(--space-2);
  `,
)

/** Identity and timing side by side once there is room, rather than one column padded with air. */
const factsGridCss = css`
  display: grid;
  gap: var(--space-5) var(--space-7);

  ${respondToOrLarger.lg} {
    grid-template-columns: 1fr 1fr;
  }
`

const JOIN_IDENTIFIERS = "\n"

/** Each id is copyable on its own, and all of them together: these get quoted into tickets and SQL consoles. */
const IdentifierList: React.FC<{ row: AdminCreditRegistrationRow }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  // The registration's own id is in the page header; this is everything else it points at.
  const identifiers: { label: string; value: string | null | undefined }[] = [
    {
      label: t("label-credit-registration-completion-id"),
      value: row.course_module_completion_id,
    },
    { label: t("label-credit-registration-enrolment"), value: row.selected_enrolment_id },
    {
      label: t("credit-registration-admin-submitted-attainment-id"),
      value: row.submitted_attainment_id,
    },
    { label: t("credit-registration-admin-registry-attainment-id"), value: row.sisu_attainment_id },
    { label: t("label-user-id"), value: row.user_id },
    { label: t("label-course-module-id"), value: row.course_module_id },
  ]
  const present = identifiers.filter((identifier): identifier is { label: string; value: string } =>
    Boolean(identifier.value),
  )
  return (
    <Disclosure
      title={t("credit-registration-heading-identifiers")}
      summary={
        <span className={noteCss}>
          {t("credit-registration-admin-identifier-count", { count: present.length })}
        </span>
      }
      variant={PLAIN_DISCLOSURE}
    >
      <div className={subsectionCss}>
        <CopyButton
          value={present
            .map((identifier) => `${identifier.label}: ${identifier.value}`)
            .join(JOIN_IDENTIFIERS)}
          label={t("credit-registration-admin-copy-all-identifiers")}
        />
        <DescriptionList
          layout={STACKED}
          items={present.map((identifier) => ({
            label: identifier.label,
            value: (
              <span className={rowCss}>
                <span className={codeValueCss}>{identifier.value}</span>
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
      </div>
    </Disclosure>
  )
}

const HeaderSection: React.FC<{
  details: AdminCreditRegistrationDetails
  isLive: boolean
  updatedAt: number
}> = ({ details, isLive, updatedAt }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const row = details.registration
  const stateLabel = adminLedgerStateLabel(t, row.state, row.pending_reason)
  const now = Date.now()
  const explanations = subStateExplanations(t, row, details.attention_thresholds, now)
  const replacement = details.attempts.find((attempt) => attempt.id === row.superseded_by_id)
  const errorHelp = registrationErrorAdminHelp(t, row.error_code, {
    studentNumber: row.verified_student_number ?? row.student_number ?? null,
    courseCode: row.uh_course_code ?? null,
  })
  return (
    <section className={sectionCss}>
      <div className={sectionHeaderCss}>
        <h1 className={pageTitleCss}>{formatUserName(row)}</h1>
        <span className={rowCss}>
          <Link href={manageCourseRoute(row.course_id)}>{row.course_name}</Link>
          {row.course_module_name ? <span>{row.course_module_name}</span> : null}
          {row.uh_course_code ? <code className={codeValueCss}>{row.uh_course_code}</code> : null}
        </span>
        <span className={idRowCss}>
          <span className={cx(noteCss, codeValueCss)}>{row.id}</span>
          <CopyButton
            value={row.id}
            label={t("credit-registration-admin-copy-identifier", {
              label: t("label-credit-registration-registration"),
            })}
          />
          {isLive && (
            <span className={noteCss}>
              {t("credit-registration-admin-live-updated")}{" "}
              {/* Relative time, not absolute: the distance ticking down is what shows this row is
                  updating live. */}
              <RelativeTime at={new Date(updatedAt).toISOString()} absoluteTime={TIME_IN_TITLE} />
            </span>
          )}
        </span>
      </div>
      <RegistrationStepper details={details} now={now} />
      {/* A replaced attempt keeps the state it reached, but leading with it reads as news about the
          completion — which the newest attempt, not this one, decides. That nothing can be done to
          it is the Actions section's sentence; a banner here would say it twice. */}
      {row.superseded ? (
        <div className={sectionHeaderCss}>
          <RegistrationStatusHeadline state={STATE_SUPERSEDED}>
            {replacement
              ? t("credit-registration-admin-replaced-by-attempt", {
                  n: replacement.attempt_number,
                })
              : t("credit-registration-admin-replaced")}
          </RegistrationStatusHeadline>
          <p className={noteCss}>
            {t("credit-registration-admin-superseded-was", { state: stateLabel })}
          </p>
          {row.superseded_by_id && (
            <Link href={creditRegistrationItemRoute(row.superseded_by_id)} prefetch={false}>
              {t("credit-registration-admin-open-replacement")}
            </Link>
          )}
        </div>
      ) : (
        <RegistrationStatusHeadline state={stateTone(row.state, row.pending_reason)}>
          {stateLabel}
        </RegistrationStatusHeadline>
      )}
      {row.needs_admin_attention && !row.superseded && (
        <div>
          <Badge
            tone={TONE.WARNING}
            description={attentionReasonLabel(t, row, details.attention_thresholds, now)}
          >
            {t("credit-registration-admin-needs-attention")}
          </Badge>
        </div>
      )}
      {explanations.map((line) => (
        <p key={line} className={proseCss}>
          {line}
        </p>
      ))}
      {errorHelp && (
        <div className={sectionHeaderCss}>
          <p className={proseCss}>{errorHelp}</p>
          {/* Untranslated on purpose: this is the identifier an operator quotes. */}
          <p className={noteCss}>
            <code className={codeValueCss}>{row.error_code}</code>
          </p>
        </div>
      )}
    </section>
  )
}

const FactsSection: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const row = details.registration
  const studentNumber = row.verified_student_number ?? row.student_number
  const verifiedVia =
    row.verified_student_number_via === "study_registry"
      ? null
      : verificationMethodLabel(t, row.verified_student_number_via)
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
  const isChecking =
    row.state === "awaiting_verification" ||
    row.state === "partially_registered" ||
    row.state === "submission_uncertain"
  // In flight, waiting on a fact rather than a time, or waiting for a human.
  const hidesNextAttempt =
    row.state === "submitting" ||
    row.state === "resolving_enrolment" ||
    row.state === "pending" ||
    row.state === "blocked" ||
    row.state === "misregistered"
  const nextAttempt: DescriptionListItem[] =
    row.terminal_at || row.superseded || hidesNextAttempt
      ? []
      : [
          {
            label: isChecking
              ? t("label-credit-registration-next-check")
              : t("label-credit-registration-next-attempt"),
            value: <ZonedTimestamp at={row.next_attempt_at} />,
          },
        ]

  const identityItems: DescriptionListItem[] = [
    // The page heading is the student's name, so only the address is news here.
    {
      label: t("label-email"),
      value: row.email ?? ABSENT,
    },
    {
      label: t("label-student-number"),
      value: studentNumber ? (
        <span className={rowCss}>
          <span className={codeValueCss}>{studentNumber}</span>
          {verifiedVia}
        </span>
      ) : (
        ABSENT
      ),
    },
    {
      label: t("label-credit-registration-grade"),
      value: row.grade_id ? registrationGradeLabel(t, row.grade_id, row.grade_scale_id) : ABSENT,
    },
    {
      label: t("label-credits"),
      value: row.credits ?? ABSENT,
    },
    ...heldGrade,
  ]

  const timingItems: DescriptionListItem[] = [
    {
      label: t("label-credit-registration-completion"),
      value: <RelativeTime at={row.completion_date} absoluteTime={TIME_DATE} />,
    },
    {
      label: t("label-credit-registration-time-in-state"),
      value: <ZonedTimestamp at={row.state_entered_at} />,
    },
    ...nextAttempt,
    {
      // Failed sends and confirmation checks, not calls: one Sisu call carries many rows, so the
      // call table below counts more than these two do.
      label: t("label-credit-registration-failed-sends"),
      value: row.submit_retry_count,
    },
    {
      label: t("label-credit-registration-confirmation-checks"),
      value: row.verify_attempt_count,
    },
  ]

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-registration-facts")}</h2>
      </div>
      <div className={factsGridCss}>
        <DescriptionList items={identityItems} />
        <DescriptionList items={timingItems} />
      </div>
      <IdentifierList row={row} />
    </section>
  )
}

const AttemptChainSection: React.FC<{
  attempts: AdminCreditRegistrationRow[]
  currentId: string
}> = ({ attempts, currentId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (attempts.length < 2) {
    return null
  }
  const chain = attempts.toSorted((a, b) => a.attempt_number - b.attempt_number)
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-attempt-chain")}</h2>
      </div>
      {/* Capped so each timestamp stays beside its attempt instead of at the card's far edge. */}
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role */}
      <ol className={cx(dividedListCss, proseCss)} role="list">
        {chain.map((attempt) => (
          <li key={attempt.id} className={spacedRowCss}>
            <span className={rowCss}>
              {/* Only the number links: a link around a badge underlines the badge. */}
              {attempt.id === currentId ? (
                <span aria-current="page">
                  {t("credit-registration-attempt-n", { n: attempt.attempt_number })}
                </span>
              ) : (
                <Link href={creditRegistrationItemRoute(attempt.id)} prefetch={false}>
                  {t("credit-registration-attempt-n", { n: attempt.attempt_number })}
                </Link>
              )}
              {/* No replaced badge: all but the newest attempt are, so it would label the whole
                  list. The wire name is worth quoting only on the attempt being acted on. */}
              <AdminStateLabel state={attempt.state} showToken={attempt.id === currentId} />
            </span>
            <span className={noteCss}>
              <ZonedTimestamp at={attempt.created_at} />
            </span>
          </li>
        ))}
      </ol>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-attempt-chain-note")}</p>
    </section>
  )
}

/** Suotar's codes are single camelCase words; breaking one mid-word makes it unreadable. */
const unbrokenCodeCss = css`
  white-space: nowrap;
  overflow-wrap: normal;
`

/**
 * How one call went for this registration: Suotar's code for its item, or why it got none. Without
 * an event of its own, how the request as a whole went.
 */
const RegistrationCallStatus: React.FC<{
  call: AdminSuotarApiCall
  event: AdminCreditRegistrationEvent | undefined
}> = ({ call, event }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  switch (event?.suotar_answer) {
    case "refused":
      return t("credit-registration-admin-timeline-result-request-refused")
    case "unanswered":
      return t("credit-registration-admin-timeline-result-no-answer")
  }
  return event?.suotar_code ? (
    <code className={cx(codeValueCss, unbrokenCodeCss)}>{event.suotar_code}</code>
  ) : (
    <CallStatusCell call={call} />
  )
}

const ApiCallSection: React.FC<{
  calls: AdminSuotarApiCall[]
  events: AdminCreditRegistrationEvent[]
}> = ({ calls, events }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const eventByCall = new Map(
    events.flatMap((event) =>
      event.kind === "suotar_response" && event.suotar_api_call_id
        ? [[event.suotar_api_call_id, event] as const]
        : [],
    ),
  )
  if (calls.length === 0) {
    return null
  }
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>
          {t("credit-registration-heading-api-calls-count", { count: calls.length })}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-api-calls-note")}</p>
      <Table
        caption={t("credit-registration-heading-api-calls")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(call) => call.id}
        rows={calls}
        expandableRow={(call) => (
          <RegistrationCallItem
            suotarApiCallId={call.id}
            exchange={eventByCall.get(call.id)?.details}
          />
        )}
        columns={[
          {
            header: t("label-time"),
            minWidth: "8rem",
            nowrap: true,
            cell: (call) => <ZonedTimestamp at={call.started_at} />,
          },
          {
            header: t("credit-registration-admin-column-what"),
            grow: true,
            minWidth: "10rem",
            cell: (call) => <SuotarEndpointCell endpoint={call.endpoint} />,
          },
          tookColumn(t),
          {
            header: t("label-status"),
            minWidth: "8rem",
            cell: (call) => <RegistrationCallStatus call={call} event={eventByCall.get(call.id)} />,
          },
        ]}
      />
    </section>
  )
}

/** Every mail table shares a send-status, handed-over and retries column; only the rest differ. */
const sendStatusColumns = <T extends { send_status: AdminLinkingEmail["send_status"] }>(
  t: CreditRegistrationTFunction,
): [TableColumn<T>, TableColumn<T>, TableColumn<T>] => [
  {
    header: t("credit-registration-admin-send-status-header"),
    minWidth: "10rem",
    cell: (mail) =>
      [sendStatusLabel(t, mail.send_status.email_send_status), mail.send_status.failure_code]
        .filter(Boolean)
        .join(MIDDLE_DOT),
  },
  {
    header: t("label-credit-registration-handed-over"),
    minWidth: "8rem",
    nowrap: true,
    cell: (mail) => <ZonedTimestamp at={mail.send_status.sent_at} />,
  },
  {
    header: t("label-credit-registration-retries"),
    align: ALIGN_END,
    minWidth: "5rem",
    nowrap: true,
    cell: (mail) => mail.send_status.retry_count,
  },
]

const MailTable = <T extends { send_status: AdminLinkingEmail["send_status"] }>({
  mails,
  heading,
  rowKey,
  firstColumn,
  extraColumns = [],
}: {
  mails: T[]
  heading: string
  rowKey: (mail: T) => string
  firstColumn: TableColumn<T>
  extraColumns?: TableColumn<T>[]
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [sendStatusColumn, handedOverColumn, retriesColumn] = sendStatusColumns<T>(t)
  if (mails.length === 0) {
    return null
  }
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{heading}</h2>
      </div>
      <Table
        caption={heading}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={rowKey}
        rows={mails}
        columns={[firstColumn, sendStatusColumn, handedOverColumn, retriesColumn, ...extraColumns]}
      />
    </section>
  )
}

const LinkingSection: React.FC<{ mails: AdminLinkingEmail[] }> = ({ mails }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <MailTable
      mails={mails}
      heading={t("credit-registration-heading-linking-emails")}
      rowKey={(mail) => mail.id}
      firstColumn={{
        header: t("label-email"),
        grow: true,
        minWidth: "12rem",
        cell: (mail) => mail.emailed_to,
      }}
      extraColumns={[
        {
          header: t("label-credit-registration-token-claimed"),
          minWidth: "8rem",
          nowrap: true,
          cell: (mail) =>
            mail.token_used_at ? (
              <ZonedTimestamp at={mail.token_used_at} />
            ) : (
              <Badge tone={TONE.NEUTRAL} size="compact">
                {t("credit-registration-admin-token-unclaimed")}
              </Badge>
            ),
        },
      ]}
    />
  )
}

const NotificationSection: React.FC<{ mails: AdminNotificationEmail[] }> = ({ mails }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <MailTable
      mails={mails}
      heading={t("credit-registration-heading-notification-emails")}
      // The kind is not unique: a second mail of the same kind is exactly what this table shows.
      rowKey={(mail) => mail.email_delivery_id}
      firstColumn={{
        header: t("label-kind"),
        grow: true,
        minWidth: "12rem",
        cell: (mail) => notificationKindLabel(t, mail.kind),
      }}
    />
  )
}

/** Who acted on this row, from the same log the Audit tab reads, so both name the actor. */
const AuditSection: React.FC<{
  registrationId: string
  query: AdminActionsQuery
}> = ({ registrationId, query }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-audit")}</h2>
        <Link
          href={`${creditRegistrationAuditRoute()}?target_id=${registrationId}`}
          prefetch={false}
        >
          {t("credit-registration-admin-open-in-audit-log")}
        </Link>
      </div>
      <QueryResult query={query} refreshIndicator={QUIET_REFRESH}>
        {(page) => (
          <Table
            caption={t("credit-registration-heading-audit")}
            density={DENSITY_COMPACT}
            responsive={TABLE_STACK}
            rowKey={(action) => action.id}
            rows={page.data}
            emptyState={
              <span className={emptyStateCss}>{t("credit-registration-admin-no-actions-yet")}</span>
            }
            columns={[
              {
                header: t("label-time"),
                minWidth: "8rem",
                nowrap: true,
                cell: (action) => <ZonedTimestamp at={action.created_at} />,
              },
              {
                header: t("label-actor"),
                minWidth: "11rem",
                cell: (action) => (
                  <StudentCell
                    row={{
                      first_name: action.actor_first_name ?? null,
                      last_name: action.actor_last_name ?? null,
                      email: action.actor_email ?? null,
                    }}
                  />
                ),
              },
              {
                header: t("credit-registration-admin-column-action"),
                minWidth: "11rem",
                cell: (action) => adminActionLabel(t, action.action),
              },
              {
                header: t("label-reason"),
                grow: true,
                minWidth: "16rem",
                nowrap: false,
                cell: (action) => action.reason ?? ABSENT,
              },
            ]}
          />
        )}
      </QueryResult>
    </section>
  )
}

/** One ledger row end to end: what it is, what an admin can do to it, and everything it has done. */
const RegistrationDetailPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const params = useParams<{ registrationId: string }>()
  const detailsQuery = useAdminCreditRegistration(params.registrationId)
  const actionsQuery = useCreditRegistrationAdminActions({
    target_id: params.registrationId,
    page: 1,
    limit: AUDIT_ROWS,
  })
  const actions = actionsQuery.data?.data ?? NO_ACTIONS
  // The events carry an actor id and no name; the log carries both, for the same registration.
  const actorNames = useMemo(
    () =>
      new Map(
        actions.map((action) => [
          action.actor_user_id,
          formatUserName({
            first_name: action.actor_first_name,
            last_name: action.actor_last_name,
          }) ||
            (action.actor_email ?? action.actor_user_id),
        ]),
      ),
    [actions],
  )

  const row = detailsQuery.data?.registration
  usePageTitle(row ? formatUserName(row) : null)
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
        <div className={sectionCardsCss}>
          <HeaderSection
            details={details}
            isLive={!details.registration.terminal_at}
            updatedAt={detailsQuery.dataUpdatedAt}
          />
          <FactsSection details={details} />
          <section className={sectionCardCss}>
            <div className={sectionCardHeaderCss}>
              <h2 className={headingCss}>{t("label-actions")}</h2>
            </div>
            <AdminTransitionBlock registration={details.registration} />
          </section>
          <AttemptChainSection attempts={details.attempts} currentId={details.registration.id} />
          <RegistrationTimeline
            events={details.events}
            actorNames={actorNames}
            selectedEnrolmentId={details.registration.selected_enrolment_id ?? null}
          />
          <ApiCallSection calls={details.suotar_api_calls} events={details.events} />
          <LinkingSection mails={details.linking_emails} />
          <NotificationSection mails={details.notification_emails} />
          <AuditSection registrationId={details.registration.id} query={actionsQuery} />
        </div>
      )}
    </QueryResult>
  )
}

export default RegistrationDetailPage
