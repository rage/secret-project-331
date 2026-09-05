"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseCreditRegistrationModuleConfigsOptions,
  getCourseCreditRegistrationSummaryOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseCreditRegistrationModuleSummary,
  CourseCreditRegistrationSummary,
  CourseModuleCreditRegistrationConfig,
} from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Infobox,
  QueryResult,
  RelativeTime,
  Table,
} from "@/shared-module/components"

import {
  ALIGN_END,
  BADGE_COMPACT,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_COMPACT,
  TONE,
} from "./constants"
import CourseCreditRegistrationActionsPanel from "./CourseCreditRegistrationActionsPanel"
import CreditRegistrationConfigCallout from "./CreditRegistrationConfigCallout"
import CreditRegistrationExportLink from "./CreditRegistrationExportLink"
import type { RegistrationStatusView } from "./registrationStatusViews"
import RetryFailedCreditRegistrationsBlock from "./RetryFailedCreditRegistrationsBlock"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionHeaderCss,
  subheadingCss,
  subsectionCss,
} from "./styles"
import { useCourseFailureReasons } from "./teacherCreditRegistrations"
import UnlinkedStudentsDialog from "./UnlinkedStudentsDialog"

/** Puts the roster under one of the named views. Without it the counts are plain numbers. */
export type SelectRegistrationStatusView = (view: RegistrationStatusView) => void

interface Props {
  courseId: string
  /**
   * Narrows every count to one instance, so the panel cannot contradict the roster it sits under.
   * `null` is the whole course.
   */
  courseInstanceId?: string | null
  /** Narrows the by-module rows to the module the roster above is filtered to. */
  moduleId?: string | null
  onSelectView?: SelectRegistrationStatusView
}

const sumBy = (
  modules: CourseCreditRegistrationModuleSummary[],
  pick: (module: CourseCreditRegistrationModuleSummary) => number,
): number => modules.reduce((total, module) => total + pick(module), 0)

/** Course-wide registration counts behind the one-line summary above the roster. */
interface CreditRegistrationCourseCounts {
  registered: number
  total: number
  failed: number
  waitingOnStudents: number
  undeliverableEmails: number
}

const summarizeCreditRegistrationCounts = (
  summary: CourseCreditRegistrationSummary,
): CreditRegistrationCourseCounts => {
  const enabledModules = summary.modules.filter((module) => module.enabled)
  return {
    registered: sumBy(enabledModules, (module) => module.registered_count),
    total: sumBy(enabledModules, (module) => module.registration_count),
    failed: sumBy(enabledModules, (module) => module.failed_count),
    waitingOnStudents: summary.unlinked_enrolled_student_count,
    undeliverableEmails: summary.linking_emails_failed_to_send_count,
  }
}

/** The lint that guards user-facing strings rejects a bare one in JSX, so the views are named. */
const REGISTERED_VIEW: RegistrationStatusView = "registered"
const IN_PROGRESS_VIEW: RegistrationStatusView = "in_progress"
const WAITING_ON_STUDENT_VIEW: RegistrationStatusView = "waiting_on_student"
const FAILED_VIEW: RegistrationStatusView = "failed"
const NOT_REGISTERING_VIEW: RegistrationStatusView = "not_registering"

/**
 * Each needs-attention count, its sentence, the view it opens (`null` opens nothing), and whether
 * the endpoint counts it course-wide even when the rest of the summary is narrowed to one instance.
 */
const NEEDS_ATTENTION_SEGMENTS = [
  ["failed", "credit-registration-summary-failed", "failed", false],
  ["waitingOnStudents", "credit-registration-summary-waiting", "needs_student_number", true],
  ["undeliverableEmails", "credit-registration-summary-undeliverable-emails", null, true],
] as const satisfies readonly (readonly [
  keyof CreditRegistrationCourseCounts,
  string,
  RegistrationStatusView | null,
  boolean,
])[]

const summaryLineCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
`

// A count that narrows the roster reads as a link, not as note text that happens to underline.
const countLinkCss = css`
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--color-green-700);
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;

  &:hover {
    color: var(--color-green-800);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--space-1);
  }
`

const moduleCellCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
`

interface SummaryLineProps {
  courseId: string
  courseInstanceId?: string | null
  onSelectView: SelectRegistrationStatusView
}

