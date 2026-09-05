"use client"

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
} from "@/generated/api/types.generated"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import { Badge, Button, QueryResult, Table } from "@/shared-module/components"

import { ALIGN_END, MIDDLE_DOT, QUIET_REFRESH, TONE } from "./constants"
import CourseCreditRegistrationActionsPanel from "./CourseCreditRegistrationActionsPanel"
import CreditRegistrationConfigCallout from "./CreditRegistrationConfigCallout"
import CreditRegistrationExportLink from "./CreditRegistrationExportLink"
import RetryFailedCreditRegistrationsBlock from "./RetryFailedCreditRegistrationsBlock"
import {
  headingCss,
  noteCss,
  rowCss,
  sectionCss,
  statusTriggerCss,
  subheadingCss,
  subsectionCss,
} from "./styles"
import UnlinkedStudentsDialog from "./UnlinkedStudentsDialog"

interface Props {
  courseId: string
}

const liveRowCount = (module: CourseCreditRegistrationModuleSummary): number =>
  module.counts_by_state.reduce((total, row) => total + row.count, 0)

const sumBy = (
  modules: CourseCreditRegistrationModuleSummary[],
  pick: (module: CourseCreditRegistrationModuleSummary) => number,
): number => modules.reduce((total, module) => total + pick(module), 0)

/** Course-wide registration counts behind the one-line summary and the by-module table. */
interface CreditRegistrationCourseCounts {
  registered: number
  total: number
  failed: number
  waitingOnStudents: number
  undeliverableEmails: number
}

/** Course-wide totals for the one-line summary above the roster; the by-module table below has the detail per module. */
const summarizeCreditRegistrationCounts = (
  summary: CourseCreditRegistrationSummary,
): CreditRegistrationCourseCounts => {
  const enabledModules = summary.modules.filter((module) => module.enabled)
  return {
    registered: sumBy(enabledModules, (module) => module.success_count),
    total: sumBy(enabledModules, liveRowCount),
    failed: sumBy(
      enabledModules,
      (module) => module.failed_permanent_count + module.needs_admin_attention_count,
    ),
    waitingOnStudents: summary.unlinked_enrolled_student_count,
    undeliverableEmails: summary.linking_emails_failed_to_send_count,
  }
}

/** Each needs-attention count and its sentence, in the order they follow the registered total. */
const NEEDS_ATTENTION_SEGMENTS = [
  ["failed", "credit-registration-summary-failed"],
  ["waitingOnStudents", "credit-registration-summary-waiting"],
  ["undeliverableEmails", "credit-registration-summary-undeliverable-emails"],
] as const satisfies readonly (readonly [keyof CreditRegistrationCourseCounts, string])[]

interface SummaryLineProps {
  courseId: string
  /** Narrows the roster below to registrations needing attention. */
  onShowNeedsAttention: () => void
}

/** How the course's credits are going, in one line, before any student row. */
export const CreditRegistrationSummaryLine: React.FC<SummaryLineProps> = ({
  courseId,
  onShowNeedsAttention,
}) => {
  const { t } = useTranslation()
  const summaryQuery = useQuery(
    getCourseCreditRegistrationSummaryOptions({ path: { course_id: courseId } }),
  )

  return (
    <QueryResult query={summaryQuery} refreshIndicator={QUIET_REFRESH}>
      {(summary) => {
        const counts = summarizeCreditRegistrationCounts(summary)
        if (counts.total === 0) {
          return null
        }
        return (
          <p className={noteCss}>
            {t("credit-registration-summary-registered", {
              registered: counts.registered,
              total: counts.total,
            })}
            {NEEDS_ATTENTION_SEGMENTS.filter(([field]) => counts[field] > 0).map(([field, key]) => (
              <React.Fragment key={key}>
                {MIDDLE_DOT}
                <button type="button" className={statusTriggerCss} onClick={onShowNeedsAttention}>
                  <span>{t(key, { count: counts[field] })}</span>
                </button>
              </React.Fragment>
            ))}
          </p>
        )
      }}
    </QueryResult>
  )
}

/** The course's credit registration detail: by-module counts, configuration problems, and the retry/export controls. */
const CourseCreditRegistrationSummaryPanel: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  const [showUnlinked, setShowUnlinked] = useState(false)
  const summaryQuery = useQuery(
    getCourseCreditRegistrationSummaryOptions({ path: { course_id: courseId } }),
  )
  const configsQuery = useQuery(
    getCourseCreditRegistrationModuleConfigsOptions({ path: { course_id: courseId } }),
  )

  return (
    <QueryResult query={summaryQuery} refreshIndicator={QUIET_REFRESH}>
      {(summary) => {
        const enabledModules = summary.modules.filter((module) => module.enabled)
        if (enabledModules.length === 0) {
          return null
        }
        const failedCount = sumBy(enabledModules, (module) => module.failed_permanent_count)
        const configOf = (moduleId: string) =>
          configsQuery.data?.modules.find((config) => config.course_module_id === moduleId)

        return (
          <section className={sectionCss}>
            <h2 className={headingCss}>{t("heading-credit-registration")}</h2>
            <div className={subsectionCss}>
              <h3 className={subheadingCss}>{t("heading-credit-registration-by-module")}</h3>
              <Table
                caption={t("heading-credit-registration-by-module")}
                rowKey={(module) => module.course_module_id}
                rows={enabledModules}
                columns={[
                  {
                    header: t("module"),
                    cell: (module) => (
                      <span className={rowCss}>
                        <span>{module.course_module_name ?? t("default-module")}</span>
                        {module.paused && (
                          <Badge tone={TONE.NEUTRAL}>
                            {t("credit-registration-module-paused")}
                          </Badge>
                        )}
                      </span>
                    ),
                  },
                  {
                    header: t("label-credit-registration-registered-of-completions"),
                    align: ALIGN_END,
                    cell: (module) => module.success_count,
                  },
                  {
                    header: t("completions"),
                    align: ALIGN_END,
                    cell: (module) => liveRowCount(module),
                  },
                  {
                    header: t("credit-registration-column-failed"),
                    align: ALIGN_END,
                    cell: (module) => module.failed_permanent_count,
                  },
                  {
                    header: t("credit-registration-column-needs-an-admin"),
                    align: ALIGN_END,
                    cell: (module) => module.needs_admin_attention_count,
                  },
                ]}
              />
              <CreditRegistrationConfigCallout
                configs={enabledModules.map((module) => ({
                  moduleName: module.course_module_name ?? t("default-module"),
                  config: configOf(module.course_module_id),
                }))}
                fixHref={manageCourseModulesRoute(courseId)}
              />
              <div className={rowCss}>
                <Button
                  variant="secondary"
                  size="medium"
                  type="button"
                  onClick={() => setShowUnlinked(true)}
                >
                  {t("button-text-list-students-waiting-for-a-student-number")}
                </Button>
                <CreditRegistrationExportLink courseId={courseId} />
              </div>
            </div>
            <RetryFailedCreditRegistrationsBlock courseId={courseId} failedCount={failedCount} />
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
