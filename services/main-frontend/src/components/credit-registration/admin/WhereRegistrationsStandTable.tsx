"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationStepCount } from "@/generated/api/types.generated"
import { Link, Table } from "@/shared-module/components"

import {
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  LINK_INHERIT,
  MIDDLE_DOT,
  TABLE_STACK,
} from "../constants"
import { noteCss } from "../styles"
import { TONE_INK } from "./AdminStateLabel"
import { registrationsListHref } from "./registrationsListUrl"
import {
  ATTENTION_STEPS,
  ENGAGEMENTS,
  engagementLabel,
  TIMELINE_STEPS,
  timelinePhaseLabel,
  timelineStepLabel,
} from "./timelineSteps"

const stepCellCss = css`
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`

const countLinkCss = css`
  font-variant-numeric: tabular-nums;
`

const stepCountOrder = (row: CreditRegistrationStepCount): number =>
  TIMELINE_STEPS.indexOf(row.step) * ENGAGEMENTS.length +
  (row.engagement ? ENGAGEMENTS.indexOf(row.engagement) : 0)

/** The non-zero counts in timeline order, so the table can group them by phase. */
export const orderedStepCounts = (
  counts: readonly CreditRegistrationStepCount[],
): CreditRegistrationStepCount[] =>
  counts.filter((row) => row.count > 0).toSorted((a, b) => stepCountOrder(a) - stepCountOrder(b))

/**
 * "Where registrations stand": live registrations per step under their phase, each count linking to
 * the Registrations tab filtered to exactly those rows. Pass `courseModuleId` when the counts are
 * one module's, so the links narrow to it too.
 */
const WhereRegistrationsStandTable: React.FC<{
  counts: readonly CreditRegistrationStepCount[]
  labelledBy: string
  courseModuleId?: string
}> = ({ counts, labelledBy, courseModuleId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <Table
      labelledBy={labelledBy}
      density={DENSITY_COMPACT}
      responsive={TABLE_STACK}
      rowKey={(row) => `${row.step}:${row.engagement ?? ""}`}
      rows={orderedStepCounts(counts)}
      rowGroup={(row) => ({ key: row.phase, label: timelinePhaseLabel(t, row.phase) })}
      columns={[
        {
          header: t("credit-registration-admin-filter-step"),
          grow: 1,
          minWidth: "14rem",
          cell: (row) => (
            <span
              className={cx(
                stepCellCss,
                ATTENTION_STEPS.has(row.step) && TONE_INK["action-needed"],
              )}
            >
              {timelineStepLabel(t, row.step)}
              {row.engagement && (
                <span className={noteCss}>
                  {MIDDLE_DOT}
                  {engagementLabel(t, row.engagement)}
                </span>
              )}
            </span>
          ),
        },
        {
          header: t("label-count"),
          align: ALIGN_END,
          minWidth: "5rem",
          nowrap: true,
          cell: (row) => (
            <Link
              href={registrationsListHref({
                steps: [row.step],
                engagements: row.engagement ? [row.engagement] : [],
                ...(courseModuleId ? { courseModuleId } : {}),
              })}
              appearance={LINK_INHERIT}
              className={countLinkCss}
              aria-label={t("credit-registration-admin-open-count", {
                count: row.count,
                step: row.engagement
                  ? `${timelineStepLabel(t, row.step)}${MIDDLE_DOT}${engagementLabel(t, row.engagement)}`
                  : timelineStepLabel(t, row.step),
              })}
            >
              {row.count}
            </Link>
          ),
        },
      ]}
    />
  )
}

export default WhereRegistrationsStandTable
