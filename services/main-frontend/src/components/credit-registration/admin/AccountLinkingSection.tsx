"use client"

import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight } from "@vectopus/atlas-icons-react"
import React, { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  formatZonedTimestamp,
  ZonedTimestamp,
} from "@/components/credit-registration/ZonedTimestamp"
import { getAccountLinkingStatsQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import {
  adminDismissStudyRegistryConflict,
  adminUnlinkStudentNumber,
} from "@/generated/api/sdk.generated"
import type {
  AccountLinkingCourseCode,
  AccountLinkingPresser,
  AccountLinkingRecentEmail,
  AccountLinkingStaleAddress,
  AccountLinkingStats,
  EmailSendStatus,
  StudentNumberVerificationMethod,
  StudyRegistryStudentNumberConflict,
  TimelinePhase,
  TimelineStep,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import type { MenuItemDescriptor, StatTileDeltaTone, TableColumn } from "@/shared-module/components"
import {
  Badge,
  Disclosure,
  Infobox,
  Link,
  Menu,
  QueryResult,
  RelativeTime,
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
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_DURATION,
  TIME_IN_TITLE,
  TONE,
} from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import {
  codeValueCss,
  headingCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import {
  enrolmentRouteLabel,
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
import {
  attentionPhaseAnchorId,
  courseCodeAnchorId,
  needsAttentionHref,
  phaseHref,
} from "./adminLinks"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminManualLinkDialog from "./AdminManualLinkDialog"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import FacetChip from "./FacetChip"
import FetchEnrolmentListNowButton from "./FetchEnrolmentListNowButton"
import { isUnhealthyPhase, phaseHealth, phaseHealthLabel } from "./phaseStatus"
import { registrationsListHref } from "./registrationsListUrl"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"
import { ENGAGEMENTS, engagementLabel } from "./timelineSteps"
import { useHashTarget, useOpenedByLink } from "./useHashTarget"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

const CLAIMS_PER_PAGE = 25
const DAY_SECS = 86_400
const ARROW_SIZE = 14

const SEND_FAILED: EmailSendStatus = "send_failed"
const QUEUED: EmailSendStatus = "queued"
const RESEND_ITEM = "resend"
const LINK_BY_HAND_ITEM = "link-by-hand"

/** The two ways a link is made one by one; the study registry import is reported as a total. */
const RECENT_LINK_METHODS = [
  "emailed_link",
  "admin_manual",
] as const satisfies readonly StudentNumberVerificationMethod[]
const STUDY_REGISTRY: StudentNumberVerificationMethod = "study_registry"

const STUCK_DELTA_TONE: StatTileDeltaTone = "negative"
const WAITING_FOR_STUDENT_NUMBER: TimelineStep = "waiting_for_student_number"
const WAITING_FOR_STUDENT_NUMBER_PHASE: TimelinePhase = "student_number"

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

const arrowLinkCss = css`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
`

const healthListCss = css`
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-5);
`

/** A count left empty at zero, so the counts that matter stand out. */
const nonZero = (count: number | null | undefined): number | null =>
  count === null || count === undefined || count === 0 ? null : count

/** What stops linking emails going out, when anything does; nothing when all is well. */
const HealthBanner: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const stoppedPhases = stats.processing_phases.filter((phase) => {
    const health = phaseHealth(phase)
    return health === "paused" || isUnhealthyPhase(health)
  })
  const failingCodes = stats.course_codes.filter(
    (code) => code.is_fetch_failing && code.pressed_waiting_count > 0,
  )
  if (stats.account_linking_enabled && stoppedPhases.length === 0 && failingCodes.length === 0) {
    return null
  }
  return (
    <Infobox tone={TONE.WARNING}>
      <ul className={healthListCss}>
        {!stats.account_linking_enabled && (
          <li>{t("credit-registration-admin-account-linking-disabled")}</li>
        )}
        {stoppedPhases.map((phase) => (
          <li key={phase.phase}>
            {phase.paused_at
              ? t("credit-registration-admin-linking-health-phase-paused", {
                  phase: phase.phase,
                  time: formatZonedTimestamp(new Date(phase.paused_at)),
                })
              : t("credit-registration-admin-linking-health-phase-unhealthy", {
                  phase: phase.phase,
                  health: phaseHealthLabel(t, phaseHealth(phase)),
                })}{" "}
            {phase.pause_reason && `${phase.pause_reason} `}
            <Link href={phaseHref(phase.phase)}>
              {t("credit-registration-admin-problem-see-phase")}
            </Link>
          </li>
        ))}
        {failingCodes.map((code) => (
          <li key={code.course_code}>
            {t("credit-registration-admin-linking-health-code-failing", {
              code: code.course_code,
              count: code.pressed_waiting_count,
            })}{" "}
            <Link href={`#${courseCodeAnchorId(code.course_code)}`}>
              {t("credit-registration-admin-problem-see-course-code")}
            </Link>
          </li>
        ))}
      </ul>
    </Infobox>
  )
}

/** Where a presser's linking email stands, from what is known about their course code. */
const presserStatus = (t: CreditRegistrationTFunction, row: AccountLinkingPresser): string => {
  if (row.is_stuck) {
    return t("credit-registration-admin-presser-stuck")
  }
  if (row.is_fetch_failing) {
    return t("credit-registration-admin-presser-fetch-failing")
  }
  if (row.is_enrolment_list_empty) {
    return t("credit-registration-admin-status-enrolment-list-empty")
  }
  if (row.linking_emails_on_code_since_press > 0) {
    return t("credit-registration-admin-status-linking-email-went-out")
  }
  return row.next_fetch_at
    ? t("credit-registration-admin-presser-next-fetch", {
        time: formatZonedTimestamp(new Date(row.next_fetch_at)),
      })
    : t("credit-registration-admin-status-waiting-for-linking-email")
}

const PresserStatusCell: React.FC<{ row: AccountLinkingPresser }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      <span>{presserStatus(t, row)}</span>
      {row.is_stuck && (
        <Link
          href={needsAttentionHref(attentionPhaseAnchorId(WAITING_FOR_STUDENT_NUMBER_PHASE))}
          prefetch={false}
          className={arrowLinkCss}
        >
          {t("credit-registration-admin-handled-in-needs-attention")}
          <ArrowRight size={ARROW_SIZE} aria-hidden />
        </Link>
      )}
    </span>
  )
}

/** Students who pressed "I have enrolled" and still have no linked student number, stuck first. */
const PressersSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-pressers")}
        </h2>
      </div>
      <Table
        labelledBy={headingId}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.credit_registration_id}
        rows={stats.pressers}
        emptyState={t("credit-registration-admin-no-pressers")}
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
            minWidth: "11rem",
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
            header: t("label-credit-registration-how-they-enrolled"),
            minWidth: "9rem",
            cell: (row) => enrolmentRouteLabel(t, row.enrolment_route) ?? ABSENT,
          },
          {
            header: t("label-credit-registration-pressed"),
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.pressed_at} absoluteTime={TIME_IN_TITLE} />,
          },
          {
            header: t("credit-registration-admin-column-enrolment-list"),
            minWidth: "9rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <span>
                  {t("credit-registration-admin-fetch-last")}{" "}
                  <RelativeTime at={row.last_fetched_at} absoluteTime={TIME_IN_TITLE} />
                </span>
                <span className={noteCss}>
                  {t("credit-registration-admin-fetch-next")}{" "}
                  <RelativeTime at={row.next_fetch_at} absoluteTime={TIME_IN_TITLE} />
                </span>
              </span>
            ),
          },
          {
            header: t("label-status"),
            grow: 2,
            minWidth: "16rem",
            cell: (row) => <PresserStatusCell row={row} />,
          },
          {
            header: t("label-actions"),
            minWidth: "6rem",
            cell: (row) =>
              row.uh_course_code ? (
                <FetchEnrolmentListNowButton courseCode={row.uh_course_code} />
              ) : null,
          },
        ]}
      />
    </section>
  )
}

