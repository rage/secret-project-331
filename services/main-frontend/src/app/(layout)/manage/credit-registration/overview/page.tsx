"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import type { EChartsOption } from "echarts"
import React from "react"
import type { Control } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import { stateName } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useCreditRegistrationOverview,
  useCreditRegistrationPipelineHistory,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import {
  ALL_STATES,
  BUCKET_COLORS,
  BUCKET_OF_STATE,
  BUCKET_ORDER,
  bucketLabel,
  LIVE_BUCKETS,
  type QueueBucket,
} from "@/components/credit-registration/admin/queueBuckets"
import {
  ABSENT,
  ALIGN_END,
  DENSITY_COMPACT,
  LINK_QUIET,
  QUIET_REFRESH,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  emptyStateCss,
  headingCss,
  noteCss,
  proseCss,
  sectionCss,
  sectionHeaderCss,
  spacedRowCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationHistory,
  CreditRegistrationHistoryDay,
  CreditRegistrationOverview,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import {
  creditRegistrationErrorsRoute,
  creditRegistrationRegistrationsRoute,
} from "@/shared-module/common/utils/routes"
import {
  Link,
  Meter,
  QueryResult,
  Select,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

const BUCKET_CHART_HEIGHT = 260
const RECENT_DAYS = 7
const MS_PER_DAY = 86_400_000
const DAY_LENGTH = 10

/** One mini line per state, four to a row: the shared grid is what makes them comparable. */
const SMALL_MULTIPLE_COLUMNS = 4
const SMALL_MULTIPLE_HEIGHT = 84
const SMALL_MULTIPLE_TITLE_HEIGHT = 24
const SMALL_MULTIPLE_ROW_GAP = 20

// oxlint-disable-next-line i18next/no-literal-string
const STUCK_QUERY = "?reason=stuck_in_state"
// oxlint-disable-next-line i18next/no-literal-string
const STATE_QUERY = "?state="
// oxlint-disable-next-line i18next/no-literal-string
const MONTH_DAYS = "30"
// oxlint-disable-next-line i18next/no-literal-string
const QUARTER_DAYS = "90"
// oxlint-disable-next-line i18next/no-literal-string
const YEAR_DAYS = "365"

const GRID_LINE_COLOR = "#eeeff0"
const AXIS_TEXT_COLOR = "#535a66"
const MINOR_TEXT_COLOR = "#767b85"
const AREA_OPACITY = 0.35
const LINE_WIDTH = 2
const GAP_OPACITY = 0.7
const MINI_LABEL_SIZE = 10
const MINI_TITLE_SIZE = 12

const smallMultiplesCss = css`
  /* Four mini charts across is unreadable on a phone, and the bucket area above answers the same
     question at that width. */
  @media (max-width: 48rem) {
    display: none;
  }
`

const signed = (delta: number): string => (delta > 0 ? `+${delta}` : String(delta))

const AttentionSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const stuckTotal = overview.stuck.reduce((sum, row) => sum + row.count, 0)
  const recent = overview.throughput.slice(-RECENT_DAYS)
  const registered = recent.reduce(
    (sum, bucket) => sum + bucket.registered_count + bucket.other_success_count,
    0,
  )
  const failed = recent.reduce((sum, bucket) => sum + bucket.failed_count, 0)

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
          label={t("credit-registration-admin-registered-in-days", { days: RECENT_DAYS })}
          value={registered}
        />
        <StatTile
          label={t("credit-registration-admin-failed-in-days", { days: RECENT_DAYS })}
          value={failed}
          alertWhenNonZero
        />
      </StatTileList>
    </section>
  )
}

interface StateRow {
  state: CreditRegistrationState
  bucket: QueueBucket
  count: number
  /** Rows that entered minus rows that left on the last snapshot day; null with no snapshot. */
  net: number | null
}

/**
 * Every state holding a row, its share of the live queue, and which way it moved on the last
 * snapshot day. One table: the flow numbers are a column here rather than a second table below.
 */
