"use client"

import { cx } from "@emotion/css"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import type {
  BlockingProblem,
  CreditRegistrationAttentionDismissal,
  CreditRegistrationAttentionItem,
  CreditRegistrationBlockingProblemRows,
  TimelinePhase,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import Pagination from "@/shared-module/common/components/Pagination"
import {
  creditRegistrationItemRoute,
  manageCourseModulesRoute,
} from "@/shared-module/common/utils/routes"
import {
  Disclosure,
  EmptyState,
  Link,
  QueryResult,
  RelativeTime,
  Table,
} from "@/shared-module/components"

import {
  ADMIN_PAGE_SIZE_OPTIONS,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_DURATION,
  TIME_IN_TITLE,
} from "../constants"
import {
  headingCss,
  noteCss,
  proseCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionCss,
  stackedCellCss,
  subsectionCss,
} from "../styles"
import { attentionReasonLabel } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationAttentionItems } from "./adminCreditRegistrationHooks"
import {
  attentionPhaseAnchorId,
  auditForStudentHref,
  courseCodeHref,
  DISMISSED_RECENTLY_ANCHOR,
  phaseHref,
  RUNNING_LATE_ANCHOR,
} from "./adminLinks"
import { TONE_INK } from "./AdminStateLabel"
import AttentionRowActions from "./AttentionRowActions"
import { registrationsListHref } from "./registrationsListUrl"
import { attentionItemStatusSubject, registrationStatusLines } from "./registrationStatus"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"
import { TIMELINE_PHASES, timelinePhaseLabel } from "./timelineSteps"
import { useFilteredAdminQuery } from "./useFilteredAdminQuery"
import { useHashTarget, useOpenedByLink } from "./useHashTarget"

const ROWS_PER_PAGE = 100

/** Who it waits on, then what happens next: the registration page's status card in a cell. */
const StatusCell: React.FC<{ item: CreditRegistrationAttentionItem }> = ({ item }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const status = registrationStatusLines(t, attentionItemStatusSubject(item))
  return (
    <span className={stackedCellCss}>
      <span className={cx(status.tone === "attention" && TONE_INK["action-needed"])}>
        {status.waitsOn}
      </span>
      {status.next && <span className={noteCss}>{status.next}</span>}
    </span>
  )
}

const CourseCell: React.FC<{ item: CreditRegistrationAttentionItem }> = ({ item }) => (
  <span className={stackedCellCss}>
    <span>{item.course_name}</span>
    <span className={noteCss}>
      {[item.course_module_name, item.uh_course_code].filter(Boolean).join(MIDDLE_DOT)}
    </span>
  </span>
)

/** The rows of one section, with their actions unless `hasActions` is off. */
const AttentionItemsTable: React.FC<{
  items: CreditRegistrationAttentionItem[]
  labelledBy: string
  hasActions?: boolean
}> = ({ items, labelledBy, hasActions = true }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <Table
      labelledBy={labelledBy}
      density={DENSITY_COMPACT}
      responsive={TABLE_STACK}
      rowKey={(row) => row.credit_registration_id}
      rows={items}
      columns={[
        {
          header: t("label-student"),
          grow: 1,
          minWidth: STUDENT_COLUMN_MIN_WIDTH,
          cell: (row) => (
            <StudentCell row={row} href={creditRegistrationItemRoute(row.credit_registration_id)} />
          ),
        },
        {
          header: t("label-course"),
          grow: 1,
          minWidth: "11rem",
          cell: (row) => <CourseCell item={row} />,
        },
        {
          header: t("label-status"),
          grow: 2,
          minWidth: "16rem",
          cell: (row) => <StatusCell item={row} />,
        },
        {
          header: t("label-credit-registration-in-phase-since"),
          minWidth: "7rem",
          nowrap: true,
          cell: (row) => <RelativeTime at={row.phase_started_at} absoluteTime={TIME_DURATION} />,
        },
        ...(hasActions
          ? [
              {
                header: t("label-actions"),
                minWidth: "14rem",
                cell: (row: CreditRegistrationAttentionItem) => <AttentionRowActions item={row} />,
              },
            ]
          : []),
      ]}
    />
  )
}

