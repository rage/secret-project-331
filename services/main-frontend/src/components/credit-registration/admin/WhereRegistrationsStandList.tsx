"use client"

import { css } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationStepCount } from "@/generated/api/types.generated"
import { Link } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, LINK_INHERIT } from "../constants"
import { noteCss } from "../styles"
import { registrationsListHref } from "./registrationsListUrl"
import {
  ATTENTION_STEPS,
  ENGAGEMENTS,
  engagementLabel,
  TIMELINE_STEPS,
  timelinePhaseLabel,
  timelineStepLabel,
} from "./timelineSteps"

const groupsCss = css`
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
`

const groupNameCss = css`
  display: block;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-clear-300);
  color: var(--color-gray-700);
  font-size: var(--font-size-1);
  font-weight: 600;
`

const rowsCss = css`
  margin: 0;
  padding: 0;
  list-style: none;
`

/** The whole row is the link, indented under its phase. */
const rowLinkCss = css`
  display: flex;
  gap: var(--space-4);
  align-items: baseline;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4-5);
  border-bottom: 1px solid var(--color-clear-300);
  color: var(--color-gray-700);
  font-size: var(--font-size-1);
  text-decoration: none;

  &:hover {
    background: var(--color-clear-100);
  }
  &:hover > span:last-child {
    text-decoration: underline;
  }
  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: -2px;
  }
`

const stepCss = css`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 var(--space-3);
`

/** Keeps the icon on the label's first line when the label wraps. */
const labelCss = css`
  display: inline-flex;
  gap: var(--space-3);
  align-items: flex-start;
  min-width: 0;
`

const attentionIconCss = css`
  flex: none;
  margin-top: 0.2em;
  color: var(--color-crimson-600);
`

const countCss = css`
  font-variant-numeric: tabular-nums;
  font-weight: 600;
`

const ATTENTION_ICON_SIZE = 14

const stepCountOrder = (row: CreditRegistrationStepCount): number =>
  TIMELINE_STEPS.indexOf(row.step) * ENGAGEMENTS.length +
  (row.engagement ? ENGAGEMENTS.indexOf(row.engagement) : 0)

/** The non-zero counts in timeline order, so the table can group them by phase. */
export const orderedStepCounts = (
  counts: readonly CreditRegistrationStepCount[],
): CreditRegistrationStepCount[] =>
  counts.filter((row) => row.count > 0).toSorted((a, b) => stepCountOrder(a) - stepCountOrder(b))

/** Rows in timeline order, grouped under their phase. */
const groupByPhase = (
  rows: CreditRegistrationStepCount[],
): { phase: CreditRegistrationStepCount["phase"]; rows: CreditRegistrationStepCount[] }[] => {
  const groups: {
    phase: CreditRegistrationStepCount["phase"]
    rows: CreditRegistrationStepCount[]
  }[] = []
  for (const row of rows) {
    const last = groups.at(-1)
    if (last?.phase === row.phase) {
      last.rows.push(row)
    } else {
      groups.push({ phase: row.phase, rows: [row] })
    }
  }
  return groups
}

/**
 * "Where registrations stand": live registrations per step under their phase, each row linking to
 * the Registrations tab filtered to exactly those rows. Pass `courseModuleId` when the counts are
 * one module's, so the links narrow to it too.
 */
const WhereRegistrationsStandList: React.FC<{
  counts: readonly CreditRegistrationStepCount[]
  labelledBy: string
  courseModuleId?: string
}> = ({ counts, labelledBy, courseModuleId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <ul className={groupsCss} aria-labelledby={labelledBy}>
      {groupByPhase(orderedStepCounts(counts)).map((group) => (
        <li key={group.phase}>
          <span className={groupNameCss}>{timelinePhaseLabel(t, group.phase)}</span>
          <ul className={rowsCss}>
            {group.rows.map((row) => {
              const stepLabel = timelineStepLabel(t, row.step)
              const engagement = row.engagement ? engagementLabel(t, row.engagement) : null
              return (
                <li key={`${row.step}:${row.engagement ?? ""}`}>
                  <Link
                    href={registrationsListHref({
                      steps: [row.step],
                      engagements: row.engagement ? [row.engagement] : [],
                      ...(courseModuleId ? { courseModuleId } : {}),
                    })}
                    appearance={LINK_INHERIT}
                    className={rowLinkCss}
                    aria-label={t("credit-registration-admin-open-count", {
                      count: row.count,
                      step: engagement
                        ? t("credit-registration-admin-step-with-engagement", {
                            step: stepLabel,
                            engagement,
                          })
                        : stepLabel,
                    })}
                  >
                    <span className={stepCss}>
                      <span className={labelCss}>
                        {ATTENTION_STEPS.has(row.step) && (
                          <ExclamationTriangle
                            size={ATTENTION_ICON_SIZE}
                            className={attentionIconCss}
                          />
                        )}
                        <span>{stepLabel}</span>
                      </span>
                      {engagement && <span className={noteCss}>{engagement}</span>}
                    </span>
                    <span className={countCss}>{row.count}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export default WhereRegistrationsStandList
