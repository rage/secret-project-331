"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseCreditRegistrationModuleConfigsOptions,
  getCourseCreditRegistrationSummaryOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseCreditRegistrationModuleSummary } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  QueryResult,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

import { ALIGN_END, QUIET_REFRESH, TONE } from "./constants"
import CourseCreditRegistrationActionsPanel from "./CourseCreditRegistrationActionsPanel"
import CreditRegistrationConfigCallout from "./CreditRegistrationConfigCallout"
import CreditRegistrationExportLink from "./CreditRegistrationExportLink"
import RetryFailedCreditRegistrationsBlock from "./RetryFailedCreditRegistrationsBlock"
import { headingCss, rowCss, sectionCss } from "./styles"
import UnlinkedStudentsDialog from "./UnlinkedStudentsDialog"

interface Props {
  courseId: string
}

const rootCss = css`
  display: grid;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
`

const liveRowCount = (module: CourseCreditRegistrationModuleSummary): number =>
  module.counts_by_state.reduce((total, row) => total + row.count, 0)

const sumBy = (
  modules: CourseCreditRegistrationModuleSummary[],
  pick: (module: CourseCreditRegistrationModuleSummary) => number,
): number => modules.reduce((total, module) => total + pick(module), 0)

/** Whether the course's credits are going through, and who is stuck, before any student row. */
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
        const attentionCount = sumBy(enabledModules, (module) => module.needs_admin_attention_count)
        const configOf = (moduleId: string) =>
          configsQuery.data?.modules.find((config) => config.course_module_id === moduleId)

        return (
          <section className={rootCss}>
            <section className={sectionCss}>
              <h2 className={headingCss}>{t("heading-credit-registration")}</h2>
              <StatTileList ariaLabel={t("heading-credit-registration")}>
                <StatTile
                  label={t("label-credit-registration-failed")}
                  value={failedCount}
                  {...includeIf(failedCount > 0, { tone: TONE.ALERT })}
                />
                <StatTile
                  label={t("label-credit-registration-needs-attention")}
                  value={attentionCount}
                  {...includeIf(attentionCount > 0, { tone: TONE.ALERT })}
                />
                <StatTile
                  label={t("label-credit-registration-unlinked-enrolled-students")}
                  value={summary.unlinked_enrolled_student_count}
                />
                <StatTile
                  label={t("label-credit-registration-emails-we-could-not-send")}
                  value={summary.linking_emails_failed_to_send_count}
                  {...includeIf(summary.linking_emails_failed_to_send_count > 0, {
                    tone: TONE.ALERT,
                  })}
                />
              </StatTileList>
            </section>

            <section className={sectionCss}>
              <h3 className={headingCss}>{t("heading-credit-registration-by-module")}</h3>
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
                          <Badge tone={TONE.WARNING}>
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
              {enabledModules.map((module) => (
                <CreditRegistrationConfigCallout
                  key={module.course_module_id}
                  config={configOf(module.course_module_id)}
                  moduleName={module.course_module_name ?? t("default-module")}
                  fixHref={manageCourseModulesRoute(courseId)}
                />
              ))}
            </section>

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
