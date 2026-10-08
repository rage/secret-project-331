"use client"

import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  formatZonedTimestamp,
  ZonedTimestamp,
} from "@/components/credit-registration/ZonedTimestamp"
import { getAccountLinkingStatsQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import {
  adminDismissStudyRegistryConflict,
  adminRequestEnrolmentListFetch,
  adminUnlinkStudentNumber,
} from "@/generated/api/sdk.generated"
import type {
  AccountLinkingCourseCode,
  AccountLinkingRecentEmail,
  AccountLinkingStaleAddress,
  AccountLinkingStats,
  EmailSendStatus,
  StudyRegistryStudentNumberConflict,
} from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import type { TableColumn } from "@/shared-module/components"
import {
  Badge,
  DescriptionList,
  Infobox,
  Menu,
  MeterInline,
  QueryResult,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

import {
  ABSENT,
  ADMIN_PAGE_SIZE_OPTIONS,
  ALIGN_END,
  BADGE_COMPACT,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  STACKED,
  TABLE_STACK,
  TONE,
} from "../constants"
import {
  headingCss,
  codeValueCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionHeaderCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import {
  listingErrorLabel,
  sendStatusLabel,
  verificationMethodLabel,
} from "./adminCreditRegistrationCopy"
import {
  LINKING_STATS_WINDOW_DAYS,
  useAccountLinkingStats,
  useAdminVerifiedStudentNumbers,
  useInvalidateAfterLinkingChange,
} from "./adminCreditRegistrationHooks"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminManualLinkDialog from "./AdminManualLinkDialog"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import { formatSharePercent } from "./percent"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

const CLAIMS_PER_PAGE = 25
const DAY_SECS = 86_400
/** A meter needs a non-zero maximum, and a funnel whose first step is zero has nothing to scale. */
const MIN_FUNNEL_BASE = 1

const ADMIN_MANUAL = "admin_manual"
const SEND_FAILED: EmailSendStatus = "send_failed"
const QUEUED: EmailSendStatus = "queued"
const RESEND_ITEM = "resend"
const LINK_BY_HAND_ITEM = "link-by-hand"
const FETCH_NOW_ITEM = "fetch-now"

/** A step's label beside its bar, so the bars line up in a column of their own. */
const funnelStepCss = css`
  display: grid;
  gap: var(--space-1) var(--space-4);
  grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
  align-items: center;

  @media (max-width: 40rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const funnelCss = css`
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
`

/** Capped, so the count does not sit a screen away from the domain it belongs to. */
const narrowTableCss = css`
  max-width: 24rem;
`

const addressListCss = css`
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
`

interface FunnelStep {
  /** Also the list key: two steps of one funnel never carry the same label. */
  label: string
  value: number
  /** Set where the step is part of the first step's population rather than a route beside it. */
  isShareOfBase?: boolean
}

/**
 * One funnel as a bar list: every step against the first, so where people drop out is the shape of
 * the list rather than a number the reader has to divide.
 */
const FunnelSteps: React.FC<{ steps: readonly FunnelStep[]; base: number }> = ({ steps, base }) => (
  // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role
  <ol className={funnelCss} role="list">
    {steps.map((step) => (
      <li key={step.label} className={funnelStepCss}>
        <span>{step.label}</span>
        <MeterInline
          label={step.label}
          value={step.value}
          maxValue={Math.max(base, MIN_FUNNEL_BASE)}
          valueText={String(step.value)}
          {...includeIf(step.isShareOfBase && base > 0, {
            secondaryText: formatSharePercent(step.value, base),
          })}
        />
      </li>
    ))}
  </ol>
)

/**
 * The number true right now, not about a window: the student-number backlog. Uncarded, as the
 * page's opener — and missing its failure count on purpose, since the tab badge already flags that.
 */
const RightNow: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <StatTileList
      ariaLabel={t("credit-registration-heading-linking-right-now")}
      maxColumns={1}
      size="compact"
    >
      <StatTile
        label={t("credit-registration-admin-waiting-for-number")}
        value={stats.waiting_for_student_number_count}
      />
    </StatTileList>
  )
}

/** A timestamp, or a quiet "not yet" where the student has not done the thing. */
const DoneAt: React.FC<{ at: string | null | undefined }> = ({ at }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return at ? (
    <ZonedTimestamp at={at} />
  ) : (
    <span className={noteCss}>{t("credit-registration-admin-not-yet")}</span>
  )
}

/** Who a student number would unblock, and how far each has got towards linking one. */
const WaitingStudentsBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>
          {t("credit-registration-heading-waiting-for-student-number")}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-waiting-students-shown", {
          shown: stats.waiting_students.length,
          total: stats.waiting_students_total,
        })}
        {stats.account_linking_since &&
          ` ${t("credit-registration-admin-waiting-students-since-note")}`}
      </p>
      <Table
        caption={t("credit-registration-heading-waiting-for-student-number")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.credit_registration_id}
        rows={stats.waiting_students}
        emptyState={t("credit-registration-admin-no-waiting-students")}
        columns={[
          {
            header: t("label-student"),
            minWidth: STUDENT_COLUMN_MIN_WIDTH,
            cell: (row) => (
              <StudentCell
                row={row}
                href={creditRegistrationItemRoute(row.credit_registration_id)}
              />
            ),
          },
          {
            header: t("label-course"),
            grow: true,
            minWidth: "12rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <span>{row.course_name}</span>
                <span className={noteCss}>
                  {[row.course_module_name, row.uh_course_code].filter(Boolean).join(MIDDLE_DOT)}
                </span>
              </span>
            ),
          },
          {
            header: t("label-credit-registration-completed"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <ZonedTimestamp at={row.completion_date} />,
          },
          {
            header: t("label-credit-registration-visited-page"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <DoneAt at={row.last_visited_at} />,
          },
          {
            header: t("label-credit-registration-pressed-enrolled"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <DoneAt at={row.last_check_requested_at} />,
          },
        ]}
      />
    </section>
  )
}

/** Where the window's mails ended up: sent or claimed, beside the links an admin made. */
const WindowFunnel: React.FC<{ stats: AccountLinkingStats; windowDays: number }> = ({
  stats,
  windowDays,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const funnel = stats.funnel
  const steps: FunnelStep[] = [
    {
      label: t("credit-registration-admin-funnel-mails-sent"),
      value: funnel.mails_sent_in_window,
    },
    {
      label: t("credit-registration-admin-funnel-numbers-claimed"),
      value: funnel.numbers_claimed_in_window,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-funnel-manual-links"),
      value: funnel.manual_links_in_window,
    },
  ]
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>
          {t("credit-registration-heading-linking-window", { days: windowDays })}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-funnel-note")}</p>
      <FunnelSteps steps={steps} base={funnel.mails_sent_in_window} />
    </section>
  )
}

/**
 * The last discovery run as a funnel that adds up: every person Sisu listed either took one of the
 * branches below or was mailed, and the mails are the remainder rather than a counter of their own.
 */
const DiscoveryRun: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const funnel = stats.funnel
  const listed = funnel.persons_discovered_last_run
  const branches: FunnelStep[] = [
    {
      label: t("credit-registration-admin-funnel-already-linked"),
      value: funnel.already_linked_last_run,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-suppressed-by-dedup"),
      value: funnel.suppressed_by_dedup_last_run,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-suppressed-by-rate-cap"),
      value: funnel.suppressed_by_rate_cap_last_run,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-no-address-in-registry"),
      value: funnel.no_address_in_study_registry_last_run,
      isShareOfBase: true,
    },
  ]
  const branched = branches.reduce((sum, branch) => sum + branch.value, 0)
  const mailed = Math.max(listed - branched, 0)
  const steps =
    mailed > 0
      ? [
          ...branches,
          {
            label: t("credit-registration-admin-funnel-mailed-this-run"),
            value: mailed,
            isShareOfBase: true,
          },
        ]
      : branches
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-heading-last-discovery-run")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-funnel-listed", { count: listed })}
        </p>
      </div>
      <FunnelSteps steps={steps} base={Math.max(listed, branched + mailed)} />
    </div>
  )
}

/** What our own sender did with the mails, and the domains it could not reach at all. */
const SendStatusBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const totals = stats.send_status_totals
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-admin-send-status-header")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-send-status-our-side-note")}
        </p>
      </div>
      <StatTileList ariaLabel={t("credit-registration-admin-send-status-header")} size="compact">
        <StatTile
          label={t("credit-registration-admin-send-status-waiting-for-link-emails")}
          value={totals.waiting_for_link_emails}
        />
        <StatTile
          label={t("credit-registration-admin-send-status-waiting-for-email-worker")}
          value={totals.waiting_for_email_worker}
        />
        <StatTile
          label={t("credit-registration-admin-send-status-retrying")}
          value={totals.retrying}
        />
        <StatTile label={t("credit-registration-admin-send-status-sent")} value={totals.sent} />
        {/* Not alertWhenNonZero: the tab badge already flags this count, so it needs no second alarm here. */}
        <StatTile
          label={t("credit-registration-admin-send-status-send-failed")}
          value={totals.send_failed}
        />
      </StatTileList>
      {stats.hard_failure_domains.length > 0 && (
        <div className={subsectionCss}>
          <h4 className={subheadingCss}>{t("credit-registration-heading-failure-domains")}</h4>
          <Table
            className={narrowTableCss}
            caption={t("credit-registration-heading-failure-domains")}
            density={DENSITY_COMPACT}
            rowKey={(row) => row.domain}
            rows={stats.hard_failure_domains}
            columns={[
              {
                header: t("label-domain"),
                grow: true,
                cell: (row) => <code className={codeValueCss}>{row.domain}</code>,
              },
              {
                header: t("label-count"),
                align: ALIGN_END,
                nowrap: true,
                cell: (row) => row.count,
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}

/** Why listed people on the code got no mail on its last fetch; a counter of zero says nothing. */
const CourseCodeBreakdown: React.FC<{ row: AccountLinkingCourseCode }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const linking = row.linking
  const counters: { label: string; value: number }[] = linking
    ? [
        {
          label: t("credit-registration-admin-funnel-already-linked"),
          value: linking.already_linked_count,
        },
        {
          label: t("credit-registration-admin-suppressed-by-dedup"),
          value: linking.suppressed_by_dedup_count,
        },
        {
          label: t("credit-registration-admin-suppressed-by-rate-cap"),
          value: linking.suppressed_by_rate_cap_count,
        },
        {
          label: t("credit-registration-admin-no-address-in-registry"),
          value: linking.no_address_count,
        },
      ]
    : []
  const nonZero = counters.filter((counter) => counter.value > 0)
  if (nonZero.length === 0) {
    return <p className={noteCss}>{t("credit-registration-admin-nothing-held-a-mail-back")}</p>
  }
  return (
    <DescriptionList
      layout={STACKED}
      items={nonZero.map((counter) => ({ label: counter.label, value: counter.value }))}
    />
  )
}

/** Brings one code's enrolment list forward to its next fetch slot. */
const FetchNowAction: React.FC<{ courseCode: string }> = ({ courseCode }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const { confirm } = useDialog()
  const mutation = useToastMutation(
    () => adminRequestEnrolmentListFetch({ body: { course_code: courseCode } }),
    { notify: true, method: "POST" },
    {
      onSuccess: () =>
        void queryClient.invalidateQueries({ queryKey: getAccountLinkingStatsQueryKey() }),
    },
  )
  return (
    <Menu
      aria-label={t("credit-registration-admin-row-actions", { student: courseCode })}
      items={[
        {
          key: FETCH_NOW_ITEM,
          label: t("button-text-fetch-enrolment-list-now"),
          isDisabled: mutation.isPending,
          onAction: async () => {
            const confirmed = await confirm(
              t("credit-registration-admin-fetch-now-confirm", { code: courseCode }),
              undefined,
              { yesButtonLabel: t("button-text-fetch-enrolment-list-now") },
            )
            if (confirmed) {
              mutation.mutate()
            }
          },
        },
      ]}
    />
  )
}

const CourseCodeBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-heading-course-codes")}</h3>
        <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-course-codes-note")}</p>
      </div>
      <Table
        caption={t("credit-registration-heading-course-codes")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.course_code}
        rows={stats.course_codes}
        emptyState={t("credit-registration-admin-no-roster-codes")}
        expandableRow={(row) => <CourseCodeBreakdown row={row} />}
        columns={[
          {
            header: t("credit-registration-admin-column-course-code"),
            grow: true,
            minWidth: "14rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <code className={codeValueCss}>{row.course_code}</code>
                {row.modules.map((module) => (
                  <span key={module.course_module_id} className={noteCss}>
                    {[module.course_name, module.course_module_name]
                      .filter(Boolean)
                      .join(MIDDLE_DOT)}
                  </span>
                ))}
              </span>
            ),
          },
          {
            header: t("credit-registration-admin-column-waiting-for-student-number"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: false,
            cell: (row) => row.waiting_count,
          },
          {
            header: t("credit-registration-admin-column-last-fetched"),
            minWidth: "9rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <ZonedTimestamp at={row.last_fetched_at} />
                {row.last_listed_person_count !== null &&
                  row.last_listed_person_count !== undefined && (
                    <span className={noteCss}>
                      {t("credit-registration-admin-listed-count", {
                        count: row.last_listed_person_count,
                      })}
                    </span>
                  )}
              </span>
            ),
          },
          {
            header: t("credit-registration-admin-column-next-fetch"),
            minWidth: "9rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <ZonedTimestamp at={row.next_fetch_at} />
                {row.fetch_requested_at && (
                  <span className={noteCss}>{t("credit-registration-admin-fetch-requested")}</span>
                )}
              </span>
            ),
          },
          {
            // Nothing when the fetches work: a badge on every row is a badge nobody reads.
            header: t("label-credit-registration-listing-health"),
            minWidth: "10rem",
            cell: (row) =>
              row.consecutive_failures > 0 ? (
                <span className={stackedCellCss}>
                  <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
                    {t("credit-registration-admin-listing-failing", {
                      count: row.consecutive_failures,
                    })}
                  </Badge>
                  {row.last_error && (
                    <span className={noteCss}>{listingErrorLabel(t, row.last_error)}</span>
                  )}
                  {row.retry_not_before && (
                    <span className={noteCss}>
                      {t("credit-registration-admin-enrolment-checks-backoff-note")}{" "}
                      <ZonedTimestamp at={row.retry_not_before} />
                    </span>
                  )}
                </span>
              ) : null,
          },
          {
            header: t("credit-registration-admin-funnel-discovered"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: false,
            cell: (row) => row.linking?.listed_person_count ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-funnel-mails-claimed"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: false,
            cell: (row) => row.linking?.mailed_count ?? ABSENT,
          },
          {
            header: t("label-actions"),
            minWidth: "5rem",
            cell: (row) => <FetchNowAction courseCode={row.course_code} />,
          },
        ]}
      />
    </div>
  )
}

/** Where one linking email stands on our side: queued by which process, sent, or failing. */
const RecentEmailStatus: React.FC<{ row: AccountLinkingRecentEmail }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const report = row.send_status
  if (!report) {
    return (
      <span className={noteCss}>
        {t("credit-registration-admin-send-status-waiting-for-link-emails")}
      </span>
    )
  }
  if (report.email_send_status === QUEUED) {
    return (
      <span className={noteCss}>
        {t("credit-registration-admin-send-status-waiting-for-email-worker")}
      </span>
    )
  }
  return (
    <span className={stackedCellCss}>
      {report.email_send_status === SEND_FAILED ? (
        <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
          {sendStatusLabel(t, report.email_send_status)}
        </Badge>
      ) : (
        <span>{sendStatusLabel(t, report.email_send_status)}</span>
      )}
      <ZonedTimestamp at={report.sent_at ?? report.last_attempt_at} />
    </span>
  )
}

/** The newest linking emails one by one, behind the send-status totals. */
const RecentLinkingEmailsBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-heading-recent-linking-emails")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-recent-linking-emails-note")}
        </p>
      </div>
      <Table
        caption={t("credit-registration-heading-recent-linking-emails")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.id}
        rows={stats.recent_linking_emails}
        emptyState={t("credit-registration-admin-no-linking-emails")}
        columns={[
          {
            header: t("label-course"),
            grow: true,
            minWidth: "10rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <span>{row.course_name}</span>
                <span className={noteCss}>{row.emailed_to_masked}</span>
              </span>
            ),
          },
          {
            header: t("label-credit-registration-claimed-at"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <ZonedTimestamp at={row.claimed_at} />,
          },
          {
            header: t("label-credit-registration-queued-at"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <ZonedTimestamp at={row.queued_at} />,
          },
          {
            header: t("credit-registration-admin-send-status-header"),
            minWidth: "10rem",
            cell: (row) => <RecentEmailStatus row={row} />,
          },
          {
            header: t("label-credit-registration-last-error"),
            minWidth: "12rem",
            nowrap: false,
            cell: (row) =>
              row.last_error_message ? (
                <span className={cx(noteCss, codeValueCss)}>{row.last_error_message}</span>
              ) : (
                ABSENT
              ),
          },
        ]}
      />
    </div>
  )
}

/** Both remedies for one stale row, out of the row's way until they are asked for. */
const StaleAddressActions: React.FC<{
  row: AccountLinkingStaleAddress
  canResend: boolean
}> = ({ row, canResend }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [isResendOpen, setResendOpen] = useState(false)
  const [isLinkOpen, setLinkOpen] = useState(false)
  const resendItem = {
    key: RESEND_ITEM,
    label: t("button-text-resend-linking-email"),
    onAction: () => setResendOpen(true),
  }
  const linkItem = {
    key: LINK_BY_HAND_ITEM,
    label: t("credit-registration-admin-manual-link-title"),
    onAction: () => setLinkOpen(true),
  }
  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-row-actions", { student: row.student_number })}
        items={canResend ? [resendItem, linkItem] : [linkItem]}
      />
      <AdminResendLinkingEmailDialog
        open={isResendOpen}
        onClose={() => setResendOpen(false)}
        studentNumber={row.student_number}
        courseId={row.course_id}
        courseName={row.course_name}
      />
      {isLinkOpen && (
        <AdminManualLinkDialog
          open
          onClose={() => setLinkOpen(false)}
          studentNumber={row.student_number}
        />
      )}
    </>
  )
}

/** The addresses one person's mails went to, kept off the row until the reader asks for them. */
const StaleAddressSends: React.FC<{ row: AccountLinkingStaleAddress }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role
    <ul className={addressListCss} role="list">
      {row.sends.map((send, index) => (
        <li key={`${send.address}:${index}`} className={rowCss}>
          <span>{send.address}</span>
          {/* Only the failed send is an exception worth a pill; a sent or queued one is routine. */}
          {send.send_status === SEND_FAILED ? (
            <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
              {sendStatusLabel(t, send.send_status)}
            </Badge>
          ) : (
            <span className={noteCss}>{sendStatusLabel(t, send.send_status)}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** The people mail cannot reach, one line each: the work list this page exists for. */
const StaleAddressBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const addressSummary = (row: AccountLinkingStaleAddress): string => {
    const addressCount = new Set(row.sends.map((send) => send.address)).size
    return row.sends.some((send) => send.send_status === SEND_FAILED)
      ? t("credit-registration-admin-addresses-sending-failed", { count: addressCount })
      : t("credit-registration-admin-addresses-all-sent", { count: addressCount })
  }
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>
          {t("credit-registration-heading-stale-addresses", {
            max: stats.max_mails_per_person_and_course,
          })}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-stale-addresses-note")}</p>
      <Table
        caption={t("credit-registration-heading-stale-addresses", {
          max: stats.max_mails_per_person_and_course,
        })}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.student_number}:${row.course_id}`}
        rows={stats.stale_addresses}
        emptyState={t("credit-registration-admin-no-stale-addresses")}
        expandableRow={(row) => <StaleAddressSends row={row} />}
        columns={[
          {
            header: t("label-student-number"),
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => <span className={codeValueCss}>{row.student_number}</span>,
          },
          {
            header: t("label-course"),
            grow: true,
            minWidth: "12rem",
            cell: (row) => row.course_name,
          },
          {
            header: t("label-credit-registration-addresses-tried"),
            minWidth: "10rem",
            cell: (row) => addressSummary(row),
          },
          {
            header: t("label-credit-registration-last-sent"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <ZonedTimestamp at={row.last_sent_at} />,
          },
          {
            header: t("label-actions"),
            minWidth: "5rem",
            cell: (row) => (
              <StaleAddressActions row={row} canResend={stats.account_linking_enabled} />
            ),
          },
        ]}
      />
      <div className={rowCss}>
        <AdminManualLinkButton />
      </div>
    </section>
  )
}

const DismissConflictAction: React.FC<{ row: StudyRegistryStudentNumberConflict }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const { item, dialog } = useReasonConfirmAction({
    mutationFn: (fields) =>
      adminDismissStudyRegistryConflict({
        path: { conflict_id: row.id },
        body: { reason: fields.reason },
      }),
    invalidate: () =>
      void queryClient.invalidateQueries({ queryKey: getAccountLinkingStatsQueryKey() }),
    buttonLabel: t("button-text-dismiss"),
    dialogTitle: t("credit-registration-admin-dismiss-conflict-title"),
    dialogMessage: t("credit-registration-admin-dismiss-conflict-warning", {
      number: row.reported_student_number,
    }),
  })
  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-row-actions", {
          student: row.reported_student_number,
        })}
        items={[item]}
      />
      {dialog}
    </>
  )
}