/** How the course's credits are going, in one line, before any student row. */
export const CreditRegistrationSummaryLine: React.FC<SummaryLineProps> = ({
  courseId,
  courseInstanceId,
  onSelectView,
}) => {
  const { t } = useTranslation()
  const summaryQuery = useQuery(
    getCourseCreditRegistrationSummaryOptions({
      path: { course_id: courseId },
      ...includeIf(courseInstanceId, { query: { course_instance_id: courseInstanceId ?? "" } }),
    }),
  )

  return (
    <QueryResult query={summaryQuery} refreshIndicator={QUIET_REFRESH}>
      {(summary) => {
        const counts = summarizeCreditRegistrationCounts(summary)
        if (counts.total === 0) {
          return null
        }
        return (
          <p className={summaryLineCss}>
            <span className={noteCss}>
              {t("credit-registration-summary-registered", {
                registered: counts.registered,
                total: counts.total,
              })}
            </span>
            {NEEDS_ATTENTION_SEGMENTS.filter(([field]) => counts[field] > 0).map(
              ([field, key, view, isAlwaysCourseWide]) => (
                <React.Fragment key={key}>
                  <span className={noteCss} aria-hidden="true">
                    {MIDDLE_DOT}
                  </span>
                  {view === null ? (
                    <span className={noteCss}>{t(key, { count: counts[field] })}</span>
                  ) : (
                    <button
                      type="button"
                      className={countLinkCss}
                      onClick={() => onSelectView(view)}
                    >
                      {t(key, { count: counts[field] })}
                    </button>
                  )}
                  {isAlwaysCourseWide && courseInstanceId && (
                    <span className={noteCss}>{t("credit-registration-across-the-course")}</span>
                  )}
                </React.Fragment>
              ),
            )}
          </p>
        )
      }}
    </QueryResult>
  )
}

interface CountCellProps {
  count: number
  view: RegistrationStatusView
  onSelectView: SelectRegistrationStatusView | undefined
}

const CountCell: React.FC<CountCellProps> = ({ count, view, onSelectView }) => {
  if (count === 0 || onSelectView === undefined) {
    return <span>{count}</span>
  }
  return (
    <button type="button" className={countLinkCss} onClick={() => onSelectView(view)}>
      {count}
    </button>
  )
}

/** Why a paused module is paused, and that a teacher is not the one who lifts it. */
const PauseNotice: React.FC<{
  moduleName: string
  config: CourseModuleCreditRegistrationConfig
}> = ({ moduleName, config }) => {
  const { t } = useTranslation()
  return (
    <Infobox tone={TONE.INFO}>
      <div>{t("credit-registration-module-paused-explanation", { module: moduleName })}</div>
      {config.credit_registration_pause_reason && (
        <div>{config.credit_registration_pause_reason}</div>
      )}
      {config.credit_registration_paused_at && (
        <div className={noteCss}>
          <RelativeTime at={config.credit_registration_paused_at} absoluteTime={TIME_COMPACT} />
        </div>
      )}
    </Infobox>
  )
}

/** How the course's failures break down by cause, so one course-wide fault is not read as many. */
const FailureReasonBreakdown: React.FC<{
  courseId: string
  courseInstanceId: string | null
  failedCount: number
}> = ({ courseId, courseInstanceId, failedCount }) => {
  const { t } = useTranslation()
  const { reasons, isCapped } = useCourseFailureReasons(courseId, courseInstanceId, failedCount > 0)

  if (reasons.length === 0) {
    return null
  }
  return (
    <p className={noteCss}>
      {t("credit-registration-failures-by-reason", { count: failedCount })}{" "}
      {reasons.map(({ label, count }, index) => (
        <React.Fragment key={label}>
          {index > 0 && MIDDLE_DOT}
          {t("credit-registration-failures-of-reason", { count, reason: label })}
        </React.Fragment>
      ))}
      {isCapped && ` ${t("credit-registration-failures-by-reason-capped")}`}
    </p>
  )
}

/**
 * The course's credit registration detail: how every live registration is doing per module, what
 * is holding the failures up, and the controls that move them.
 *
 * Belongs below the roster it describes, not between the filters and the rows.
 */
