"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "../lib/displayConstants"
import { computeModuleTimings } from "../lib/durations"

import Duration from "./Duration"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"
import { Badge, Meter } from "@/shared-module/components"

export interface ModuleCompletionsTableProps {
  enrollment: CourseEnrollmentInfo
}

const tableCss = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;

  th,
  td {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--color-clear-300, #e2e4e6);
    vertical-align: top;
  }

  th {
    color: var(--color-gray-500, #535a66);
    font-weight: 600;
  }

  td {
    color: var(--color-gray-700, #1a2333);
    font-variant-numeric: tabular-nums;
  }
`

const gapCellCss = css`
  min-width: 8rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`

const badgeRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
`

const emptyCss = css`
  color: var(--color-gray-500, #535a66);
  font-style: italic;
  padding: 0.5rem 0;
`

/**
 * Per-module completion breakdown: each module's completion time and derived durations (cumulative
 * since enrollment, and gap since the previous completion). The gap bar is inverted — shorter gaps
 * are fuller and, when suspiciously short, red — so "too fast" rows stand out. Durations are derived
 * from `completion_date`; per-module durations are not stored.
 */
// Gaps shorter than this are implausible for genuine work; highlighted in red.
const SUSPICIOUSLY_FAST_GAP_SECONDS = 300
const ModuleCompletionsTable: React.FC<ModuleCompletionsTableProps> = ({ enrollment }) => {
  const { t } = useTranslation()

  const enrolledAt = new Date(enrollment.first_enrolled_at)
  const timings = computeModuleTimings(
    enrollment.course_module_completions,
    (c) => new Date(c.completion_date),
    enrolledAt,
  )

  if (timings.length === 0) {
    return <p className={emptyCss}>{t("no-module-completions-yet")}</p>
  }

  const moduleName = (courseModuleId: string): string => {
    const module = enrollment.course_modules.find((m) => m.id === courseModuleId)
    return module?.name ?? t("default-module")
  }

  const maxGap = Math.max(1, ...timings.map((row) => row.gapSeconds ?? 0))

  return (
    <table className={tableCss}>
      <thead>
        <tr>
          <th scope="col">{t("label-module")}</th>
          <th scope="col">{t("label-completed")}</th>
          <th scope="col">{t("label-since-enrolled")}</th>
          <th scope="col">{t("label-gap-since-previous")}</th>
          <th scope="col">{t("label-result")}</th>
        </tr>
      </thead>
      <tbody>
        {timings.map(({ completion, completedAt, sinceEnrollmentSeconds, gapSeconds }) => (
          <tr key={completion.id}>
            <td>{moduleName(completion.course_module_id)}</td>
            <td>{dateToString(completedAt)}</td>
            <td>
              <Duration seconds={sinceEnrollmentSeconds} />
            </td>
            <td>
              <div className={gapCellCss}>
                {gapSeconds === null ? (
                  <span>{t("first-completion-dash")}</span>
                ) : (
                  <Duration seconds={gapSeconds} />
                )}
                {gapSeconds !== null ? (
                  <Meter
                    label={t("gap-since-previous-for-module", {
                      module: moduleName(completion.course_module_id),
                    })}
                    value={maxGap - gapSeconds}
                    maxValue={maxGap}
                    showLabel={false}
                    tone={gapSeconds < SUSPICIOUSLY_FAST_GAP_SECONDS ? TONE.DANGER : TONE.NEUTRAL}
                  />
                ) : null}
              </div>
            </td>
            <td>
              <div className={badgeRowCss}>
                {completion.passed ? (
                  <Badge tone={TONE.SUCCESS}>
                    {completion.grade !== null && completion.grade !== undefined
                      ? t("passed-with-grade", { grade: completion.grade })
                      : t("label-passed")}
                  </Badge>
                ) : (
                  <Badge tone={TONE.NEUTRAL}>{t("label-not-passed")}</Badge>
                )}
                {completion.needs_to_be_reviewed ? (
                  <Badge tone={TONE.WARNING} title={t("hidden-from-student-explanation")}>
                    {t("badge-hidden-from-student")}
                  </Badge>
                ) : null}
                {completion.completion_granter_user_id ? (
                  <Badge tone={TONE.INFO}>{t("badge-manual-completion")}</Badge>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default ModuleCompletionsTable
