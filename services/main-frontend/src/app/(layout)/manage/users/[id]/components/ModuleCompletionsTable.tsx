"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ABSENT, DENSITY_COMPACT, TONE } from "@/components/credit-registration/constants"
import { emptyStateCss, rowCss } from "@/components/credit-registration/styles"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"
import { Badge, Table } from "@/shared-module/components"

import { computeModuleTimings } from "../lib/durations"
import Duration from "./Duration"

export interface ModuleCompletionsTableProps {
  enrollment: CourseEnrollmentInfo
}

/** Gaps shorter than this are implausible for genuine work. */
const SUSPICIOUSLY_FAST_GAP_SECONDS = 300

const gapCellCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
`

/**
 * Per-module completion breakdown: when each module was completed, how long after enrolment, and
 * how long after the module before it. Both durations are derived from `completion_date`; no
 * per-module duration is stored.
 */
const ModuleCompletionsTable: React.FC<ModuleCompletionsTableProps> = ({ enrollment }) => {
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

  return (
    <Table
      caption={t("heading-module-completions")}
      density={DENSITY_COMPACT}
      rowKey={(row) => row.completion.id}
      rows={timings}
      columns={[
        {
          header: t("label-module"),
          grow: true,
          cell: (row) => moduleName(row.completion.course_module_id),
        },
        {
          header: t("label-completed"),
          nowrap: true,
          cell: (row) => dateToString(row.completedAt),
        },
        {
          header: t("label-since-enrolled"),
          nowrap: true,
          cell: (row) => <Duration seconds={row.sinceEnrollmentSeconds} />,
        },
        {
          header: t("label-gap-since-previous"),
          nowrap: true,
          cell: (row) =>
            row.gapSeconds === null ? (
              ABSENT
            ) : (
              <span className={gapCellCss}>
                <Duration seconds={row.gapSeconds} />
                {row.gapSeconds < SUSPICIOUSLY_FAST_GAP_SECONDS && (
                  <Badge tone={TONE.DANGER}>
                    {t("badge-completed-under-minutes", {
                      minutes: SUSPICIOUSLY_FAST_GAP_SECONDS / 60,
                    })}
                  </Badge>
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
      ]}
    />
  )
}

export default ModuleCompletionsTable
