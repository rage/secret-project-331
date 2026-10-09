"use client"

import type { EChartsOption } from "echarts"
import React, { useMemo, useState } from "react"
import { useDateFormatter } from "react-aria"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import type { CreditRegistrationHistory } from "@/generated/api/types.generated"
import { Disclosure, QueryResult } from "@/shared-module/components"

import {
  CREDIT_REGISTRATION_NS,
  DAY_AND_MONTH_FORMAT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
} from "../constants"
import { emptyStateCss, noteCss, sectionCardCss, subsectionCss } from "../styles"
import { adminLedgerStateLabel } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationPipelineHistory } from "./adminCreditRegistrationHooks"
import {
  AXIS_TEXT_COLOR,
  AXIS_TOOLTIP,
  GRID_LINE_COLOR,
  hasDrawableSegment,
  LINE_WIDTH,
  MINOR_TEXT_COLOR,
  MONTH_DAYS,
  niceMax,
  readHistoryDays,
  useMeasuredWidth,
} from "./historyChart"
import HistoryRangeChips from "./HistoryRangeChips"
import { ALL_STATES, BUCKET_COLORS, BUCKET_OF_STATE } from "./queueBuckets"

/** One mini line per state on a shared grid: the same scale is what makes them comparable. */
const SMALL_MULTIPLE_HEIGHT = 84
const SMALL_MULTIPLE_TITLE_HEIGHT = 24
const SMALL_MULTIPLE_AXIS_HEIGHT = 22
const SMALL_MULTIPLE_ROW_GAP = 20
const MEDIUM_PANEL_WIDTH = 900
const WIDE_COLUMNS = 4
const MEDIUM_COLUMNS = 2
/** Horizontal room each panel gives its y-axis line, as a share of the panel; labels are hidden. */
const PANEL_AXIS_SHARE = 3
const PANEL_INSET_SHARE = 4
const MINI_LABEL_SIZE = 10
const MINI_TITLE_SIZE = 12

// ECharts option values, not user-facing copy.
const PLAIN_WEIGHT = "normal"
const CENTRED = "center"

/** Which state is piling up? One small line per state, all on the same scale. */
const StateSmallMultiples: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const dayFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)
  const [panelRef, panelWidth] = useMeasuredWidth()
  const { days, snapshotOf } = useMemo(() => readHistoryDays(history), [history])

  // Every resize tick re-renders this, and at the year range the walk is twelve states over a year
  // of days.
  const charted = useMemo(
    () =>
      ALL_STATES.filter((state) => BUCKET_OF_STATE[state] !== "done")
        .map((state) => ({
          state,
          points: days.map(
            (day) => snapshotOf(day)?.states.find((point) => point.state === state)?.count ?? null,
          ),
        }))
        .filter((one) => one.points.some((point) => point !== null && point > 0)),
    [days, snapshotOf],
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
    tooltip: AXIS_TOOLTIP,
    title: charted.map((one, index) => ({
      text: adminLedgerStateLabel(t, one.state),
      left: cellLeft(index),
      top: cellTop(index),
      textStyle: { fontSize: MINI_TITLE_SIZE, fontWeight: PLAIN_WEIGHT, color: AXIS_TEXT_COLOR },
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
        align: CENTRED,
        formatter: (value: string) => dayFormatter.format(new Date(value)),
      },
    })),
    yAxis: charted.map((_, index) => ({
      type: "value",
      gridIndex: index,
      max: sharedMax,
      minInterval: 1,
      // The note above the grid states the shared scale; twelve repeats would be noise.
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
    })),
    series: charted.map((one, index) => ({
      name: adminLedgerStateLabel(t, one.state),
      type: "line",
      xAxisIndex: index,
      yAxisIndex: index,
      showSymbol: !hasDrawableSegment(one.points),
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

const QueueSizeHistory: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [historyDays, setHistoryDays] = useState(MONTH_DAYS)
  const historyQuery = useCreditRegistrationPipelineHistory(historyDays)

  return (
    <div className={subsectionCss}>
      <HistoryRangeChips days={historyDays} onChange={setHistoryDays} />
      <p className={noteCss}>{t("credit-registration-admin-small-multiples-note")}</p>
      <QueryResult query={historyQuery} refreshIndicator={QUIET_REFRESH}>
        {(history) => <StateSmallMultiples history={history} />}
      </QueryResult>
    </div>
  )
}

/** The daily queue size per ledger state, collapsed: a technical history, not today's work. */
const QueueSizeByStateSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <section className={sectionCardCss}>
      <Disclosure
        title={t("credit-registration-heading-by-state-trend")}
        variant={PLAIN_DISCLOSURE}
      >
        {/* Mounted only when opened, so the history is fetched only for a reader who wants it. */}
        <QueueSizeHistory />
      </Disclosure>
    </section>
  )
}

export default QueueSizeByStateSection