/** Numbers the study registry reported that an existing link kept us from linking. */
const StudyRegistryConflictBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-study-registry-conflicts")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-study-registry-conflicts-note")}
      </p>
      <Table<StudyRegistryStudentNumberConflict>
        caption={t("credit-registration-heading-study-registry-conflicts")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.id}
        rows={stats.study_registry_conflicts}
        emptyState={t("credit-registration-admin-no-study-registry-conflicts")}
        columns={[
          {
            header: t("label-student"),
            minWidth: STUDENT_COLUMN_MIN_WIDTH,
            cell: (row) => <StudentCell row={{ ...row, email: row.user_email ?? null }} />,
          },
          {
            header: t("label-credit-registration-reported-student-number"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <span className={codeValueCss}>{row.reported_student_number}</span>,
          },
          {
            header: t("label-course"),
            grow: true,
            minWidth: "10rem",
            cell: (row) => row.course_name,
          },
          {
            header: t("label-credit-registration-conflicting-link"),
            minWidth: "12rem",
            cell: (row) => (
              <div className={stackedCellCss}>
                <span className={codeValueCss}>{row.conflicting_link_student_number}</span>
                <span className={noteCss}>
                  {[
                    row.conflicting_link_user_id === row.user_id
                      ? t("credit-registration-admin-conflict-same-account")
                      : (row.conflicting_link_user_email ?? row.conflicting_link_user_id),
                    verificationMethodLabel(t, row.conflicting_link_verified_via),
                  ]
                    .filter(Boolean)
                    .join(MIDDLE_DOT)}
                </span>
              </div>
            ),
          },
          {
            header: t("label-credit-registration-reported-at"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <ZonedTimestamp at={row.created_at} />,
          },
          {
            header: t("label-actions"),
            minWidth: "5rem",
            cell: (row) => <DismissConflictAction row={row} />,
          },
        ]}
      />
    </section>
  )
}