/** Students waiting for a student number since the cutoff, by what they have done. */
const WaitingCounts: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const counts = stats.engagement_counts
  return (
    <StatTileList ariaLabel={t("credit-registration-heading-waiting-for-student-number")}>
      {ENGAGEMENTS.map((engagement) => (
        <StatTile
          key={engagement}
          label={engagementLabel(t, engagement)}
          value={counts[engagement]}
          href={registrationsListHref({
            steps: [WAITING_FOR_STUDENT_NUMBER],
            engagements: [engagement],
          })}
          {...(engagement === "pressed" && counts.pressed_stuck > 0
            ? {
                delta: t("credit-registration-admin-stuck-count", { count: counts.pressed_stuck }),
                deltaTone: STUCK_DELTA_TONE,
              }
            : {})}
        />
      ))}
    </StatTileList>
  )
}

/** Links that went out and can still be used, oldest first. */
const UnusedLinksBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  if (stats.unused_links.length === 0) {
    return null
  }
  return (
    <div className={subsectionCss}>
      <h3 id={headingId} className={subheadingCss}>
        {t("credit-registration-heading-unused-links")}
      </h3>
      <Table
        labelledBy={headingId}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.id}
        rows={stats.unused_links}
        columns={[
          {
            header: t("label-course"),
            grow: true,
            minWidth: "12rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <span>{row.course_name}</span>
                {row.uh_course_code && (
                  <code className={cx(noteCss, codeValueCss)}>{row.uh_course_code}</code>
                )}
              </span>
            ),
          },
          {
            header: t("credit-registration-admin-column-link-age"),
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.claimed_at} absoluteTime={TIME_DURATION} />,
          },
          {
            header: t("credit-registration-admin-column-link-expires"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.expires_at} absoluteTime={TIME_IN_TITLE} />,
          },
        ]}
      />
    </div>
  )
}

