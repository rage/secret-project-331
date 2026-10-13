"use client"

import type { EChartsOption } from "echarts"
import React, { useId, useMemo, useState } from "react"
import { useDateFormatter } from "react-aria"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import {
  useCreditRegistrationErrorsByCode,
  useCreditRegistrationOverview,
  useCreditRegistrationPhases,
  useCreditRegistrationPipelineHistory,
  useCreditRegistrationReconciliation,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import { CreditRegistrationAttentionSection } from "@/components/credit-registration/admin/CreditRegistrationAttentionSection"
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
  FINISHED_STEPS,
  timelinePhaseLabel,
} from "@/components/credit-registration/admin/timelineSteps"
import WhereRegistrationsStandList from "@/components/credit-registration/admin/WhereRegistrationsStandList"
import {
  useWindowSecsParam,
  WEEK_SECS,
  WindowSecsSelect,
} from "@/components/credit-registration/admin/WindowSecsSelect"
import {
  CREDIT_REGISTRATION_NS,
  DAY_AND_MONTH_FORMAT,
  QUIET_REFRESH,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  emptyStateCss,
  headingCss,
  noteCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
} from "@/components/credit-registration/styles"
import { formatZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type {
  CreditRegistrationHistory,
  CreditRegistrationOverview,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Link, QueryResult, StatTile, StatTileList } from "@/shared-module/components"

const TREND_CHART_HEIGHT = 300
const TILE_COLUMNS = 4
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

/** How the chosen period's finished registrations ended. The period picker sits in this card's
 *  header because these tiles are all it controls. */
const ThroughputSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const { control, windowSecs } = useWindowSecsParam(WEEK_SECS)
  const errorsQuery = useCreditRegistrationErrorsByCode(windowSecs)

  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-verdicts")}
        </h2>
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
            <StatTile
              label={t("credit-registration-admin-tile-registered")}
              value={verdicts.registered_count}
            />
            <StatTile
              label={t("credit-registration-admin-tile-already-in-sisu")}
              value={verdicts.duplicate_and_not_improved_count}
            />
            <StatTile
              label={t("credit-registration-admin-tile-stopped")}
              value={verdicts.failed_permanent_count}
              alertWhenNonZero
            />
            <StatTile
              label={t("credit-registration-admin-tile-cancelled")}
              value={verdicts.cancelled_count}
            />
          </StatTileList>
        )}
      </QueryResult>
    </section>
  )
}

/**
 * Every step with live registrations, under its phase, in the timeline's words. Each count links to
 * the Registrations tab filtered to exactly those rows.
 */
const WhereRegistrationsStandSection: React.FC<{ overview: CreditRegistrationOverview }> = ({
  overview,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const hasRows = overview.where_registrations_stand.some((row) => row.count > 0)

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
      {hasRows ? (
        <WhereRegistrationsStandList
          counts={overview.where_registrations_stand}
          labelledBy={headingId}
        />
      ) : (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-registrations")}</p>
      )}
    </section>
  )
}

/** Legend marks distinct in shape, so no line is told apart by its colour alone. */
const TREND_SYMBOLS = {
  course: "rect",
  student_number: "triangle",
  registering: "circle",
  confirmation: "diamond",
  needs_attention: "emptyCircle",
} as const

const SYMBOL_SIZE = 7
const SOLID = "solid" as const
const DASHED = "dashed" as const

/**
 * One line per phase that had anyone in it, Not started and finished registrations left out. Needs
 * attention cuts across the phases, so it is dashed and comes last in the legend.
 */
const PhaseTrendChart: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const dayFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)
  const { points, days, snapshotOf } = useMemo(() => readHistoryDays(history), [history])

  const { phaseLines, attentionLine } = useMemo(() => {
    const phases = TREND_PHASES.map((phase) => ({
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
    })).filter((one) => one.points.some((point) => point !== null && point > 0))
    const attention = {
      line: NEEDS_ATTENTION_LINE,
      label: t("credit-registration-admin-trend-needs-attention"),
      points: days.map((day) => snapshotOf(day)?.needs_attention_count ?? null),
    }
    return { phaseLines: phases, attentionLine: attention }
  }, [days, snapshotOf, t])

  const gapMarkArea = missingDaysMarkArea(points, t("credit-registration-admin-no-snapshot-day"))
  const lineSeries = (
    one: (typeof phaseLines)[number] | typeof attentionLine,
    lineType: typeof SOLID | typeof DASHED,
  ) => ({
    name: one.label,
    type: "line" as const,
    symbol: TREND_SYMBOLS[one.line],
    symbolSize: SYMBOL_SIZE,
    showSymbol: !hasDrawableSegment(one.points),
    connectNulls: false,
    lineStyle: { width: LINE_WIDTH, type: lineType },
    itemStyle: { color: TREND_COLORS[one.line] },
    data: one.points,
  })
  const options: EChartsOption = {
    tooltip: AXIS_TOOLTIP,
    // Above the plot: at the bottom it lands on the dates, and one of the two has to be read. One
    // legend, as two would overlap once one wraps.
    legend: {
      data: [...phaseLines.map((one) => one.label), attentionLine.label],
      top: 0,
      left: 0,
    },
    // The legend wraps to two rows at phone width, so top has to clear both.
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
    series: [
      ...phaseLines.map((one) => lineSeries(one, SOLID)),
      {
        ...lineSeries(attentionLine, DASHED),
        ...(gapMarkArea !== null ? { markArea: gapMarkArea } : {}),
      },
    ],
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
      <CreditRegistrationAttentionSection />
      <ThroughputSection />
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