/** The sentence naming a blocking problem, and where it is looked at. */
const BlockingProblemLine: React.FC<{
  problem: BlockingProblem
  items: CreditRegistrationAttentionItem[]
}> = ({ problem, items }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  switch (problem.kind) {
    case "processing_phase_stopped":
      return (
        <p className={proseCss}>
          {t("credit-registration-admin-problem-phase-stopped", { phase: problem.subject })}{" "}
          <Link href={phaseHref(problem.subject)}>
            {t("credit-registration-admin-problem-see-phase")}
          </Link>
        </p>
      )
    case "course_code_failing":
      return (
        <p className={proseCss}>
          {t("credit-registration-admin-problem-course-code-failing", { code: problem.subject })}{" "}
          <Link href={courseCodeHref(problem.subject)}>
            {t("credit-registration-admin-problem-see-course-code")}
          </Link>
        </p>
      )
    case "module_misconfigured": {
      const [first] = items
      return (
        <p className={proseCss}>
          {t("credit-registration-admin-problem-module-misconfigured", {
            course: first
              ? [first.course_name, first.course_module_name].filter(Boolean).join(MIDDLE_DOT)
              : problem.subject,
          })}{" "}
          {first && (
            <Link href={manageCourseModulesRoute(first.course_id)}>
              {t("credit-registration-admin-problem-open-module-settings")}
            </Link>
          )}
        </p>
      )
    }
  }
}

const BlockingProblemGroup: React.FC<{ group: CreditRegistrationBlockingProblemRows }> = ({
  group,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <div className={subsectionCss}>
      <BlockingProblemLine problem={group.problem} items={group.items} />
      <Disclosure
        title={
          <span id={headingId}>
            {t("credit-registration-admin-problem-holds-up", { count: group.items.length })}
          </span>
        }
        variant={PLAIN_DISCLOSURE}
      >
        <AttentionItemsTable items={group.items} labelledBy={headingId} hasActions={false} />
      </Disclosure>
    </div>
  )
}

/** Problems that hold up many registrations at once; their rows are not counted below. */
const BlockingProblemsSection: React.FC<{ groups: CreditRegistrationBlockingProblemRows[] }> = ({
  groups,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-blocking-problems")}
        </h2>
      </div>
      {groups.map((group) => (
        <BlockingProblemGroup
          key={`${group.problem.kind}:${group.problem.subject}`}
          group={group}
        />
      ))}
    </section>
  )
}

const PhaseSection: React.FC<{
  phase: TimelinePhase
  items: CreditRegistrationAttentionItem[]
}> = ({ phase, items }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section
      id={attentionPhaseAnchorId(phase)}
      className={sectionCardCss}
      aria-labelledby={headingId}
    >
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-admin-phase-with-count", {
            phase: timelinePhaseLabel(t, phase),
            count: items.length,
          })}
        </h2>
      </div>
      <AttentionItemsTable items={items} labelledBy={headingId} />
    </section>
  )
}

const RunningLateSection: React.FC<{
  items: CreditRegistrationAttentionItem[]
  isOpen: boolean
}> = ({ items, isOpen }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const expansion = useOpenedByLink(isOpen)
  return (
    <section id={RUNNING_LATE_ANCHOR} className={sectionCardCss}>
      <Disclosure
        title={<span id={headingId}>{t("credit-registration-heading-running-late")}</span>}
        summary={<span className={noteCss}>{items.length}</span>}
        variant={PLAIN_DISCLOSURE}
        {...expansion}
      >
        <div className={sectionCss}>
          <p className={cx(noteCss, proseCss)}>
            {t("credit-registration-admin-running-late-note")}
          </p>
          <AttentionItemsTable items={items} labelledBy={headingId} />
        </div>
      </Disclosure>
    </section>
  )
}