/** Recipient domains our sender could not reach at all. */
const FailureDomainsBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  if (stats.hard_failure_domains.length === 0) {
    return null
  }
  return (
    <div className={subsectionCss}>
      <h3 id={headingId} className={subheadingCss}>
        {t("credit-registration-heading-failure-domains")}
      </h3>
      <Table
        className={narrowTableCss}
        labelledBy={headingId}
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
  )
}

/** The window's linking emails in a few numbers, with the lists behind them collapsed. */
const LinkingEmailsSection: React.FC<{ stats: AccountLinkingStats; windowDays: number }> = ({
  stats,
  windowDays,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const totals = stats.send_status_totals
  const notSentYet =
    totals.waiting_for_link_emails + totals.waiting_for_email_worker + totals.retrying
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-linking-emails")}
        </h2>
        <p className={noteCss}>
          {t("credit-registration-heading-linking-window", { days: windowDays })}
        </p>
      </div>
      <StatTileList ariaLabel={t("credit-registration-heading-linking-emails")} size="compact">
        <StatTile label={t("credit-registration-admin-send-status-sent")} value={totals.sent} />
        <StatTile label={t("credit-registration-admin-links-used")} value={totals.used} />
        <StatTile
          label={t("credit-registration-admin-send-status-send-failed")}
          value={totals.send_failed}
          alertWhenNonZero
        />
        {notSentYet > 0 && (
          <StatTile label={t("credit-registration-admin-not-sent-yet")} value={notSentYet} />
        )}
      </StatTileList>
      <UnusedLinksBlock stats={stats} />
      <FailureDomainsBlock stats={stats} />
      {stats.stale_addresses.length > 0 && <StaleAddressBlock stats={stats} />}
      <RecentLinkingEmailsBlock stats={stats} />
    </section>
  )
}

/** The people a code's last fetch found and what happened to each; zeros left out. */
const CourseCodeFindings: React.FC<{ row: AccountLinkingCourseCode }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const findings = [
    { label: t("credit-registration-admin-found-mailed"), value: row.linking?.mailed_count },
    { label: t("credit-registration-admin-found-unused-link"), value: row.unused_link_count },
    {
      label: t("credit-registration-admin-found-no-address"),
      value: row.linking?.no_address_count,
    },
    {
      label: t("credit-registration-admin-found-already-linked"),
      value: row.linking?.already_linked_count,
    },
  ].filter((finding) => nonZero(finding.value) !== null)
  return (
    <span className={stackedCellCss}>
      {findings.map((finding) => (
        <span key={finding.label}>
          {finding.label}: {finding.value}
        </span>
      ))}
    </span>
  )
}

