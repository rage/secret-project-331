"use client"

import { css, cx } from "@emotion/css"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import AbsentValue from "@/components/credit-registration/AbsentValue"
import {
  enrolmentRouteLabel,
  notificationKindLabel,
  sendStatusLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useAdminCreditRegistration,
  useCreditRegistrationAdminActions,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import { auditForStudentHref } from "@/components/credit-registration/admin/adminLinks"
import AdminTransitionBlock from "@/components/credit-registration/admin/AdminTransitionBlock"
import { buildJourney } from "@/components/credit-registration/admin/journeyPhases"
import LinkingMethodLabel from "@/components/credit-registration/admin/LinkingMethodLabel"
import RegistrationJourney from "@/components/credit-registration/admin/RegistrationJourney"
import RegistrationProblemActions from "@/components/credit-registration/admin/RegistrationProblemActions"
import { RegistrationCallItem } from "@/components/credit-registration/admin/SuotarApiCallDetail"
import {
  CallStatusCell,
  SuotarEndpointCell,
} from "@/components/credit-registration/admin/suotarCallColumns"
import {
  buildTimeline,
  eventSentence,
  selectedEnrolmentSummary,
} from "@/components/credit-registration/admin/timelineRows"
import type { TimelineContext } from "@/components/credit-registration/admin/timelineRows"
import { timelineStepLabel } from "@/components/credit-registration/admin/timelineSteps"
import {
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  STACKED,
  TABLE_STACK,
  TONE,
} from "@/components/credit-registration/constants"
import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
import { registrationGradeLabel } from "@/components/credit-registration/creditRegistrationCopy"
import {
  codeValueCss,
  headingCss,
  noteCss,
  pageTitleCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionHeaderCss,
  stackedCellCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import {
  formatZonedTimeRange,
  ZonedTimestamp,
} from "@/components/credit-registration/ZonedTimestamp"
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
  Table,
} from "@/shared-module/components"

/** The actor names the timeline needs; older actions are a click away in the audit log. */
const AUDIT_ROWS = 25

/** A stable empty page, so the actor lookup below is not rebuilt on every render. */
const NO_ACTIONS: CreditRegistrationAdminActionRow[] = []

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
  row: AdminCreditRegistrationRow
  isLive: boolean
  updatedAt: number
}> = ({ row, isLive, updatedAt }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
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
            <ZonedTimestamp at={new Date(updatedAt).toISOString()} />
          </span>
        )}
      </span>
    </div>
  )
}

/** Where an older attempt's page points: the attempt that replaced it. */
const SupersededCard: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const row = details.registration
  const replacement = details.attempts.find((attempt) => attempt.id === row.superseded_by_id)
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {replacement
            ? t("credit-registration-admin-replaced-by-attempt", { n: replacement.attempt_number })
            : t("credit-registration-admin-replaced")}
        </h2>
        <p className={noteCss}>
          {t("credit-registration-admin-superseded-was", {
            state: timelineStepLabel(t, row.timeline_step),
          })}
        </p>
      </div>
      {row.superseded_by_id && (
        <Link href={creditRegistrationItemRoute(row.superseded_by_id)} prefetch={false}>
          {t("credit-registration-admin-open-replacement")}
        </Link>
      )}
    </section>
  )
}

/** The hand actions on a registration with no problem box to carry them. */
const ActionsSection: React.FC<{ details: AdminCreditRegistrationDetails }> = ({ details }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("label-actions")}
        </h2>
      </div>
      {details.attention?.standing === "dismissed" && details.attention.dismissal_reason && (
        <p className={noteCss}>
          {t("credit-registration-admin-status-dismissed", {
            reason: details.attention.dismissal_reason,
          })}
        </p>
      )}
      <AdminTransitionBlock registration={details.registration} />
    </section>
  )
}