const UnlinkAction: React.FC<{ verifiedStudentNumberId: string; number: string }> = ({
  verifiedStudentNumberId,
  number,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateAfterLinkingChange = useInvalidateAfterLinkingChange()
  const { item, dialog } = useReasonConfirmAction({
    mutationFn: (fields) =>
      adminUnlinkStudentNumber({
        path: { verified_student_number_id: verifiedStudentNumberId },
        body: { reason: fields.reason },
      }),
    // Unlinking recomputes preconditions synchronously, so registration state moves too.
    invalidate: () => void invalidateAfterLinkingChange(),
    buttonLabel: t("button-text-unlink"),
    dialogTitle: t("button-text-unlink"),
    dialogMessage: t("credit-registration-admin-unlink-warning", { number }),
    isDestructive: true,
  })

  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-row-actions", { student: number })}
        items={[item]}
      />
      {dialog}
    </>
  )
}

const RecentClaimsBlock: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const paginationInfo = usePaginationInfo(CLAIMS_PER_PAGE)
  const numbersQuery = useAdminVerifiedStudentNumbers({
    page: paginationInfo.page,
    limit: paginationInfo.limit,
  })
  return (
    <div className={subsectionCss}>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-claiming-address-differs-note")}
      </p>
      <QueryResult
        query={numbersQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={subsectionCss}
      >
        {(page) => {
          // Only manual links carry one, so on most pages the column would be empty end to end.
          const reasonColumn: TableColumn<(typeof page.data)[number]>[] = page.data.some(
            (row) => row.link_reason,
          )
            ? [
                {
                  header: t("label-reason"),
                  grow: true,
                  minWidth: "14rem",
                  nowrap: false,
                  cell: (row) => row.link_reason ?? ABSENT,
                },
              ]
            : []
          return (
            <>
              <Table
                caption={t("credit-registration-heading-recent-claims")}
                density={DENSITY_COMPACT}
                responsive={TABLE_STACK}
                rowKey={(row) => row.id}
                rows={page.data}
                emptyState={t("credit-registration-admin-no-links-yet")}
                columns={[
                  {
                    header: t("label-student-number"),
                    minWidth: "7rem",
                    nowrap: true,
                    cell: (row) => <span className={codeValueCss}>{row.student_number}</span>,
                  },
                  {
                    header: t("label-student"),
                    grow: reasonColumn.length === 0,
                    minWidth: STUDENT_COLUMN_MIN_WIDTH,
                    cell: (row) => <StudentCell row={{ ...row, email: row.user_email ?? null }} />,
                  },
                  {
                    header: t("label-credit-registration-verified-via"),
                    minWidth: "12rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        {/* A pill only for the exception: an admin having to link by hand, not the two
                            self-service routes a claim normally takes. */}
                        {row.verified_via === ADMIN_MANUAL ? (
                          <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
                            {verificationMethodLabel(t, row.verified_via) ?? row.verified_via}
                          </Badge>
                        ) : (
                          <span>
                            {verificationMethodLabel(t, row.verified_via) ?? row.verified_via}
                          </span>
                        )}
                        <span className={noteCss}>{row.verified_via_email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-time"),
                    minWidth: "8rem",
                    nowrap: true,
                    cell: (row) => <ZonedTimestamp at={row.verified_at} />,
                  },
                  ...reasonColumn,
                  {
                    header: t("label-actions"),
                    minWidth: "5rem",
                    cell: (row) => (
                      <UnlinkAction verifiedStudentNumberId={row.id} number={row.student_number} />
                    ),
                  },
                ]}
              />
              <Pagination
                paginationInfo={paginationInfo}
                totalPages={page.total_pages}
                totalItems={page.total_count}
                itemsPerPageOptions={ADMIN_PAGE_SIZE_OPTIONS}
              />
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

/** What our sender did with the mails, the last discovery run, and each code's enrolment list: diagnostics for the funnel above. */
const LinkingDetailsSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-linking-details")}</h2>
      </div>
      <SendStatusBlock stats={stats} />
      <RecentLinkingEmailsBlock stats={stats} />
      <DiscoveryRun stats={stats} />
      <CourseCodeBlock stats={stats} />
    </section>
  )
}

const RecentClaimsSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const manualLinkTotal =
    stats.links_total_by_method.find((row) => row.verified_via === ADMIN_MANUAL)?.count ?? 0
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-recent-claims")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-manual-links-total-count", { count: manualLinkTotal })}
      </p>
      <RecentClaimsBlock />
    </section>
  )
}

/** How a student number reaches an account, and who is stuck on the way. */
const AccountLinkingSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const statsQuery = useAccountLinkingStats(LINKING_STATS_WINDOW_DAYS)

  return (
    <QueryResult
      query={statsQuery}
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionCardsCss}
    >
      {(stats) => {
        // From the response, not the request: the endpoint decides what window it measured.
        const windowDays = Math.round(stats.window_secs / DAY_SECS)
        return (
          <>
            {!stats.account_linking_enabled && (
              <Infobox>{t("credit-registration-admin-account-linking-disabled")}</Infobox>
            )}
            {stats.account_linking_since && (
              <p className={noteCss}>
                {t("credit-registration-admin-account-linking-since", {
                  time: formatZonedTimestamp(new Date(stats.account_linking_since)),
                })}
              </p>
            )}
            <RightNow stats={stats} />
            <WaitingStudentsBlock stats={stats} />
            <WindowFunnel stats={stats} windowDays={windowDays} />
            <StudyRegistryConflictBlock stats={stats} />
            <StaleAddressBlock stats={stats} />
            <LinkingDetailsSection stats={stats} />
            <RecentClaimsSection stats={stats} />
          </>
        )
      }}
    </QueryResult>
  )
}

export default AccountLinkingSection