const CourseCodeCell: React.FC<{ row: AccountLinkingCourseCode }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span id={courseCodeAnchorId(row.course_code)} className={stackedCellCss}>
      <code className={codeValueCss}>{row.course_code}</code>
      {row.modules.map((module) => (
        <span key={module.course_module_id} className={noteCss}>
          {[module.course_name, module.course_module_name].filter(Boolean).join(MIDDLE_DOT)}
        </span>
      ))}
      {(row.is_enrolment_list_empty || row.is_fetch_failing) && (
        <span className={rowCss}>
          {row.is_enrolment_list_empty && (
            <Badge tone={TONE.WARNING} size={BADGE_COMPACT}>
              {t("credit-registration-admin-enrolment-list-empty")}
            </Badge>
          )}
          {row.is_fetch_failing && (
            <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
              {t("credit-registration-admin-fetch-failing")}
            </Badge>
          )}
        </span>
      )}
      {row.is_fetch_failing && row.last_error && (
        <span className={noteCss}>{listingErrorLabel(t, row.last_error)}</span>
      )}
      {row.retry_not_before && (
        <span className={noteCss}>
          {t("credit-registration-admin-enrolment-checks-backoff-note")}{" "}
          <RelativeTime at={row.retry_not_before} absoluteTime={TIME_IN_TITLE} />
        </span>
      )}
    </span>
  )
}

const CourseCodeTable: React.FC<{ rows: AccountLinkingCourseCode[]; labelledBy: string }> = ({
  rows,
  labelledBy,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <Table
      labelledBy={labelledBy}
      density={DENSITY_COMPACT}
      responsive={TABLE_STACK}
      rowKey={(row) => row.course_code}
      rows={rows}
      emptyState={t("credit-registration-admin-no-roster-codes")}
      columns={[
        {
          header: t("credit-registration-admin-column-course-code"),
          grow: true,
          minWidth: "14rem",
          cell: (row) => <CourseCodeCell row={row} />,
        },
        {
          header: t("credit-registration-admin-column-pressed-waiting"),
          align: ALIGN_END,
          minWidth: "7rem",
          cell: (row) => nonZero(row.pressed_waiting_count),
        },
        {
          header: t("credit-registration-admin-column-last-fetched"),
          minWidth: "9rem",
          cell: (row) => (
            <span className={stackedCellCss}>
              <RelativeTime at={row.last_fetched_at} absoluteTime={TIME_IN_TITLE} />
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
              <RelativeTime at={row.next_fetch_at} absoluteTime={TIME_IN_TITLE} />
              {row.fetch_requested_at && (
                <span className={noteCss}>{t("credit-registration-admin-fetch-requested")}</span>
              )}
            </span>
          ),
        },
        {
          header: t("credit-registration-admin-column-on-enrolment-list"),
          align: ALIGN_END,
          minWidth: "7rem",
          cell: (row) => nonZero(row.linking?.listed_person_count),
        },
        {
          header: t("credit-registration-admin-column-what-happened"),
          minWidth: "12rem",
          cell: (row) => <CourseCodeFindings row={row} />,
        },
        {
          header: t("label-actions"),
          minWidth: "6rem",
          cell: (row) => <FetchEnrolmentListNowButton courseCode={row.course_code} />,
        },
      ]}
    />
  )
}

const byPressersWaiting = (a: AccountLinkingCourseCode, b: AccountLinkingCourseCode): number =>
  b.pressed_waiting_count - a.pressed_waiting_count ||
  Number(b.is_fetch_failing) - Number(a.is_fetch_failing) ||
  a.course_code.localeCompare(b.course_code)

const isWorthALook = (row: AccountLinkingCourseCode): boolean =>
  row.pressed_waiting_count > 0 || row.is_fetch_failing