const FactsSection: React.FC<{
  details: AdminCreditRegistrationDetails
  context: TimelineContext
}> = ({ details, context }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const row = details.registration
  const studentNumber = row.verified_student_number ?? row.student_number
  const route = enrolmentRouteLabel(t, details.journey.enrolment_route)
  const realisation = selectedEnrolmentSummary(t, details.events, context)

  const identityItems: DescriptionListItem[] = [
    // The page heading is the student's name, so only the address is news here.
    { label: t("label-email"), value: row.email ?? <AbsentValue /> },
    {
      label: t("label-student-number"),
      value: studentNumber ? (
        <span className={rowCss}>
          <span className={codeValueCss}>{studentNumber}</span>
          {row.verified_student_number_via && (
            <LinkingMethodLabel
              method={row.verified_student_number_via}
              linkedAt={row.verified_student_number_at}
            />
          )}
        </span>
      ) : (
        t("credit-registration-admin-not-linked")
      ),
    },
    ...(route ? [{ label: t("label-credit-registration-how-they-enrolled"), value: route }] : []),
    {
      label: t("label-credit-registration-grade"),
      value: row.grade_id
        ? registrationGradeLabel(t, row.grade_id, row.grade_scale_id)
        : t("credit-registration-admin-not-sent-yet"),
    },
    {
      label: t("label-credits"),
      value: row.credits ?? t("credit-registration-admin-not-sent-yet"),
    },
    // Next to the grade we sent, which is the comparison that explains a "no improvement" verdict.
    ...(details.not_improved_attainment
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
      : []),
  ]

  const registrationItems: DescriptionListItem[] = [
    ...(realisation
      ? [{ label: t("label-credit-registration-course-unit-realisation"), value: realisation }]
      : []),
    ...(details.journey.sisu_enrolled_at
      ? [
          {
            label: t("label-credit-registration-sisu-enrolment-time"),
            value: <ZonedTimestamp at={details.journey.sisu_enrolled_at} />,
          },
        ]
      : []),
    // Failed sends and confirmation checks, not calls: one Sisu call carries many rows, so the
    // call table below counts more than these two do.
    ...(row.submit_retry_count > 0
      ? [{ label: t("label-credit-registration-failed-sends"), value: row.submit_retry_count }]
      : []),
    ...(row.verify_attempt_count > 0
      ? [
          {
            label: t("label-credit-registration-confirmation-checks"),
            value: row.verify_attempt_count,
          },
        ]
      : []),
    ...(row.error_code
      ? [
          {
            label: t("label-error-code"),
            // Untranslated on purpose: this is the identifier an operator quotes.
            value: <code className={codeValueCss}>{row.error_code}</code>,
          },
        ]
      : []),
    ...(details.attempts.length > 1
      ? [
          {
            label: t("credit-registration-heading-attempt-chain"),
            value: (
              <span className={rowCss}>
                {details.attempts
                  .toSorted((a, b) => a.attempt_number - b.attempt_number)
                  .map((attempt) =>
                    attempt.id === row.id ? (
                      <span key={attempt.id} aria-current="page">
                        {t("credit-registration-attempt-n", { n: attempt.attempt_number })}
                      </span>
                    ) : (
                      <Link
                        key={attempt.id}
                        href={creditRegistrationItemRoute(attempt.id)}
                        prefetch={false}
                      >
                        {t("credit-registration-attempt-n", { n: attempt.attempt_number })}
                      </Link>
                    ),
                  )}
              </span>
            ),
          },
        ]
      : []),
  ]

  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-registration-facts")}
        </h2>
        <Link href={auditForStudentHref(row.user_id)} prefetch={false}>
          {t("credit-registration-admin-all-actions-on-student")}
        </Link>
      </div>
      <div className={factsGridCss}>
        <DescriptionList items={identityItems} />
        {registrationItems.length > 0 && <DescriptionList items={registrationItems} />}
      </div>
      <IdentifierList row={row} />
    </section>
  )
}

