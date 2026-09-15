"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  ABSENT,
  DENSITY_COMPACT,
  TIME_DATE,
  TONE,
} from "@/components/credit-registration/constants"
import CreditRegistrationStatusCell from "@/components/credit-registration/CreditRegistrationStatusCell"
import { emptyStateCss, rowCss } from "@/components/credit-registration/styles"
import type {
  CourseCreditRegistration,
  CourseEnrollmentInfo,
  CourseModuleCompletion,
} from "@/generated/api/types.generated"
import { Badge, RelativeTime, Table, type TableColumn } from "@/shared-module/components"

import { computeModuleTimings, type ModuleTiming } from "../lib/durations"
import Duration from "./Duration"

export interface ModuleCompletionsTableProps {
  enrollment: CourseEnrollmentInfo
  /**
   * This course's credit registrations keyed by module. Null leaves the Credits column out
   * entirely — either the viewer may not read registrations, or the course has none.
   */
  registrationByModuleId: Map<string, CourseCreditRegistration> | null
}

/** Gaps shorter than this are implausible for genuine work. */
const SUSPICIOUSLY_FAST_GAP_SECONDS = 300

const stackedDurationCss = css`
  display: grid;
  gap: 2px;
`

const secondaryDurationCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

const suspiciouslyFastCss = css`
  color: var(--color-crimson-700);
`

/**
 * Per-module completion breakdown: time since enrolment, time since the previous module, and
 * where its credits got to in Sisu. Both durations come from `completion_date`; neither is stored.
 */
const ModuleCompletionsTable: React.FC<ModuleCompletionsTableProps> = ({
  enrollment,
  registrationByModuleId,
}) => {
  const { t } = useTranslation()

  const enrolledAt = new Date(enrollment.first_enrolled_at)
  const timings = computeModuleTimings(
    enrollment.course_module_completions,
    (c) => new Date(c.completion_date),
    enrolledAt,
  )

  if (timings.length === 0) {
    return <p className={emptyStateCss}>{t("no-module-completions-yet")}</p>
  }

  const moduleName = (courseModuleId: string): string => {
    const courseModule = enrollment.course_modules.find((m) => m.id === courseModuleId)
    return courseModule?.name ?? t("default-module")
  }

  const columns: TableColumn<ModuleTiming<CourseModuleCompletion>>[] = [
    {
      header: t("label-module"),
      grow: true,
      cell: (row) => moduleName(row.completion.course_module_id),
    },
    {
      header: t("label-completed"),
      nowrap: true,
      cell: (row) => <RelativeTime at={row.completedAt.toISOString()} absoluteTime={TIME_DATE} />,
    },
    {
      header: t("label-since-enrolled"),
      nowrap: true,
      cell: (row) => (
        <span className={stackedDurationCss}>
          <Duration seconds={row.sinceEnrollmentSeconds} />
          {row.gapSeconds !== null && (
            <span className={secondaryDurationCss}>
              {t("label-gap-since-previous")}
              <Duration seconds={row.gapSeconds} />
              {row.gapSeconds < SUSPICIOUSLY_FAST_GAP_SECONDS && (
                <span className={suspiciouslyFastCss}>
                  {t("badge-completed-under-minutes", {
                    minutes: SUSPICIOUSLY_FAST_GAP_SECONDS / 60,
                  })}
                </span>
              )}
            </span>
          )}
        </span>
      ),
    },
    {
      header: t("label-result"),
      cell: (row) => (
        <span className={rowCss}>
          {row.completion.passed ? (
            <Badge tone={TONE.SUCCESS}>
              {row.completion.grade !== null && row.completion.grade !== undefined
                ? t("passed-with-grade", { grade: row.completion.grade })
                : t("label-passed")}
            </Badge>
          ) : (
            <Badge tone={TONE.NEUTRAL}>{t("label-not-passed")}</Badge>
          )}
          {row.completion.needs_to_be_reviewed ? (
            <Badge tone={TONE.WARNING} title={t("hidden-from-student-explanation")}>
              {t("badge-hidden-from-student")}
            </Badge>
          ) : null}
          {row.completion.completion_granter_user_id ? (
            <Badge tone={TONE.INFO}>{t("badge-manual-completion")}</Badge>
          ) : null}
        </span>
      ),
    },
  ]

  if (registrationByModuleId) {
    columns.push({
      header: t("credit-registration-column-registration"),
      grow: true,
      cell: (row) => {
        const registration = registrationByModuleId.get(row.completion.course_module_id)
        return registration ? <CreditRegistrationStatusCell registration={registration} /> : ABSENT
      },
    })
  }

  return (
    <Table
      caption={t("heading-module-completions")}
      density={DENSITY_COMPACT}
      rowKey={(row) => row.completion.id}
      rows={timings}
      columns={columns}
    />
  )
}

export default ModuleCompletionsTable