const QueueSection: React.FC<{
  overview: CreditRegistrationOverview
  latestDay: CreditRegistrationHistoryDay | undefined
}> = ({ overview, latestDay }) => {
  const { t } = useTranslation()
  const rows: StateRow[] = overview.counts_by_state
    .filter((row) => row.count > 0)
    .map((row) => {
      const point = latestDay?.states.find((candidate) => candidate.state === row.state)
      return {
        state: row.state,
        bucket: BUCKET_OF_STATE[row.state],
        count: row.count,
        net: point ? point.entered_count - point.left_count : null,
      }
    })
    .toSorted(
      (a, b) =>
        BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) || b.count - a.count,
    )

  const liveTotal = rows
    .filter((row) => row.bucket !== "done")
    .reduce((sum, row) => sum + row.count, 0)

  return (
    <section className={sectionCss}>
      <div className={sectionHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-states")}</h2>
        {latestDay && (
          <p className={noteCss}>
            {t("credit-registration-admin-flow-as-of", { day: latestDay.snapshot_date })}
          </p>
        )}
      </div>
      <Table
        caption={t("credit-registration-heading-states")}
        density={DENSITY_COMPACT}
        rowKey={(row) => row.state}
        rows={rows}
        emptyState={t("credit-registration-admin-no-registrations")}
        columns={[
          {
            header: t("label-state"),
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
            header: t("credit-registration-admin-column-stage"),
            minWidth: "10rem",
            cell: (row) => bucketLabel(t, row.bucket),
          },
          {
            header: t("label-count"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.count,
          },
          {
            header: t("credit-registration-admin-column-share-of-live"),
            grow: true,
            minWidth: "9rem",
            cell: (row) =>
              row.bucket === "done" || liveTotal === 0 ? (
                ABSENT
              ) : (
                <Meter
                  value={row.count}
                  maxValue={liveTotal}
                  showLabel={false}
                  label={t("credit-registration-admin-share-of-live-label", {
                    state: stateName(row.state),
                    count: row.count,
                    total: liveTotal,
                  })}
                />
              ),
          },
          {
            header: t("credit-registration-admin-column-net"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => (row.net === null ? ABSENT : signed(row.net)),
          },
        ]}
      />
      <p className={proseCss}>
        <span className={noteCss}>{t("credit-registration-admin-queue-vs-states-note")}</span>
      </p>
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

/** Every day in the range, so a day the snapshot phase missed stays a gap rather than a zero. */
const readHistory = (history: CreditRegistrationHistory): ChartDays => {
  const byDate = new Map(history.days.map((day) => [day.snapshot_date, day]))
  const points: DayPoint[] = []
  for (
    let day = new Date(history.from).getTime();
    day <= new Date(history.to).getTime();
    day += MS_PER_DAY
  ) {
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

/** Does the pipeline drain? The three live buckets stacked, so the top edge is the whole backlog. */
const BucketAreaChart: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const { points, days, depthOf } = readHistory(history)
  const gaps = missingRanges(points)

  const series = LIVE_BUCKETS.map((bucket) => {
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
  })

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
    legend: { data: series.map((one) => bucketLabel(t, one.bucket)) },
    // oxlint-disable-next-line i18next/no-literal-string
    grid: { left: 52, right: 128, top: 56, bottom: 32 },
    // oxlint-disable-next-line i18next/no-literal-string
    xAxis: { type: "category", data: days, boundaryGap: false },
    yAxis: {
      // oxlint-disable-next-line i18next/no-literal-string
      type: "value",
      name: t("credit-registration-admin-queue-depth-axis"),
      minInterval: 1,
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
    },
    series: series.map((one, index) => ({
      name: bucketLabel(t, one.bucket),
      // oxlint-disable-next-line i18next/no-literal-string
      type: "line",
      // oxlint-disable-next-line i18next/no-literal-string
      stack: "live",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: LINE_WIDTH },
      areaStyle: { opacity: AREA_OPACITY },
      itemStyle: { color: BUCKET_COLORS[one.bucket] },
      // The legend names the bands; this names them again where the eye stops reading.
      endLabel: { show: true, formatter: bucketLabel(t, one.bucket), color: AXIS_TEXT_COLOR },
      data: one.points,
      ...(index === 0 && gaps.length > 0 ? { markArea: gapMarkArea } : {}),
    })),
  }
  return <Echarts options={options} height={BUCKET_CHART_HEIGHT} />
}

/** Which state is piling up? One small line per state, all on the same scale. */
const StateSmallMultiples: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { days, depthOf } = readHistory(history)

  const charted = ALL_STATES.filter((state) => BUCKET_OF_STATE[state] !== "done")
    .map((state) => ({ state, points: days.map((day) => depthOf(day, state)) }))
    .filter((one) => one.points.some((point) => point !== null && point > 0))

  if (charted.length === 0) {
    return null
  }

  // Shared, so a deep queue looks deep beside a shallow one instead of every panel filling itself.
  const sharedMax = Math.max(...charted.flatMap((one) => one.points.map((point) => point ?? 0)), 1)
  const rowPitch = SMALL_MULTIPLE_TITLE_HEIGHT + SMALL_MULTIPLE_HEIGHT + SMALL_MULTIPLE_ROW_GAP
  const rowCount = Math.ceil(charted.length / SMALL_MULTIPLE_COLUMNS)
  const cellLeft = (index: number) =>
    `${((index % SMALL_MULTIPLE_COLUMNS) * 100) / SMALL_MULTIPLE_COLUMNS + 4}%`
  const cellTop = (index: number) => Math.floor(index / SMALL_MULTIPLE_COLUMNS) * rowPitch

  const options: EChartsOption = {
    // oxlint-disable-next-line i18next/no-literal-string
    tooltip: { trigger: "axis" },
    title: charted.map((one, index) => ({
      text: stateName(one.state),
      left: cellLeft(index),
      top: cellTop(index),
      // oxlint-disable-next-line i18next/no-literal-string
      textStyle: { fontSize: MINI_TITLE_SIZE, fontWeight: "normal", color: AXIS_TEXT_COLOR },
    })),
    grid: charted.map((_, index) => ({
      left: cellLeft(index),
      top: cellTop(index) + SMALL_MULTIPLE_TITLE_HEIGHT,
      width: `${100 / SMALL_MULTIPLE_COLUMNS - 9}%`,
      height: SMALL_MULTIPLE_HEIGHT,
    })),
    xAxis: charted.map((_, index) => ({
      // oxlint-disable-next-line i18next/no-literal-string
      type: "category",
      data: days,
      gridIndex: index,
      boundaryGap: false,
      show: false,
    })),
    yAxis: charted.map((_, index) => ({
      // oxlint-disable-next-line i18next/no-literal-string
      type: "value",
      gridIndex: index,
      max: sharedMax,
      minInterval: 1,
      axisLabel: { fontSize: MINI_LABEL_SIZE, color: MINOR_TEXT_COLOR },
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
    })),
    series: charted.map((one, index) => ({
      name: stateName(one.state),
      // oxlint-disable-next-line i18next/no-literal-string
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
    <div className={smallMultiplesCss}>
      <Echarts options={options} height={rowCount * rowPitch} />
    </div>
  )
}

interface DaysFields {
  days: string
}

const TrendSection: React.FC<{
  control: Control<DaysFields>
  historyQuery: UseQueryResult<CreditRegistrationHistory>
}> = ({ control, historyQuery }) => {
  const { t } = useTranslation()

  return (
    <section className={sectionCss}>
      <div className={spacedRowCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-queue-depth")}</h2>
        <div className={controlCss}>
          <Select
            name="days"
            control={control}
            label={t("credit-registration-admin-history-length")}
            options={[
              { value: MONTH_DAYS, label: t("credit-registration-admin-window-month") },
              { value: QUARTER_DAYS, label: t("credit-registration-admin-window-quarter") },
              { value: YEAR_DAYS, label: t("credit-registration-admin-window-year") },
            ]}
          />
        </div>
      </div>
      <QueryResult query={historyQuery} refreshIndicator={QUIET_REFRESH}>
        {(history) => (
          <>
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

/** Whether anything is wrong, where the queue stands, and which way it has been moving. */
const OverviewPage: React.FC = () => {
  const overviewQuery = useCreditRegistrationOverview()
  const { control, watch } = useForm<DaysFields>({ defaultValues: { days: MONTH_DAYS } })
  const historyQuery = useCreditRegistrationPipelineHistory(Number(watch("days")))

  return (
    <>
      <QueryResult query={overviewQuery} refreshIndicator={QUIET_REFRESH}>
        {(overview) => (
          <>
            <AttentionSection overview={overview} />
            <QueueSection overview={overview} latestDay={historyQuery.data?.days.at(-1)} />
          </>
        )}
      </QueryResult>
      <TrendSection control={control} historyQuery={historyQuery} />
    </>
  )
}

export default OverviewPage