/** Each code's enrolment list, the codes someone waits on or that fail first; the rest collapsed. */
const CourseCodesSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const othersHeadingId = useId()
  const sorted = stats.course_codes.toSorted(byPressersWaiting)
  const active = sorted.filter((row) => isWorthALook(row))
  const others = sorted.filter((row) => !isWorthALook(row))
  const hash = useHashTarget(true)
  const othersExpansion = useOpenedByLink(
    others.some((row) => courseCodeAnchorId(row.course_code) === hash),
  )
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-course-codes")}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-course-codes-note")}</p>
      {active.length > 0 && <CourseCodeTable rows={active} labelledBy={headingId} />}
      {others.length > 0 && (
        <Disclosure
          title={
            <span id={othersHeadingId}>
              {t("credit-registration-admin-other-course-codes", { count: others.length })}
            </span>
          }
          variant={PLAIN_DISCLOSURE}
          {...othersExpansion}
        >
          <CourseCodeTable rows={others} labelledBy={othersHeadingId} />
        </Disclosure>
      )}
    </section>
  )
}

/** Students without a linked number who have not pressed "I have enrolled", for support lookups. */
const OtherWaitingStudentsSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const rows = stats.waiting_students.filter((row) => row.engagement !== "pressed")
  const total = stats.engagement_counts.visited + stats.engagement_counts.not_started
  if (total === 0) {
    return null
  }
  return (
    <section className={sectionCardCss}>
      <Disclosure
        title={
          <span id={headingId}>
            {t("credit-registration-heading-other-waiting-students", { count: total })}
          </span>
        }
        variant={PLAIN_DISCLOSURE}
      >
        <div className={sectionCss}>
          {rows.length < total && (
            <p className={noteCss}>
              {t("credit-registration-admin-waiting-students-shown", {
                shown: rows.length,
                total,
              })}
            </p>
          )}
          <Table
            labelledBy={headingId}
            density={DENSITY_COMPACT}
            responsive={TABLE_STACK}
            rowKey={(row) => row.credit_registration_id}
            rows={rows}
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
                      {[row.course_module_name, row.uh_course_code]
                        .filter(Boolean)
                        .join(MIDDLE_DOT)}
                    </span>
                  </span>
                ),
              },
              {
                header: t("credit-registration-admin-student-activity"),
                minWidth: "8rem",
                cell: (row) => engagementLabel(t, row.engagement),
              },
              {
                header: t("label-credit-registration-completed"),
                minWidth: "8rem",
                nowrap: true,
                cell: (row) => (
                  <RelativeTime at={row.completion_date} absoluteTime={TIME_IN_TITLE} />
                ),
              },
              {
                header: t("label-credit-registration-visited-page"),
                minWidth: "8rem",
                nowrap: true,
                cell: (row) =>
                  row.last_visited_at ? (
                    <RelativeTime at={row.last_visited_at} absoluteTime={TIME_IN_TITLE} />
                  ) : null,
              },
            ]}
          />
        </div>
      </Disclosure>
    </section>
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

/** The newest linking emails one by one, collapsed behind the totals. */
const RecentLinkingEmailsBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <Disclosure
      title={<span id={headingId}>{t("credit-registration-heading-recent-linking-emails")}</span>}
      variant={PLAIN_DISCLOSURE}
    >
      <div className={subsectionCss}>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-recent-linking-emails-note")}
        </p>
        <Table
          labelledBy={headingId}
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
              cell: (row) => <RelativeTime at={row.claimed_at} absoluteTime={TIME_IN_TITLE} />,
            },
            {
              header: t("label-credit-registration-queued-at"),
              minWidth: "8rem",
              nowrap: true,
              cell: (row) => <RelativeTime at={row.queued_at} absoluteTime={TIME_IN_TITLE} />,
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
    </Disclosure>
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

/** People every email the caps allow has gone to without a link, collapsed: an address may be outdated. */
const StaleAddressBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const addressSummary = (row: AccountLinkingStaleAddress): string => {
    const addressCount = new Set(row.sends.map((send) => send.address)).size
    return row.sends.some((send) => send.send_status === SEND_FAILED)
      ? t("credit-registration-admin-addresses-sending-failed", { count: addressCount })
      : t("credit-registration-admin-addresses-all-sent", { count: addressCount })
  }
  const headingId = useId()
  return (
    <Disclosure
      title={
        <span id={headingId}>
          {t("credit-registration-heading-stale-addresses", {
            max: stats.max_mails_per_person_and_course,
          })}
        </span>
      }
      summary={<span className={noteCss}>{stats.stale_addresses.length}</span>}
      variant={PLAIN_DISCLOSURE}
    >
      <div className={subsectionCss}>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-stale-addresses-note")}
        </p>
        <Table
          labelledBy={headingId}
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
              cell: (row) => <RelativeTime at={row.last_sent_at} absoluteTime={TIME_IN_TITLE} />,
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
      </div>
    </Disclosure>
  )
}