const CourseCreditRegistrationSummaryPanel: React.FC<Props> = ({
  courseId,
  courseInstanceId,
  moduleId,
  onSelectView,
}) => {
  const { t } = useTranslation()
  const [showUnlinked, setShowUnlinked] = useState(false)
  const summaryQuery = useQuery(
    getCourseCreditRegistrationSummaryOptions({
      path: { course_id: courseId },
      ...includeIf(courseInstanceId, { query: { course_instance_id: courseInstanceId ?? "" } }),
    }),
  )
  const configsQuery = useQuery(
    getCourseCreditRegistrationModuleConfigsOptions({ path: { course_id: courseId } }),
  )

  return (
    <QueryResult query={summaryQuery} refreshIndicator={QUIET_REFRESH}>
      {(summary) => {
        const enabledModules = summary.modules.filter(
          (module) => module.enabled && (!moduleId || module.course_module_id === moduleId),
        )
        if (enabledModules.length === 0) {
          return null
        }
        const failedCount = sumBy(enabledModules, (module) => module.failed_count)
        const unlinkedCount = summary.unlinked_enrolled_student_count
        const configOf = (id: string) =>
          configsQuery.data?.modules.find((config) => config.course_module_id === id)
        const nameOf = (module: CourseCreditRegistrationModuleSummary) =>
          module.course_module_name ?? t("default-module")

        return (
          <section className={sectionCss}>
            <div className={sectionHeaderCss}>
              <h2 className={headingCss}>{t("heading-credit-registration")}</h2>
              <p className={noteCss}>
                {courseInstanceId
                  ? t("credit-registration-counts-scoped-to-instance")
                  : t("credit-registration-counts-across-the-course")}
              </p>
            </div>
            <div className={subsectionCss}>
              <h3 className={subheadingCss}>{t("heading-credit-registration-by-module")}</h3>
              <Table
                caption={t("heading-credit-registration-by-module")}
                density={DENSITY_COMPACT}
                rowKey={(module) => module.course_module_id}
                rows={enabledModules}
                columns={[
                  {
                    header: t("module"),
                    grow: true,
                    nowrap: false,
                    cell: (module) => (
                      <span className={moduleCellCss}>
                        <span>{nameOf(module)}</span>
                        {module.paused && (
                          <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
                            {t("credit-registration-module-paused")}
                          </Badge>
                        )}
                        {module.needs_admin_attention_count > 0 && (
                          <Badge
                            tone={TONE.INFO}
                            size={BADGE_COMPACT}
                            title={t("credit-registration-with-support-explanation")}
                          >
                            {t("credit-registration-with-support", {
                              count: module.needs_admin_attention_count,
                            })}
                          </Badge>
                        )}
                      </span>
                    ),
                  },
                  {
                    header: t("credit-registration-column-registrations"),
                    align: ALIGN_END,
                    cell: (module) => module.registration_count,
                  },
                  {
                    header: t("credit-registration-column-registered"),
                    align: ALIGN_END,
                    cell: (module) => (
                      <CountCell
                        count={module.registered_count}
                        view={REGISTERED_VIEW}
                        onSelectView={onSelectView}
                      />
                    ),
                  },
                  {
                    header: t("credit-registration-column-in-progress"),
                    align: ALIGN_END,
                    cell: (module) => (
                      <CountCell
                        count={module.in_progress_count}
                        view={IN_PROGRESS_VIEW}
                        onSelectView={onSelectView}
                      />
                    ),
                  },
                  {
                    header: t("credit-registration-column-waiting-on-student"),
                    align: ALIGN_END,
                    cell: (module) => (
                      <CountCell
                        count={module.waiting_on_student_count}
                        view={WAITING_ON_STUDENT_VIEW}
                        onSelectView={onSelectView}
                      />
                    ),
                  },
                  {
                    header: t("credit-registration-column-failed"),
                    align: ALIGN_END,
                    cell: (module) => (
                      <CountCell
                        count={module.failed_count}
                        view={FAILED_VIEW}
                        onSelectView={onSelectView}
                      />
                    ),
                  },
                  {
                    header: t("credit-registration-column-not-registering"),
                    align: ALIGN_END,
                    cell: (module) => (
                      <CountCell
                        count={module.not_registering_count}
                        view={NOT_REGISTERING_VIEW}
                        onSelectView={onSelectView}
                      />
                    ),
                  },
                ]}
              />
              <FailureReasonBreakdown
                courseId={courseId}
                courseInstanceId={courseInstanceId ?? null}
                failedCount={failedCount}
              />
              {enabledModules.map((module) => {
                const config = configOf(module.course_module_id)
                return module.paused && config ? (
                  <PauseNotice
                    key={module.course_module_id}
                    moduleName={nameOf(module)}
                    config={config}
                  />
                ) : null
              })}
              <CreditRegistrationConfigCallout
                configs={enabledModules.map((module) => ({
                  moduleName: nameOf(module),
                  config: configOf(module.course_module_id),
                }))}
                fixHref={manageCourseModulesRoute(courseId)}
              />
              <RetryFailedCreditRegistrationsBlock courseId={courseId} failedCount={failedCount}>
                <Button
                  variant="secondary"
                  size="medium"
                  type="button"
                  onClick={() => setShowUnlinked(true)}
                >
                  {t("button-text-students-without-a-student-number", { count: unlinkedCount })}
                </Button>
                <CreditRegistrationExportLink courseId={courseId} />
              </RetryFailedCreditRegistrationsBlock>
            </div>
            <CourseCreditRegistrationActionsPanel courseId={courseId} />
            {showUnlinked && (
              <UnlinkedStudentsDialog
                courseId={courseId}
                open={showUnlinked}
                onClose={() => setShowUnlinked(false)}
              />
            )}
          </section>
        )
      }}
    </QueryResult>
  )
}

export default CourseCreditRegistrationSummaryPanel
