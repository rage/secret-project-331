"use client"

import { css, cx } from "@emotion/css"
import type { EChartsOption } from "echarts"
import React, { useId, useMemo, useState } from "react"
import { useDateFormatter } from "react-aria"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import {
  HOUR_SECS,
  useCreditRegistrationErrorsByCode,
  useCreditRegistrationOverview,
  useCreditRegistrationPhases,
  useCreditRegistrationPipelineHistory,
  useCreditRegistrationReconciliation,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import { TONE_INK } from "@/components/credit-registration/admin/AdminStateLabel"
import { CreditRegistrationAttentionSection } from "@/components/credit-registration/admin/CreditRegistrationAlertBanner"
import {
  AXIS_TOOLTIP,
  GRID_LINE_COLOR,
  hasDrawableSegment,
  LINE_WIDTH,
  missingDaysMarkArea,
  MONTH_DAYS,
  readHistoryDays,
} from "@/components/credit-registration/admin/historyChart"
import HistoryRangeChips from "@/components/credit-registration/admin/HistoryRangeChips"
import ReconciliationSection from "@/components/credit-registration/admin/ReconciliationSection"
import { registrationsListHref } from "@/components/credit-registration/admin/registrationsListUrl"
import {
  ATTENTION_STEPS,
  ENGAGEMENTS,
  engagementLabel,
  FINISHED_STEPS,
  STEPS_BY_PHASE,
  TIMELINE_PHASES,
  timelinePhaseLabel,
  timelineStepLabel,
} from "@/components/credit-registration/admin/timelineSteps"
import {
  DAY_SECS,
  useWindowSecsParam,
  WEEK_SECS,
  WindowSecsSelect,
} from "@/components/credit-registration/admin/WindowSecsSelect"
import {
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DAY_AND_MONTH_FORMAT,
  DENSITY_COMPACT,
  LINK_INHERIT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TABLE_STACK,
} from "@/components/credit-registration/constants"
import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
import {
  controlCss,
  emptyStateCss,
  headingCss,
  noteCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionCss,
} from "@/components/credit-registration/styles"
import { formatZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type {
  CreditRegistrationHistory,
  CreditRegistrationOverview,
  CreditRegistrationStepCount,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { creditRegistrationErrorsRoute } from "@/shared-module/common/utils/routes"
import { Link, QueryResult, StatTile, StatTileList, Table } from "@/shared-module/components"

const TREND_CHART_HEIGHT = 300
const TILE_COLUMNS = 5
const SNAPSHOT_PHASE = "ledger-snapshot"
const NEEDS_ATTENTION_LINE = "needs_attention" as const

/** The phases a trend line is drawn for; the endings only ever grow, which would flatten the rest. */
const TREND_PHASES = ["course", "student_number", "registering", "confirmation"] as const

/** Hex and not a CSS variable: ECharts cannot resolve one. Red is for Needs attention alone. */
const TREND_COLORS = {
  course: baseTheme.colors.gray[500],
  student_number: baseTheme.colors.yellow[800],
  registering: baseTheme.colors.blue[600],
  confirmation: baseTheme.colors.green[700],
  needs_attention: baseTheme.colors.crimson[600],
} as const

/** No heading needed: the control's own floating label covers it. Left-aligned like the rest of
 *  the page — pushed right it would have nothing to sit against. */
const windowRowCss = css`
  display: flex;
`

const stepCellCss = css`
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`

const countLinkCss = css`
  font-variant-numeric: tabular-nums;
`

/** How a period's tiles name it: "in the last 7 days". */
const periodLabel = (t: CreditRegistrationTFunction, windowSecs: number): string => {
  switch (windowSecs) {
    case HOUR_SECS:
      return t("credit-registration-admin-period-hour")
    case DAY_SECS:
      return t("credit-registration-admin-period-day")
    case WEEK_SECS:
      return t("credit-registration-admin-period-week")
    default:
      return t("credit-registration-admin-period-month")
  }
}

/** How the period's finished registrations ended, and how many need a person now. */
const ThroughputSection: React.FC<{ needsAttentionCount: number | undefined }> = ({
  needsAttentionCount,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { control, windowSecs } = useWindowSecsParam(WEEK_SECS)
  const errorsQuery = useCreditRegistrationErrorsByCode(windowSecs)
  const period = periodLabel(t, windowSecs)

  return (
    <div className={sectionCss}>
      <div className={windowRowCss}>
        <div className={controlCss}>
          <WindowSecsSelect control={control} includeMonth />
        </div>
      </div>
      <QueryResult query={errorsQuery} refreshIndicator={QUIET_REFRESH}>
        {({ verdicts }) => (
          <StatTileList
            ariaLabel={t("credit-registration-heading-verdicts")}
            maxColumns={TILE_COLUMNS}
          >
            {needsAttentionCount !== undefined && (
              <StatTile
                label={t("credit-registration-admin-tile-needs-attention")}
                value={needsAttentionCount}
                href={creditRegistrationErrorsRoute()}
                alertWhenNonZero
              />
            )}
            <StatTile
              label={t("credit-registration-admin-tile-registered", { period })}
              value={verdicts.registered_count}
            />
            <StatTile
              label={t("credit-registration-admin-tile-already-in-sisu", { period })}
              value={verdicts.duplicate_and_not_improved_count}
            />
            <StatTile
              label={t("credit-registration-admin-tile-stopped", { period })}
              value={verdicts.failed_permanent_count}
              alertWhenNonZero
            />
            <StatTile
              label={t("credit-registration-admin-tile-cancelled", { period })}
              value={verdicts.cancelled_count}
            />
          </StatTileList>
        )}
      </QueryResult>
    </div>
  )
}

const ORDERED_STEPS = TIMELINE_PHASES.flatMap((phase) => STEPS_BY_PHASE[phase])

const stepCountOrder = (row: CreditRegistrationStepCount): number =>
  ORDERED_STEPS.indexOf(row.step) * ENGAGEMENTS.length +
  (row.engagement ? ENGAGEMENTS.indexOf(row.engagement) : 0)

/**
 * Every step with live registrations, under its phase, in the timeline's words. Each count links to
 * the Registrations tab filtered to exactly those rows.
 */
const WhereRegistrationsStandSection: React.FC<{ overview: CreditRegistrationOverview }> = ({
  overview,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const rows = overview.where_registrations_stand
    .filter((row) => row.count > 0)
    .toSorted((a, b) => stepCountOrder(a) - stepCountOrder(b))

  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-states")}
        </h2>
      </div>
      <p className={noteCss}>
        {t("credit-registration-admin-where-registrations-stand-note")}{" "}
        <Link href={registrationsListHref({ engagements: ["not_started"] })}>
          {t("credit-registration-admin-show-not-started-link")}
        </Link>
      </p>
      {rows.length === 0 ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-registrations")}</p>
      ) : (
        <Table
          labelledBy={headingId}
          density={DENSITY_COMPACT}
          responsive={TABLE_STACK}
          rowKey={(row) => `${row.step}:${row.engagement ?? ""}`}
          rows={rows}
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
      )}
    </section>
  )
}

/** One line per phase, Not started and finished registrations left out, and the Needs attention count. */
const PhaseTrendChart: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const dayFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)
  const { points, days, snapshotOf } = useMemo(() => readHistoryDays(history), [history])

  const series = useMemo(() => {
    const phaseLines = TREND_PHASES.map((phase) => ({
      line: phase,
      label: timelinePhaseLabel(t, phase),
      points: days.map((day) => {
        const steps = snapshotOf(day)?.steps ?? []
        // Days before step snapshots began have no steps at all, which is no data, not zero.
        if (steps.length === 0) {
          return null
        }
        return steps
          .filter(
            (point) =>
              point.phase === phase &&
              !FINISHED_STEPS.has(point.step) &&
              point.engagement !== "not_started",
          )
          .reduce((sum, point) => sum + point.count, 0)
      }),
    }))
    const attentionLine = {
      line: NEEDS_ATTENTION_LINE,
      label: t("credit-registration-tab-errors"),
      points: days.map((day) => snapshotOf(day)?.needs_attention_count ?? null),
    }
    return [...phaseLines, attentionLine]
  }, [days, snapshotOf, t])

  const gapMarkArea = missingDaysMarkArea(points, t("credit-registration-admin-no-snapshot-day"))
  const options: EChartsOption = {
    tooltip: AXIS_TOOLTIP,
    // Above the plot: at the bottom it lands on the dates, and one of the two has to be read.
    legend: { data: series.map((one) => one.label), top: 0 },
    // The legend can wrap to two rows at phone width, so top has to clear both.
    grid: { left: 52, right: 16, top: 72, bottom: 32 },
    xAxis: {
      type: "category",
      data: days,
      boundaryGap: false,
      axisLabel: { formatter: (value: string) => dayFormatter.format(new Date(value)) },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
    },
    series: series.map((one, index) => ({
      name: one.label,
      type: "line",
      showSymbol: !hasDrawableSegment(one.points),
      connectNulls: false,
      lineStyle: { width: LINE_WIDTH },
      itemStyle: { color: TREND_COLORS[one.line] },
      data: one.points,
      ...(index === 0 && gapMarkArea !== null ? { markArea: gapMarkArea } : {}),
    })),
  }
  return <Echarts options={options} height={TREND_CHART_HEIGHT} />
}

const TrendSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const [historyDays, setHistoryDays] = useState(MONTH_DAYS)
  const historyQuery = useCreditRegistrationPipelineHistory(historyDays)
  const nextSnapshotAt = useCreditRegistrationPhases().data?.phases.find(
    (phase) => phase.phase === SNAPSHOT_PHASE,
  )?.next_run_at

  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-queue-depth")}
        </h2>
        <HistoryRangeChips days={historyDays} onChange={setHistoryDays} />
      </div>
      {nextSnapshotAt && (
        <p className={noteCss}>
          {t("credit-registration-admin-next-snapshot", {
            time: formatZonedTimestamp(new Date(nextSnapshotAt)),
          })}
        </p>
      )}
      <QueryResult query={historyQuery} refreshIndicator={QUIET_REFRESH}>
        {(history) => {
          const daysWithSteps = history.days.filter((day) => day.steps.length > 0).length
          // Below two days every line is isolated points, and the chart is almost entirely the
          // shading that marks the days with no snapshot.
          return daysWithSteps < 2 ? (
            <p className={emptyStateCss}>
              {daysWithSteps === 0
                ? t("credit-registration-admin-no-step-snapshots")
                : t("credit-registration-admin-one-snapshot-only")}
            </p>
          ) : (
            <PhaseTrendChart history={history} />
          )
        }}
      </QueryResult>
    </section>
  )
}

/** Whether anything is wrong, how the period's registrations ended, where the rest stand, and the trend. */
const OverviewPage: React.FC = () => {
  const overviewQuery = useCreditRegistrationOverview()
  const reconciliationQuery = useCreditRegistrationReconciliation()

  return (
    <div className={sectionCardsCss}>
      {/* What is wrong right now and how the period went: the summary the reader came for, so it
          opens the page uncarded rather than framed as one section among several. */}
      <div className={sectionCss}>
        <ThroughputSection needsAttentionCount={overviewQuery.data?.needs_attention_count} />
        <CreditRegistrationAttentionSection />
      </div>
      <QueryResult query={overviewQuery} refreshIndicator={QUIET_REFRESH}>
        {(overview) => <WhereRegistrationsStandSection overview={overview} />}
      </QueryResult>
      <TrendSection />
      <QueryResult query={reconciliationQuery} refreshIndicator={QUIET_REFRESH}>
        {(reconciliation) => <ReconciliationSection reconciliation={reconciliation} />}
      </QueryResult>
    </div>
  )
}

export default OverviewPage