/** Suotar's codes are single camelCase words; breaking one mid-word makes it unreadable. */
const unbrokenCodeCss = css`
  white-space: nowrap;
  overflow-wrap: normal;
`

type Event = AdminCreditRegistrationEvent

/** Consecutive calls that went the same way, newest first, shown as one row. */
interface CallGroup {
  calls: [AdminSuotarApiCall, ...AdminSuotarApiCall[]]
  event: Event | undefined
}

const callGroupKey = (call: AdminSuotarApiCall, event: Event | undefined): string =>
  JSON.stringify([
    call.endpoint,
    call.succeeded,
    call.http_status ?? null,
    call.request_level_error_code ?? null,
    event?.suotar_code ?? null,
    event?.suotar_answer ?? null,
    event?.from_state ?? null,
    event?.to_state ?? null,
  ])

const groupCalls = (calls: AdminSuotarApiCall[], eventByCall: Map<string, Event>): CallGroup[] => {
  const groups: (CallGroup & { key: string })[] = []
  for (const call of calls) {
    const event = eventByCall.get(call.id)
    const key = callGroupKey(call, event)
    const last = groups.at(-1)
    if (last && last.key === key) {
      last.calls.push(call)
    } else {
      groups.push({ key, calls: [call], event })
    }
  }
  return groups
}

/** What Suotar said about this registration, in plain words over its own code. */
const CallAnswer: React.FC<{
  group: CallGroup
  context: TimelineContext
}> = ({ group, context }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [newest] = group.calls
  const { event } = group
  if (!event) {
    return <CallStatusCell call={newest} />
  }
  return (
    <span className={cx(sectionHeaderCss)}>
      <span>{eventSentence(t, event, context)}</span>
      {event.suotar_code && (
        <code className={cx(noteCss, codeValueCss, unbrokenCodeCss)}>{event.suotar_code}</code>
      )}
    </span>
  )
}

