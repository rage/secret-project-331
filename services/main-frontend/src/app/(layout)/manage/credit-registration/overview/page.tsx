"use client"

import { css } from "@emotion/css"
import type { EChartsOption } from "echarts"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { useDateFormatter } from "react-aria"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import {
  useCreditRegistrationErrorsByCode,
  useCreditRegistrationMisconfiguredCourseCount,
  useCreditRegistrationOverview,
  useCreditRegistrationPipelineHistory,
  useCreditRegistrationReconciliation,
  useCreditRegistrationUnhealthyPhaseCount,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import FacetChip from "@/components/credit-registration/admin/FacetChip"
import { formatSharePercent } from "@/components/credit-registration/admin/percent"
import {
  ALL_STATES,
  BUCKET_COLORS,
  BUCKET_OF_STATE,
  BUCKET_ORDER,
  bucketLabel,
  LIVE_BUCKETS,
  type QueueBucket,
} from "@/components/credit-registration/admin/queueBuckets"
import ReconciliationSection from "@/components/credit-registration/admin/ReconciliationSection"
import {
  useWindowSecsParam,
  WEEK_SECS,
  WindowSecsSelect,
} from "@/components/credit-registration/admin/WindowSecsSelect"
import {
  ALIGN_END,
  DAY_AND_MONTH_FORMAT,
  DENSITY_COMPACT,
  LINK_QUIET,
  QUIET_REFRESH,
  TABLE_STACK,
} from "@/components/credit-registration/constants"
import { registrationLedgerStateLabel } from "@/components/credit-registration/creditRegistrationCopy"
import {
  controlCss,
  controlsCss,
  emptyStateCss,
  headingCss,
  noteCss,
  sectionCss,
  sectionHeaderCss,
  sectionsCss,
  spacedRowCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationHistory,
  CreditRegistrationOverview,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import {
  creditRegistrationCoursesRoute,
  creditRegistrationErrorsRoute,
  creditRegistrationRegistrationsRoute,
  creditRegistrationSystemRoute,
} from "@/shared-module/common/utils/routes"
import {
  Link,
  MeterInline,
  QueryResult,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

const BUCKET_CHART_HEIGHT = 300
const MS_PER_DAY = 86_400_000
const DAY_LENGTH = 10

/** One mini line per state on a shared grid: the same scale is what makes them comparable. */
const SMALL_MULTIPLE_HEIGHT = 84
const SMALL_MULTIPLE_TITLE_HEIGHT = 24
const SMALL_MULTIPLE_AXIS_HEIGHT = 22
const SMALL_MULTIPLE_ROW_GAP = 20
const MEDIUM_PANEL_WIDTH = 900
const WIDE_COLUMNS = 4
const MEDIUM_COLUMNS = 2
/** Registered, already in the registry, failed, cancelled and the rate over them. */
const VERDICT_TILE_COLUMNS = 5
/** Horizontal room each panel gives its y-axis line, as a share of the panel; the axis labels
 * themselves are hidden, the scale being stated in the note above the grid. */
const PANEL_AXIS_SHARE = 3
const PANEL_INSET_SHARE = 4

const STUCK_QUERY = "?reason=stuck_in_state"
const STATE_QUERY = "?state="

const MONTH_DAYS = 30
const QUARTER_DAYS = 90
const YEAR_DAYS = 365

const GRID_LINE_COLOR = "#eeeff0"
const AXIS_TEXT_COLOR = "#535a66"
const MINOR_TEXT_COLOR = "#767b85"
const AREA_OPACITY = 0.35
const LINE_WIDTH = 2
const GAP_OPACITY = 0.7
const MINI_LABEL_SIZE = 10
const MINI_TITLE_SIZE = 12
/** Ends the y-axis on a number a reader can divide by, rather than on the tallest day's depth. */
const NICE_STEPS = [1, 2, 5, 10]

const rangeChipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`

/** What needs a person today: the four numbers the tab badges count, each opening its own rows. */
const AttentionSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const stuckTotal = overview.stuck.reduce((sum, row) => sum + row.count, 0)
  const misconfiguredCount = useCreditRegistrationMisconfiguredCourseCount().data ?? 0
  const unhealthyPhaseCount = useCreditRegistrationUnhealthyPhaseCount().data ?? 0

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-needs-attention")}</h2>
      <StatTileList ariaLabel={t("credit-registration-heading-needs-attention")}>
        <StatTile
          label={t("label-credit-registration-needs-attention")}
          value={overview.needs_admin_attention_count}
          href={creditRegistrationErrorsRoute()}
          alertWhenNonZero
        />
        <StatTile
          label={t("label-credit-registration-stuck")}
          value={stuckTotal}
          href={`${creditRegistrationErrorsRoute()}${STUCK_QUERY}`}
          alertWhenNonZero
        />
        <StatTile
          label={t("credit-registration-admin-modules-misconfigured")}
          value={misconfiguredCount}
          href={creditRegistrationCoursesRoute()}
          alertWhenNonZero
        />
        <StatTile
          label={t("credit-registration-admin-phases-unhealthy")}
          value={unhealthyPhaseCount}
          href={creditRegistrationSystemRoute()}
          alertWhenNonZero
        />
      </StatTileList>
    </section>
  )
}

/** How the window's finished registrations ended, which is the throughput question. */
const ThroughputSection: React.FC = () => {
  const { t } = useTranslation()
  const { control, windowSecs } = useWindowSecsParam(WEEK_SECS)
  const errorsQuery = useCreditRegistrationErrorsByCode(windowSecs)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-verdicts")}</h2>
      <div className={controlsCss}>
        <div className={controlCss}>
          <WindowSecsSelect control={control} includeMonth />
        </div>
      </div>
      <QueryResult query={errorsQuery} refreshIndicator={QUIET_REFRESH}>
        {(errors) => {
          const verdicts = errors.verdicts
          const successCount = verdicts.registered_count + verdicts.duplicate_and_not_improved_count
          return (
            <StatTileList
              ariaLabel={t("credit-registration-heading-verdicts")}
              maxColumns={VERDICT_TILE_COLUMNS}
            >
              <StatTile
                label={t("credit-registration-admin-column-registered")}
                value={verdicts.registered_count}
              />
              <StatTile
                label={t("credit-registration-admin-verdict-duplicate-or-not-improved")}
                value={verdicts.duplicate_and_not_improved_count}
              />
              <StatTile
                label={t("credit-registration-admin-column-failed")}
                value={verdicts.failed_permanent_count}
                alertWhenNonZero
              />
              <StatTile
                label={t("credit-registration-admin-verdict-cancelled")}
                value={verdicts.cancelled_count}
              />
              <StatTile
                label={t("credit-registration-admin-success-rate")}
                value={
                  verdicts.total_count === 0
                    ? t("credit-registration-admin-nothing-finished")
                    : formatSharePercent(successCount, verdicts.total_count)
                }
              />
            </StatTileList>
          )
        }}
      </QueryResult>
    </section>
  )
}

interface StateRow {
  state: CreditRegistrationState
  count: number
}

/** One stage's states, deepest first, with each state's share of everything still live. */
const StageTable: React.FC<{
  bucket: QueueBucket
  rows: StateRow[]
  liveTotal: number
  deepestLiveCount: number
}> = ({ bucket, rows, liveTotal, deepestLiveCount }) => {
  const { t } = useTranslation()
  const isLive = bucket !== "done"
  const subtotal = rows.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className={subsectionCss}>
      <div className={spacedRowCss}>
        <h3 className={subheadingCss}>{bucketLabel(t, bucket)}</h3>
        <p className={noteCss}>{t("credit-registration-admin-stage-count", { count: subtotal })}</p>
      </div>
      <Table
        caption={bucketLabel(t, bucket)}
        density={DENSITY_COMPACT}
        rowKey={(row) => row.state}
        rows={rows}
        responsive={TABLE_STACK}
        columns={[
          {
            header: t("label-state"),
            grow: 1,
            minWidth: "13rem",
            cell: (row) => (
              <Link
                href={`${creditRegistrationRegistrationsRoute()}${STATE_QUERY}${row.state}`}
                appearance={LINK_QUIET}
              >
                <AdminStateBadge state={row.state} />
              </Link>
            ),
          },
          {
            header: t("label-count"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.count,
          },
          // Scaled to the deepest live state rather than to the whole queue: against the total,
          // every state renders as a sliver and no two of them can be told apart.
          ...(isLive && liveTotal > 0
            ? [
                {
                  header: t("credit-registration-admin-column-share-of-live"),
                  grow: 1,
                  minWidth: "10rem",
                  cell: (row: StateRow) => (
                    <MeterInline
                      value={row.count}
                      maxValue={deepestLiveCount}
                      valueText={formatSharePercent(row.count, liveTotal)}
                      label={t("credit-registration-admin-share-of-live-label", {
                        state: registrationLedgerStateLabel(t, row.state),
                        count: row.count,
                        total: liveTotal,
                      })}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}

/**
 * Every state holding a row, grouped by what the rows in it are waiting for. The stage subtotals
 * are the counts an operator quotes; they are not the work queue, which is a row-by-row judgement.
 */
const QueueSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const rows: StateRow[] = overview.counts_by_state.filter((row) => row.count > 0)
  const liveRows = rows.filter((row) => BUCKET_OF_STATE[row.state] !== "done")
  const liveTotal = liveRows.reduce((sum, row) => sum + row.count, 0)
  const deepestLiveCount = Math.max(...liveRows.map((row) => row.count), 1)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-states")}</h2>
      {rows.length === 0 && (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-registrations")}</p>
      )}
      {BUCKET_ORDER.map((bucket) => {
        const inBucket = rows
          .filter((row) => BUCKET_OF_STATE[row.state] === bucket)
          .toSorted((a, b) => b.count - a.count)
        return inBucket.length === 0 ? null : (
          <StageTable
            key={bucket}
            bucket={bucket}
            rows={inBucket}
            liveTotal={liveTotal}
            deepestLiveCount={deepestLiveCount}
          />
        )
      })}
    </section>
  )
}

interface DayPoint {
  day: string
  hasSnapshot: boolean
}

interface ChartDays {
  points: DayPoint[]
  days: string[]
  depthOf: (day: string, state: CreditRegistrationState) => number | null
}

/**
 * Every day in the range up to the last snapshot, so a day the snapshot phase missed stays a gap
 * rather than a zero, and the series ends on a day there is a depth for.
 */
const readHistory = (history: CreditRegistrationHistory): ChartDays => {
  const byDate = new Map(history.days.map((day) => [day.snapshot_date, day]))
  const lastSnapshot = history.days.at(-1)?.snapshot_date
  const end = Math.min(
    new Date(history.to).getTime(),
    lastSnapshot === undefined ? -Infinity : new Date(lastSnapshot).getTime(),
  )
  const points: DayPoint[] = []
  for (let day = new Date(history.from).getTime(); day <= end; day += MS_PER_DAY) {
    // `toISOString` is safe here: the endpoint's dates are plain UTC days with no offset to lose.
    const isoDay = new Date(day).toISOString().slice(0, DAY_LENGTH)
    points.push({ day: isoDay, hasSnapshot: byDate.has(isoDay) })
  }
  return {
    points,
    days: points.map((point) => point.day),
    depthOf: (day, state) =>
      byDate.get(day)?.states.find((point) => point.state === state)?.count ?? null,
  }
}

/** Contiguous runs of days with no snapshot, as `[from, to]` pairs for a `markArea`. */
const missingRanges = (points: DayPoint[]): [string, string][] => {
  const ranges: [string, string][] = []
  let open: [string, string] | null = null
  for (const point of points) {
    if (point.hasSnapshot) {
      open = null
    } else if (open === null) {
      open = [point.day, point.day]
      ranges.push(open)
    } else {
      open[1] = point.day
    }
  }
  return ranges
}

/** The next 1, 2 or 5 above `value`, so the axis ends on a number worth reading. */
const niceMax = (value: number): number => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)))
  const step = NICE_STEPS.find((candidate) => value <= candidate * magnitude) ?? 10
  return step * magnitude
}

/** The container's width once it is on screen; 0 before the first measurement. */
const useMeasuredWidth = (): [React.RefObject<HTMLDivElement | null>, number] => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (element === null || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** Does the pipeline drain? The three live buckets stacked, so the top edge is the whole backlog. */
const BucketAreaChart: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const dayFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)
  const { points, days, depthOf } = useMemo(() => readHistory(history), [history])
  const gaps = useMemo(() => missingRanges(points), [points])

  // A refetch re-renders this with the same history, and at the year range the walk below is three
  // buckets over a year of days.
  const series = useMemo(
    () =>
      LIVE_BUCKETS.map((bucket) => {
        const states = ALL_STATES.filter((state) => BUCKET_OF_STATE[state] === bucket)
        return {
          bucket,
          points: days.map((day) => {
            const depths = states.map((state) => depthOf(day, state))
            return depths.every((depth) => depth === null)
              ? null
              : depths.reduce((sum: number, depth) => sum + (depth ?? 0), 0)
          }),
        }
      }),
    [days, depthOf],
  )

  if (series.every((one) => one.points.every((point) => point === null))) {
    return <p className={emptyStateCss}>{t("credit-registration-admin-no-snapshots")}</p>
  }

  const gapMarkArea = {
    silent: true,
    itemStyle: { color: GRID_LINE_COLOR, opacity: GAP_OPACITY },
    label: { show: false },
    data: gaps.map(([from, to]): [{ xAxis: string; name: string }, { xAxis: string }] => [
      { xAxis: from, name: t("credit-registration-admin-no-snapshot-day") },
      { xAxis: to },
    ]),
  }

  const options: EChartsOption = {
    // oxlint-disable-next-line i18next/no-literal-string
    tooltip: { trigger: "axis" },
    // Above the plot: at the bottom it lands on the dates, and one of the two has to be read.
    legend: { data: series.map((one) => bucketLabel(t, one.bucket)), top: 0 },
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
      name: bucketLabel(t, one.bucket),
      type: "line",
      // oxlint-disable-next-line i18next/no-literal-string
      stack: "live",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: LINE_WIDTH },
      areaStyle: { opacity: AREA_OPACITY },
      itemStyle: { color: BUCKET_COLORS[one.bucket] },
      data: one.points,
      ...(index === 0 && gaps.length > 0 ? { markArea: gapMarkArea } : {}),
    })),
  }
  return <Echarts options={options} height={BUCKET_CHART_HEIGHT} />
}

/** Which state is piling up? One small line per state, all on the same scale. */
const StateSmallMultiples: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const dayFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)
  const [panelRef, panelWidth] = useMeasuredWidth()
  const { days, depthOf } = useMemo(() => readHistory(history), [history])

  // Every resize tick re-renders this, and at the year range the walk is twelve states over a year
  // of days.
  const charted = useMemo(
    () =>
      ALL_STATES.filter((state) => BUCKET_OF_STATE[state] !== "done")
        .map((state) => ({ state, points: days.map((day) => depthOf(day, state)) }))
        .filter((one) => one.points.some((point) => point !== null && point > 0)),
    [days, depthOf],
  )

  if (charted.length === 0) {
    return <p className={emptyStateCss}>{t("credit-registration-admin-no-snapshots")}</p>
  }

  // Four panels across is unreadable on a phone, so the panel count follows the room there is.
  // Two columns is the floor: twelve single-column panels run to 1800px of near-empty charts, and
  // 9rem is comfortable even at phone width.
  const columns = panelWidth > 0 && panelWidth < MEDIUM_PANEL_WIDTH ? MEDIUM_COLUMNS : WIDE_COLUMNS

  const sharedMax = niceMax(
    Math.max(...charted.flatMap((one) => one.points.map((point) => point ?? 0)), 1),
  )
  const rowPitch =
    SMALL_MULTIPLE_TITLE_HEIGHT +
    SMALL_MULTIPLE_HEIGHT +
    SMALL_MULTIPLE_AXIS_HEIGHT +
    SMALL_MULTIPLE_ROW_GAP
  const rowCount = Math.ceil(charted.length / columns)
  const cellLeft = (index: number) => `${((index % columns) * 100) / columns + PANEL_INSET_SHARE}%`
  const cellTop = (index: number) => Math.floor(index / columns) * rowPitch
  const firstAndLast = (index: number) => index === 0 || index === days.length - 1

  const options: EChartsOption = {
    // oxlint-disable-next-line i18next/no-literal-string
    tooltip: { trigger: "axis" },
    title: charted.map((one, index) => ({
      text: registrationLedgerStateLabel(t, one.state),
      left: cellLeft(index),
      top: cellTop(index),
      // oxlint-disable-next-line i18next/no-literal-string
      textStyle: { fontSize: MINI_TITLE_SIZE, fontWeight: "normal", color: AXIS_TEXT_COLOR },
    })),
    grid: charted.map((_, index) => ({
      left: cellLeft(index),
      top: cellTop(index) + SMALL_MULTIPLE_TITLE_HEIGHT,
      width: `${100 / columns - PANEL_AXIS_SHARE}%`,
      height: SMALL_MULTIPLE_HEIGHT,
    })),
    xAxis: charted.map((_, index) => ({
      type: "category",
      data: days,
      gridIndex: index,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
      // Only the ends: the panels share a range, and a date under every panel is the same date
      // written twelve times.
      axisLabel: {
        interval: firstAndLast,
        fontSize: MINI_LABEL_SIZE,
        color: MINOR_TEXT_COLOR,
        // oxlint-disable-next-line i18next/no-literal-string
        align: "center",
        formatter: (value: string) => dayFormatter.format(new Date(value)),
      },
    })),
    yAxis: charted.map((_, index) => ({
      type: "value",
      gridIndex: index,
      max: sharedMax,
      minInterval: 1,
      // The note above the grid already says every panel shares this scale, so twelve repeats of
      // the same numbers would only be noise.
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
    })),
    series: charted.map((one, index) => ({
      name: registrationLedgerStateLabel(t, one.state),
      type: "line",
      xAxisIndex: index,
      yAxisIndex: index,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: LINE_WIDTH },
      itemStyle: { color: BUCKET_COLORS[BUCKET_OF_STATE[one.state]] },
      data: one.points,
    })),
  }
  return (
    <div ref={panelRef}>
      <Echarts options={options} height={rowCount * rowPitch} />
    </div>
  )
}

const HISTORY_RANGES = [
  { days: MONTH_DAYS, labelKey: "credit-registration-admin-window-chip-month" },
  { days: QUARTER_DAYS, labelKey: "credit-registration-admin-window-chip-quarter" },
  { days: YEAR_DAYS, labelKey: "credit-registration-admin-window-chip-year" },
] as const

const RangeChips: React.FC<{ days: number; onChange: (days: number) => void }> = ({
  days,
  onChange,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={rangeChipsCss}
      role="group"
      aria-label={t("credit-registration-admin-history-length")}
    >
      {HISTORY_RANGES.map((range) => (
        <FacetChip
          key={range.days}
          label={t(range.labelKey)}
          isSelected={range.days === days}
          onToggle={() => onChange(range.days)}
        />
      ))}
    </div>
  )
}

const TrendSection: React.FC = () => {
  const { t } = useTranslation()
  const [historyDays, setHistoryDays] = useState(MONTH_DAYS)
  const historyQuery = useCreditRegistrationPipelineHistory(historyDays)

  return (
    <section className={sectionCss}>
      <div className={spacedRowCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-queue-depth")}</h2>
        <RangeChips days={historyDays} onChange={setHistoryDays} />
      </div>
      <QueryResult query={historyQuery} refreshIndicator={QUIET_REFRESH}>
        {(history) => (
          <>
            {history.days.at(-1) && (
              <p className={noteCss}>
                {t("credit-registration-admin-snapshot-note", {
                  day: history.days.at(-1)?.snapshot_date,
                })}
              </p>
            )}
            <BucketAreaChart history={history} />
            <div className={subsectionCss}>
              <div className={sectionHeaderCss}>
                <h3 className={subheadingCss}>{t("credit-registration-heading-by-state-trend")}</h3>
                <p className={noteCss}>{t("credit-registration-admin-small-multiples-note")}</p>
              </div>
              <StateSmallMultiples history={history} />
            </div>
          </>
        )}
      </QueryResult>
    </section>
  )
}

/** Whether anything is wrong, how the finished ones ended, where the queue stands, and its trend. */
const OverviewPage: React.FC = () => {
  const overviewQuery = useCreditRegistrationOverview()
  const reconciliationQuery = useCreditRegistrationReconciliation()

  return (
    <>
      <QueryResult query={overviewQuery} refreshIndicator={QUIET_REFRESH}>
        {(overview) => (
          <div className={sectionsCss}>
            <AttentionSection overview={overview} />
            <ThroughputSection />
            <QueueSection overview={overview} />
          </div>
        )}
      </QueryResult>
      <TrendSection />
      <QueryResult query={reconciliationQuery} refreshIndicator={QUIET_REFRESH}>
        {(reconciliation) => <ReconciliationSection reconciliation={reconciliation} />}
      </QueryResult>
    </>
  )
}

export default OverviewPage
