"use client"

import { cx } from "@emotion/css"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import InlineParts from "@/components/credit-registration/InlineParts"
import { ZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type {
  BlockingProblem,
  CreditRegistrationAttentionDismissal,
  CreditRegistrationAttentionItem,
  CreditRegistrationAttentionPhaseRows,
  CreditRegistrationBlockingProblemRows,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import {
  creditRegistrationItemRoute,
  manageCourseModulesRoute,
} from "@/shared-module/common/utils/routes"
import { Disclosure, EmptyState, Link, QueryResult, Table } from "@/shared-module/components"

import {
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TABLE_STACK,
} from "../constants"
import {
  breakAnywhereCss,
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
import AttentionRowActions from "./AttentionRowActions"
import { registrationsListHref } from "./registrationsListUrl"
import { attentionItemStatusSubject, registrationStatusLines } from "./registrationStatus"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"
import {
  STEPS_BY_PHASE,
  TIMELINE_PHASES,
  timelinePhaseLabel,
  timelineStepLabel,
} from "./timelineSteps"
import { useHashTarget, useOpenedByLink } from "./useHashTarget"

const ANSWER_UNCLEAR = "answer_unclear"

/** Says how many of a section's rows are listed when the server capped them. */
const ShownOfTotal: React.FC<{ shown: number; total: number }> = ({ shown, total }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return shown < total ? (
    <p className={noteCss}>{t("credit-registration-admin-oldest-shown", { shown, total })}</p>
  ) : null
}

/**
 * What is wrong first, then what to do and whom it waits on. An unclear answer's next step is
 * advice, so its step name is what says what is wrong.
 */
const StatusCell: React.FC<{ item: CreditRegistrationAttentionItem }> = ({ item }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const status = registrationStatusLines(t, attentionItemStatusSubject(item), null)
  const diagnosis =
    item.timeline_step === ANSWER_UNCLEAR ? timelineStepLabel(t, item.timeline_step) : null
  const [lead, ...notes] = [diagnosis, status.next, status.waitsOn].filter(Boolean)
  return (
    <span className={stackedCellCss}>
      <span>{lead}</span>
      {notes.map((line, index) => (
        <span key={index} className={noteCss}>
          {line}
        </span>
      ))}
    </span>
  )
}

const CourseCell: React.FC<{ item: CreditRegistrationAttentionItem }> = ({ item }) => (
  <span className={stackedCellCss}>
    <span className={breakAnywhereCss}>{item.course_name}</span>
    <InlineParts className={noteCss} parts={[item.course_module_name, item.uh_course_code]} />
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
          cell: (row) => <ZonedTimestamp at={row.phase_started_at} />,
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
              ? first.course_module_name
                ? t("credit-registration-course-and-module", {
                    course: first.course_name,
                    module: first.course_module_name,
                  })
                : first.course_name
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
            {t("credit-registration-admin-problem-holds-up", { count: group.total_count })}
          </span>
        }
        variant={PLAIN_DISCLOSURE}
      >
        <div className={sectionCss}>
          <ShownOfTotal shown={group.items.length} total={group.total_count} />
          <AttentionItemsTable items={group.items} labelledBy={headingId} hasActions={false} />
        </div>
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

const PhaseSection: React.FC<{ rows: CreditRegistrationAttentionPhaseRows }> = ({ rows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section
      id={attentionPhaseAnchorId(rows.phase)}
      className={sectionCardCss}
      aria-labelledby={headingId}
    >
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-admin-phase-with-count", {
            phase: timelinePhaseLabel(t, rows.phase),
            count: rows.total_count,
          })}
        </h2>
      </div>
      {rows.items.length === 0 ? (
        <EmptyState title={t("credit-registration-admin-nothing-needs-a-human")} />
      ) : (
        <>
          {rows.items.length < rows.total_count && (
            <p className={noteCss}>
              {t("credit-registration-admin-oldest-shown", {
                shown: rows.items.length,
                total: rows.total_count,
              })}{" "}
              <Link
                href={registrationsListHref({
                  needsAttention: true,
                  steps: STEPS_BY_PHASE[rows.phase],
                  includeNotStarted: true,
                })}
              >
                {t("credit-registration-admin-needs-attention-in-list", {
                  count: rows.total_count,
                })}
              </Link>
            </p>
          )}
          <AttentionItemsTable items={rows.items} labelledBy={headingId} />
        </>
      )}
    </section>
  )
}

const RunningLateSection: React.FC<{
  items: CreditRegistrationAttentionItem[]
  totalCount: number
  isOpen: boolean
}> = ({ items, totalCount, isOpen }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const expansion = useOpenedByLink(isOpen)
  return (
    <section id={RUNNING_LATE_ANCHOR} className={sectionCardCss}>
      <Disclosure
        title={<span id={headingId}>{t("credit-registration-heading-running-late")}</span>}
        summary={<span className={noteCss}>{totalCount}</span>}
        variant={PLAIN_DISCLOSURE}
        {...expansion}
      >
        <div className={sectionCss}>
          <p className={cx(noteCss, proseCss)}>
            {t("credit-registration-admin-running-late-note")}
          </p>
          <ShownOfTotal shown={items.length} total={totalCount} />
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
                  <span className={cx(noteCss, breakAnywhereCss)}>{row.course_name}</span>
                </span>
              ),
            },
            {
              header: t("credit-registration-admin-column-dismissed-reasons"),
              minWidth: "10rem",
              cell: (row) => (
                <span className={stackedCellCss}>
                  {row.dismissed_reasons.map((reason) => (
                    <span key={reason}>{attentionReasonLabel(t, reason)}</span>
                  ))}
                </span>
              ),
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
                    <ZonedTimestamp at={row.dismissed_at} />
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
  const attentionQuery = useCreditRegistrationAttentionItems({})
  const hash = useHashTarget(attentionQuery.isSuccess)

  return (
    <QueryResult
      query={attentionQuery}
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionCardsCss}
    >
      {(attention) => {
        // A link to a phase with nothing in it still lands on that phase's heading.
        const phases = TIMELINE_PHASES.flatMap((phase): CreditRegistrationAttentionPhaseRows[] => {
          const rows = attention.phases.find((candidate) => candidate.phase === phase)
          if (rows) {
            return [rows]
          }
          return hash === attentionPhaseAnchorId(phase)
            ? [{ phase, total_count: 0, items: [] }]
            : []
        })
        return (
          <>
            {attention.total_count > 0 && (
              <p className={noteCss}>
                <Link
                  href={registrationsListHref({ needsAttention: true, includeNotStarted: true })}
                >
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
              phases.map((rows) => <PhaseSection key={rows.phase} rows={rows} />)
            )}
            {attention.running_late_count > 0 && (
              <RunningLateSection
                items={attention.running_late}
                totalCount={attention.running_late_count}
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