const ApiCallSection: React.FC<{
  calls: AdminSuotarApiCall[]
  events: Event[]
  context: TimelineContext
}> = ({ calls, events, context }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const groups = useMemo(() => {
    const eventByCall = new Map(
      events.flatMap((event) =>
        event.kind === "suotar_response" && event.suotar_api_call_id
          ? [[event.suotar_api_call_id, event] as const]
          : [],
      ),
    )
    return groupCalls(calls, eventByCall)
  }, [calls, events])
  if (calls.length === 0) {
    return (
      <section className={sectionCardCss} aria-labelledby={headingId}>
        <div className={sectionCardHeaderCss}>
          <h2 id={headingId} className={headingCss}>
            {t("credit-registration-heading-api-calls")}
          </h2>
        </div>
        <p className={noteCss}>{t("credit-registration-admin-api-calls-none")}</p>
      </section>
    )
  }
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-api-calls-count", { count: calls.length })}
        </h2>
      </div>
      <Table
        labelledBy={headingId}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(group) => group.calls[0].id}
        rows={groups}
        expandableRow={(group) => (
          <RegistrationCallItem
            suotarApiCallId={group.calls[0].id}
            exchange={group.event?.details}
          />
        )}
        columns={[
          {
            header: t("label-time"),
            minWidth: "10rem",
            cell: (group) => {
              const [newest] = group.calls
              const oldest = group.calls.at(-1) ?? newest
              return group.calls.length === 1 ? (
                <ZonedTimestamp at={newest.started_at} />
              ) : (
                <span className={sectionHeaderCss}>
                  <span>
                    {t("credit-registration-admin-calls-repeated", { count: group.calls.length })}
                  </span>
                  <span className={noteCss}>
                    {formatZonedTimeRange(new Date(oldest.started_at), new Date(newest.started_at))}
                  </span>
                </span>
              )
            },
          },
          {
            header: t("credit-registration-admin-column-what"),
            minWidth: "10rem",
            cell: (group) => <SuotarEndpointCell endpoint={group.calls[0].endpoint} />,
          },
          {
            header: t("credit-registration-admin-column-answer"),
            grow: true,
            minWidth: "12rem",
            cell: (group) => <CallAnswer group={group} context={context} />,
          },
          {
            header: t("credit-registration-admin-column-duration-ms"),
            align: ALIGN_END,
            nowrap: true,
            cell: (group) => group.calls[0].duration_ms ?? <AbsentValue />,
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
    cell: (mail) => (
      <span className={stackedCellCss}>
        <span>{sendStatusLabel(t, mail.send_status.email_send_status)}</span>
        {mail.send_status.failure_code && (
          <code className={cx(noteCss, codeValueCss)}>{mail.send_status.failure_code}</code>
        )}
      </span>
    ),
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
  const headingId = useId()
  const [sendStatusColumn, handedOverColumn, retriesColumn] = sendStatusColumns<T>(t)
  if (mails.length === 0) {
    return null
  }
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {heading}
        </h2>
      </div>
      <Table
        labelledBy={headingId}
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

/** One completion end to end, told from whichever of its attempts the page is for. */
const RegistrationDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const params = useParams<{ registrationId: string }>()
  const detailsQuery = useAdminCreditRegistration(params.registrationId)
  // The events carry an actor id and no name; the log carries both.
  const actionsQuery = useCreditRegistrationAdminActions({
    target_id: params.registrationId,
    page: 1,
    limit: AUDIT_ROWS,
  })
  const actions = actionsQuery.data?.data ?? NO_ACTIONS
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

  const details = detailsQuery.data
  const row = details?.registration
  const context = useMemo<TimelineContext>(
    () => ({
      actorName: (userId) => actorNames.get(userId),
      selectedEnrolmentId: details?.registration.selected_enrolment_id ?? null,
      language: i18n.language,
      attemptNumber: (registrationId) =>
        details?.attempts.find((attempt) => attempt.id === registrationId)?.attempt_number,
    }),
    [actorNames, details, i18n.language],
  )
  const phases = useMemo(
    () => (details ? buildJourney(t, details, buildTimeline(t, details.events, context)) : []),
    [t, details, context],
  )

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
            label: formatUserName(row),
          }
        : { isLoading: true as const },
    ],
    [t, row],
  )
  useRegisterBreadcrumbs({ key: "credit-registration-item", order: 40, crumbs })

  return (
    <QueryResult query={detailsQuery} refreshIndicator={QUIET_REFRESH}>
      {(loaded) => {
        const problem = phases.find((phase) => phase.problem)?.problem ?? null
        return (
          <div className={sectionCardsCss}>
            <HeaderSection
              row={loaded.registration}
              isLive={!loaded.registration.terminal_at}
              updatedAt={detailsQuery.dataUpdatedAt}
            />
            {loaded.registration.superseded && <SupersededCard details={loaded} />}
            <RegistrationJourney
              phases={phases}
              currentAttemptId={loaded.registration.id}
              attemptNumber={context.attemptNumber}
              showsAttempts={loaded.attempts.length > 1}
              problemActions={
                problem && !loaded.registration.superseded ? (
                  <RegistrationProblemActions
                    registration={loaded.registration}
                    isStudentNumberStuck={problem.isStudentNumberStuck}
                    unmailedEarlyEnroleeCount={
                      loaded.linking_schedule?.unlinked_enrolled_before_count ?? null
                    }
                  />
                ) : null
              }
            />
            {!problem && !loaded.registration.superseded && <ActionsSection details={loaded} />}
            <FactsSection details={loaded} context={context} />
            <ApiCallSection
              calls={loaded.suotar_api_calls}
              events={loaded.events}
              context={context}
            />
            <LinkingSection mails={loaded.linking_emails} />
            <NotificationSection mails={loaded.notification_emails} />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default RegistrationDetailPage
