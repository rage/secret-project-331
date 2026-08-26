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
import { Badge, Meter, QueryResult, StatTile } from "@/shared-module/components"

import BlockedStudentsDialog from "./BlockedStudentsDialog"
import { TONE } from "./constants"
import CourseCreditRegistrationActionsPanel from "./CourseCreditRegistrationActionsPanel"
import CreditRegistrationConfigCallout from "./CreditRegistrationConfigCallout"
import CreditRegistrationExportLink from "./CreditRegistrationExportLink"
import RetryFailedCreditRegistrationsBlock from "./RetryFailedCreditRegistrationsBlock"
import { tilesCss } from "./styles"

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

// oxlint-disable-next-line i18next/no-literal-string
const WAITING_FOR_STUDENT_NUMBER = "needs_student_number" as const

const actionsRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
`

const tileButtonCss = css`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

const liveRowCount = (module: CourseCreditRegistrationModuleSummary): number =>
  module.counts_by_state.reduce((total, row) => total + row.count, 0)

const CourseCreditRegistrationSummaryPanel: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  const [showBlocked, setShowBlocked] = useState(false)
  const summaryQuery = useQuery(
    getCourseCreditRegistrationSummaryOptions({ path: { course_id: courseId } }),
  )
  const configsQuery = useQuery(
    getCourseCreditRegistrationModuleConfigsOptions({ path: { course_id: courseId } }),
  )

  return (
    <QueryResult query={summaryQuery}>
      {(summary) => {
        const enabledModules = summary.modules.filter((module) => module.enabled)
        if (enabledModules.length === 0) {
          return null
        }
        return (
          <section className={rootCss}>
            <h2 className={headingCss}>{t("heading-credit-registration")}</h2>
            <div className={modulesCss}>
              {enabledModules.map((module) => {
                const total = liveRowCount(module)
                return (
                  <div className={moduleRowCss} key={module.course_module_id}>
                    <div className={moduleHeaderCss}>
                      <span>{module.course_module_name ?? t("default-module")}</span>
                      {module.paused && (
                        <Badge tone={TONE.WARNING}>{t("credit-registration-module-paused")}</Badge>
                      )}
                    </div>
                    <CreditRegistrationConfigCallout
                      config={configsQuery.data?.modules.find(
                        (config) => config.course_module_id === module.course_module_id,
                      )}
                      fixHref={`/manage/courses/${courseId}/pages`}
                    />
                    <Meter
                      value={module.success_count}
                      maxValue={Math.max(total, 1)}
                      tone={module.failed_permanent_count > 0 ? TONE.NEUTRAL : TONE.SUCCESS}
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
                        {...includeIf(module.failed_permanent_count > 0, { tone: TONE.ALERT })}
                      />
                      <StatTile
                        label={t("label-credit-registration-needs-attention")}
                        value={module.needs_admin_attention_count}
                        {...includeIf(module.needs_admin_attention_count > 0, { tone: TONE.ALERT })}
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
                {...includeIf(summary.linking_emails_failed_to_send_count > 0, {
                  tone: TONE.ALERT,
                })}
              />
            </div>
            <div className={actionsRowCss}>
              <RetryFailedCreditRegistrationsBlock courseId={courseId} />
              <CreditRegistrationExportLink courseId={courseId} />
            </div>
            <CourseCreditRegistrationActionsPanel courseId={courseId} />
            {showBlocked && (
              <BlockedStudentsDialog
                courseId={courseId}
                status={WAITING_FOR_STUDENT_NUMBER}
                title={t("label-credit-registration-unlinked-consented-students")}
                open={showBlocked}
                onClose={() => setShowBlocked(false)}
              />
            )}
          </section>
        )
      }}
    </QueryResult>
  )
}

export default CourseCreditRegistrationSummaryPanel
