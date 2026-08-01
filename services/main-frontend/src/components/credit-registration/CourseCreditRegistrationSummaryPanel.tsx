"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationSummaryOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseCreditRegistrationModuleSummary } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Badge, Meter, StatTile } from "@/shared-module/components"

import BlockedStudentsDialog from "./BlockedStudentsDialog"

interface Props {
  courseId: string
}

const rootCss = css`
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
`

const headingCss = css`
  font-weight: 500;
`

const modulesCss = css`
  display: grid;
  gap: 0.75rem;
`

const moduleRowCss = css`
  display: grid;
  gap: 0.25rem;
`

const moduleHeaderCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`

const tilesCss = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
`

// oxlint-disable-next-line i18next/no-literal-string
const PAUSED_TONE = "warning" as const
// oxlint-disable-next-line i18next/no-literal-string
const ALERT_TONE = "alert" as const
// oxlint-disable-next-line i18next/no-literal-string
const SUCCESS_TONE = "success" as const
// oxlint-disable-next-line i18next/no-literal-string
const NEUTRAL_TONE = "neutral" as const
// The state the drill-down lists: the case a teacher gets asked about in person.
// oxlint-disable-next-line i18next/no-literal-string
const WAITING_FOR_STUDENT_NUMBER = "pending_student_number" as const

const tileButtonCss = css`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

const liveRowCount = (module: CourseCreditRegistrationModuleSummary): number =>
  module.counts_by_state.reduce((total, row) => total + row.count, 0)

/**
 * "How many of my students will not get credits, and why", for the modules of this course that
 * register automatically. Absent entirely when no module does.
 */
const CourseCreditRegistrationSummaryPanel: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  const [showBlocked, setShowBlocked] = useState(false)
  const summaryQuery = useQuery(
    getCourseCreditRegistrationSummaryOptions({ path: { course_id: courseId } }),
  )
  const enabledModules = summaryQuery.data?.modules.filter((module) => module.enabled) ?? []
  if (enabledModules.length === 0) {
    return null
  }
  const summary = summaryQuery.data
  if (!summary) {
    return null
  }

  return (
    <section className={rootCss}>
      <div className={headingCss}>{t("heading-credit-registration")}</div>
      <div className={modulesCss}>
        {enabledModules.map((module) => {
          const total = liveRowCount(module)
          return (
            <div className={moduleRowCss} key={module.course_module_id}>
              <div className={moduleHeaderCss}>
                <span>{module.course_module_name ?? t("default-module")}</span>
                {module.paused && (
                  <Badge tone={PAUSED_TONE}>{t("credit-registration-module-paused")}</Badge>
                )}
              </div>
              <Meter
                value={module.success_count}
                maxValue={Math.max(total, 1)}
                tone={module.failed_permanent_count > 0 ? NEUTRAL_TONE : SUCCESS_TONE}
                label={t("label-credit-registration-registered-of-completions")}
                valueLabel={t("credit-registration-registered-of-total", {
                  registered: module.success_count,
                  total,
                })}
                showLabel
              />
              <div className={tilesCss}>
                <StatTile
                  label={t("label-credit-registration-failed")}
                  value={module.failed_permanent_count}
                  {...includeIf(module.failed_permanent_count > 0, { tone: ALERT_TONE })}
                />
                <StatTile
                  label={t("label-credit-registration-needs-attention")}
                  value={module.needs_admin_attention_count}
                  {...includeIf(module.needs_admin_attention_count > 0, { tone: ALERT_TONE })}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className={tilesCss}>
        <button
          type="button"
          className={tileButtonCss}
          onClick={() => setShowBlocked(true)}
          aria-label={t("button-text-list-students-waiting-for-a-student-number")}
        >
          <StatTile
            label={t("label-credit-registration-unlinked-consented-students")}
            value={summary.blocked_students.unlinked_consented_student_count}
          />
        </button>
        <StatTile
          label={t("label-credit-registration-students-without-consent")}
          value={summary.blocked_students.no_consent_student_count}
        />
        <StatTile
          label={t("label-credit-registration-emails-we-could-not-send")}
          value={summary.linking_emails_failed_to_send_count}
          {...includeIf(summary.linking_emails_failed_to_send_count > 0, { tone: ALERT_TONE })}
        />
      </div>
      {showBlocked && (
        <BlockedStudentsDialog
          courseId={courseId}
          state={WAITING_FOR_STUDENT_NUMBER}
          title={t("label-credit-registration-unlinked-consented-students")}
          open={showBlocked}
          onClose={() => setShowBlocked(false)}
        />
      )}
    </section>
  )
}

export default CourseCreditRegistrationSummaryPanel