/** Row-actions menu holding one item, plus any dialog that item opens. */
const SingleActionMenu: React.FC<{
  student: string
  item: MenuItemDescriptor
  children?: React.ReactNode
}> = ({ student, item, children }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <>
      <Menu aria-label={t("credit-registration-admin-row-actions", { student })} items={[item]} />
      {children}
    </>
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
    <SingleActionMenu student={row.reported_student_number} item={item}>
      {dialog}
    </SingleActionMenu>
  )
}

/** Numbers the study registry reported that an existing link kept us from linking. */
const StudyRegistryConflictBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-study-registry-conflicts")}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-study-registry-conflicts-note")}
      </p>
      <Table<StudyRegistryStudentNumberConflict>
        labelledBy={headingId}
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
            cell: (row) => <RelativeTime at={row.created_at} absoluteTime={TIME_IN_TITLE} />,
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

const RecentClaimsBlock: React.FC<{
  verifiedVia: StudentNumberVerificationMethod
  labelledBy: string
}> = ({ verifiedVia, labelledBy }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const paginationInfo = usePaginationInfo(CLAIMS_PER_PAGE)
  const numbersQuery = useAdminVerifiedStudentNumbers({
    page: paginationInfo.page,
    limit: paginationInfo.limit,
    verified_via: verifiedVia,
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
                labelledBy={labelledBy}
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
                        {row.verified_via === "admin_manual" ? (
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
                    cell: (row) => (
                      <RelativeTime at={row.verified_at} absoluteTime={TIME_IN_TITLE} />
                    ),
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

/** Links made by linking email or by hand, one by one; the study registry import as a total. */
const RecentLinksSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const [method, setMethod] = useState<(typeof RECENT_LINK_METHODS)[number]>(RECENT_LINK_METHODS[0])
  const totalOf = (via: StudentNumberVerificationMethod) =>
    stats.links_total_by_method.find((row) => row.verified_via === via)?.count ?? 0
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-recent-claims")}
        </h2>
      </div>
      <div className={rowCss}>
        {RECENT_LINK_METHODS.map((via) => (
          <FacetChip
            key={via}
            label={verificationMethodLabel(t, via) ?? via}
            count={totalOf(via)}
            isSelected={method === via}
            onToggle={() => setMethod(via)}
          />
        ))}
      </div>
      <p className={noteCss}>
        {t("credit-registration-admin-study-registry-links-total", {
          count: totalOf(STUDY_REGISTRY),
        })}
      </p>
      <RecentClaimsBlock verifiedVia={method} labelledBy={headingId} />
    </section>
  )
}

/**
 * Linking a student number, led by the students who pressed "I have enrolled" and still have none.
 * Their stuck cases are worked on Needs attention; this page is the context around them.
 */
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
            <HealthBanner stats={stats} />
            {stats.account_linking_since && (
              <p className={cx(noteCss, proseCss)}>
                {t("credit-registration-admin-account-linking-since", {
                  time: formatZonedTimestamp(new Date(stats.account_linking_since)),
                })}
              </p>
            )}
            <PressersSection stats={stats} />
            <WaitingCounts stats={stats} />
            <LinkingEmailsSection stats={stats} windowDays={windowDays} />
            <CourseCodesSection stats={stats} />
            {stats.study_registry_conflicts.length > 0 && (
              <StudyRegistryConflictBlock stats={stats} />
            )}
            <OtherWaitingStudentsSection stats={stats} />
            <RecentLinksSection stats={stats} />
          </>
        )
      }}
    </QueryResult>
  )
}

export default AccountLinkingSection