const DismissedRecentlySection: React.FC<{
  dismissals: CreditRegistrationAttentionDismissal[]
  isOpen: boolean
}> = ({ dismissals, isOpen }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const expansion = useOpenedByLink(isOpen)
  return (
    <section id={DISMISSED_RECENTLY_ANCHOR} className={sectionCardCss}>
      <Disclosure
        title={<span id={headingId}>{t("credit-registration-heading-dismissed-recently")}</span>}
        summary={<span className={noteCss}>{dismissals.length}</span>}
        variant={PLAIN_DISCLOSURE}
        {...expansion}
      >
        <Table
          labelledBy={headingId}
          density={DENSITY_COMPACT}
          responsive={TABLE_STACK}
          rowKey={(row) => `${row.credit_registration_id}:${row.dismissed_at}`}
          rows={dismissals}
          columns={[
            {
              header: t("label-student"),
              grow: 1,
              minWidth: STUDENT_COLUMN_MIN_WIDTH,
              cell: (row) => (
                <span className={stackedCellCss}>
                  <StudentCell
                    row={row}
                    href={creditRegistrationItemRoute(row.credit_registration_id)}
                  />
                  <span className={noteCss}>{row.course_name}</span>
                </span>
              ),
            },
            {
              header: t("credit-registration-admin-column-dismissed-reasons"),
              minWidth: "10rem",
              cell: (row) =>
                row.dismissed_reasons
                  .map((reason) => attentionReasonLabel(t, reason))
                  .join(MIDDLE_DOT),
            },
            {
              header: t("label-reason"),
              grow: 2,
              minWidth: "14rem",
              cell: (row) => row.reason,
            },
            {
              header: t("credit-registration-admin-column-dismissed"),
              minWidth: "10rem",
              cell: (row) => (
                <span className={stackedCellCss}>
                  <span>
                    {formatUserName({
                      first_name: row.dismissed_by_first_name,
                      last_name: row.dismissed_by_last_name,
                    })}
                  </span>
                  <span className={noteCss}>
                    <RelativeTime at={row.dismissed_at} absoluteTime={TIME_IN_TITLE} />
                  </span>
                </span>
              ),
            },
            {
              header: t("label-actions"),
              minWidth: "8rem",
              cell: (row) => (
                <Link href={auditForStudentHref(row.user_id)} prefetch={false}>
                  {t("credit-registration-admin-see-in-audit-log")}
                </Link>
              ),
            },
          ]}
        />
      </Disclosure>
    </section>
  )
}

/**
 * Everything that needs a person, one section per timeline phase, after the problems that hold up
 * many rows at once. Running late and recent dismissals follow, collapsed and not counted.
 */
const AttentionQueueSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { paginationInfo, query } = useFilteredAdminQuery(
    [],
    (_filters, pagination) => ({
      page: pagination.page,
      limit: pagination.limit,
    }),
    { rowsPerPage: ROWS_PER_PAGE },
  )
  const attentionQuery = useCreditRegistrationAttentionItems(query)
  const hash = useHashTarget(attentionQuery.isSuccess)

  return (
    <QueryResult
      query={attentionQuery}
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionCardsCss}
    >
      {(attention) => {
        const phases = TIMELINE_PHASES.filter((phase) =>
          attention.items.some((item) => item.phase === phase),
        )
        return (
          <>
            {attention.total_count > 0 && (
              <p className={noteCss}>
                <Link href={registrationsListHref({ needsAttention: true })}>
                  {t("credit-registration-admin-needs-attention-in-list", {
                    count: attention.total_count,
                  })}
                </Link>
              </p>
            )}
            {attention.explained_by_problem.length > 0 && (
              <BlockingProblemsSection groups={attention.explained_by_problem} />
            )}
            {phases.length === 0 ? (
              <section className={sectionCardCss}>
                <EmptyState title={t("credit-registration-admin-nothing-needs-a-human")} />
              </section>
            ) : (
              phases.map((phase) => (
                <PhaseSection
                  key={phase}
                  phase={phase}
                  items={attention.items.filter((item) => item.phase === phase)}
                />
              ))
            )}
            <Pagination
              paginationInfo={paginationInfo}
              totalPages={attention.total_pages}
              totalItems={attention.filtered_count}
              itemsPerPageOptions={ADMIN_PAGE_SIZE_OPTIONS}
            />
            {attention.running_late.length > 0 && (
              <RunningLateSection
                items={attention.running_late}
                isOpen={hash === RUNNING_LATE_ANCHOR}
              />
            )}
            {attention.dismissed_recently.length > 0 && (
              <DismissedRecentlySection
                dismissals={attention.dismissed_recently}
                isOpen={hash === DISMISSED_RECENTLY_ANCHOR}
              />
            )}
          </>
        )
      }}
    </QueryResult>
  )
}

export default AttentionQueueSection
