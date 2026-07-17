"use client"

import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  EChartsOption,
} from "echarts"
import React, { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import Echarts from "@/app/manage/courses/[id]/stats/Echarts"
import {
  moduleTimingCaptionCss,
  ModuleTimingCells,
  moduleTimingLegendCss,
  moduleTimingTableCss,
} from "@/components/ModuleTimingTable"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { dateToString } from "@/shared-module/common/utils/time"
import { Disclosure } from "@/shared-module/components"
import { computeModuleRows, durationSeconds, formatDuration } from "@/utils/moduleTimeline"
import {
  colorAt,
  ECHARTS,
  escapeHtml,
  LINE_BREAK,
  SERIES_COLORS,
  SPLIT_AREA_COLORS,
  TIME_AXIS_LABEL,
  timeAxisBounds,
  TRACK_FILL,
} from "@/utils/timelineChart"

import { clipRect } from "../lib/clipRect"
import { completedModuleCount } from "../lib/completions"
import { computeLaneBoxes, packLanes } from "../lib/lanePacking"
import { buildCourseDensity, courseSpan, maxStackedPerExercise } from "../lib/violinDensity"

export interface ActivityTimelineProps {
  enrollments: CourseEnrollmentInfo[]
}

const DOT_FILL = "#ffffff"
const DOT_BORDER = baseTheme.colors.gray[700]
const MARK_BORDER = "#ffffff"
// A completion awaiting cheating review is drawn as a red dot (white ring) instead of the default white.
const REVIEW_DOT_FILL = "#c4281b" // off-palette review red; no baseTheme token matches
const REVIEW_DOT_BORDER = "#ffffff"
// Vertical pixels per lane row; the chart height scales with the lane count.
const LANE_ROW_PX = 90
// Lane packing runs on rendered pixel footprints (marker overhang + measured label width), not raw data
// spans, so two courses sharing a lane can never collide on screen. Constants: minimum horizontal gap
// between two items in a lane; cap on a reserved label width; marker overhang reserved past the span end
// (cluster dot radius + border); padding added to each measured label width.
const LANE_GAP_PX = 16
const MAX_LABEL_PX = 220
const MARKER_PAD_PX = 12
const LABEL_PAD_PX = 6
// Fixed echarts grid paddings (px); the y-axis labels are hidden so containLabel adds nothing material,
// making the plot area width = container width − GRID_LEFT − GRID_RIGHT.
const GRID_LEFT = 12
const GRID_RIGHT = 24
// Container width (px) assumed before the ResizeObserver reports the real one on mount.
const DEFAULT_WIDTH_PX = 1000
// Font used for offscreen canvas label measurement; must match the 12px label drawn in renderItem.
const LABEL_FONT = "12px sans-serif"
const CANVAS_TAG = "canvas"
// oxlint-disable-next-line i18next/no-literal-string -- Canvas 2D context id, not user-facing text.
const CANVAS_CONTEXT_2D = "2d"
// Fallback per-character width (px) when no canvas 2D context is available (e.g. SSR / jsdom).
const FALLBACK_CHAR_PX = 7
// Layout within a lane band: the violin rises from a baseline this far down the band (0 = top, 1 =
// bottom), capped at VIOLIN_MAX_FRACTION of the band so it never touches the top; the course name is
// written below the baseline. TRACK_PX is the thickness of the faint span line at the baseline.
const BASELINE_FROM_TOP = 0.58
const VIOLIN_MAX_FRACTION = 0.5
const TRACK_PX = 5
const LABEL_GAP = 3
const LABEL_FILL = baseTheme.colors.gray[500] // course name under the baseline
// Completion dots / per-day hit-targets sit at the lane centre; nudge them down onto the baseline.
const BASELINE_OFFSET_PX = (BASELINE_FROM_TOP - 0.5) * LANE_ROW_PX
const DIAMOND_FRACTION = 0.55
// Cap the no-activity diamond's half-diagonal (px) so tall lanes don't blow it up into a huge square.
const MAX_DIAMOND_HALF = 9
const VIOLIN_SMOOTH = 0.3
const DAY_TOOLTIP_SIZE = 12
const DOT_SIZE = 9
const CLUSTER_DOT_SIZE = 16
// Count-badge label style (SCREAMING_CASE so the i18next literal-string lint ignores the enum values).
const BADGE_LABEL_POSITION = "inside" as const
const BADGE_LABEL_WEIGHT = "bold" as const
// Completions closer than this fraction of the timeline span (min 1 h) collapse into one counted
// marker, since dots that overlap in pixels can only surface one tooltip on their own.
const COMPLETION_CLUSTER_FRACTION = 0.012
const MIN_CLUSTER_MS = 60 * 60 * 1000
// Separator between the stacked completions listed in a merged tooltip.
const TOOLTIP_DIVIDER = '<div style="border-top:1px solid rgba(0,0,0,0.15);margin:5px 0"></div>'

// Lazily created, module-level offscreen 2D context reused for label width measurement. `undefined` = not
// yet attempted; `null` = unavailable (SSR / jsdom), in which case callers fall back to a per-char estimate.
let labelMeasureCtx: CanvasRenderingContext2D | null | undefined
const measureLabelPx = (text: string): number => {
  if (labelMeasureCtx === undefined) {
    labelMeasureCtx =
      typeof document === "undefined"
        ? null
        : document.createElement(CANVAS_TAG).getContext(CANVAS_CONTEXT_2D)
    if (labelMeasureCtx) {
      labelMeasureCtx.font = LABEL_FONT
    }
  }
  return labelMeasureCtx ? labelMeasureCtx.measureText(text).width : text.length * FALLBACK_CHAR_PX
}

interface CourseBar {
  courseId: string
  name: string
  colorIndex: number
  enrolledMs: number
  lastActivityMs: number
  hasActivity: boolean
  completedCount: number
  totalModules: number
  reviewCount: number
}

/**
 * Cross-course engagement as a lane-packed timeline. Each course spans enrollment → last activity; lanes
 * are packed on rendered pixel footprints (marker overhang + measured label width) at the measured
 * container width, so two courses sharing a lane never collide on screen at any zoom level. Above a
 * faint span track, submissions rise from the baseline as a one-sided, module-stacked density on a shared
 * per-exercise scale, so lane heights are comparable; the course name sits just below the baseline. A
 * course with no activity shows a single diamond at enrollment. Module completions overlay as dots (red
 * when awaiting review), merging into one count-badged dot when they overlap. Same data in the table below.
 */
const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ enrollments }) => {
  const { t } = useTranslation()

  // Container width drives the pixel-aware lane packing below; the ResizeObserver fires on attach and on
  // every resize, re-packing purely in render (integer width avoids sub-pixel churn).
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH_PX)
  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) {
      return
    }
    // Measure synchronously before the browser paints, so the very first packing uses the real
    // container width instead of DEFAULT_WIDTH_PX (which would mis-flip / overlap labels on narrow
    // viewports until the observer fired).
    setWidth(Math.round(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const observed = entries[0]?.contentRect.width
      if (observed) {
        setWidth(Math.round(observed))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const moduleName = (enrollment: CourseEnrollmentInfo, courseModuleId: string): string =>
    enrollment.course_modules.find((m) => m.id === courseModuleId)?.name ?? t("default-module")

  const bars: CourseBar[] = useMemo(
    () =>
      enrollments.map((enrollment, index) => {
        const { enrolledMs, lastActivityMs, hasActivity } = courseSpan(enrollment)
        return {
          courseId: enrollment.course_id,
          name: enrollment.course.name,
          colorIndex: index,
          enrolledMs,
          lastActivityMs,
          hasActivity,
          completedCount: completedModuleCount(enrollment),
          totalModules: enrollment.course_modules.length,
          reviewCount: enrollment.course_module_completions_needing_review,
        }
      }),
    [enrollments],
  )

  // Total time the chart spans; drives the completion-cluster threshold.
  const spanMs =
    Math.max(...bars.map((b) => b.lastActivityMs)) - Math.min(...bars.map((b) => b.enrolledMs))

  // Shared time-axis bounds, used both for the x-axis and for the packing scale below.
  const { min, max } = useMemo(
    () => timeAxisBounds([...bars.map((b) => b.enrolledMs), ...bars.map((b) => b.lastActivityMs)]),
    [bars],
  )

  // Pack on rendered pixel footprints (marker overhang + measured label), not data spans, so labels
  // never collide. Memoized on the enrollment-derived bars, the axis bounds, and the measured width:
  // a resize re-packs (canvas measureText + lane packing), but an unrelated re-render reuses the
  // previous result. The packed boxes also carry per-course label placement consumed in renderItem.
  const { packed, laneCount, laneByCourseId, boxByCourseId } = useMemo(() => {
    // Linear full-range time→pixel scale over the plot area. Packing at the full range is the worst
    // case: zooming in only grows px/ms, so a full-range-valid packing stays overlap-free at every
    // zoom level. A degenerate single-instant range collapses every point onto the left edge.
    const plotLeft = GRID_LEFT
    const plotRight = width - GRID_RIGHT
    const plotWidth = plotRight - plotLeft
    const msToPx = (ms: number): number =>
      max === min ? plotLeft : plotLeft + ((ms - min) / (max - min)) * plotWidth
    const laneBoxes = computeLaneBoxes(
      bars.map((bar) => ({
        key: bar.courseId,
        startMs: bar.enrolledMs,
        endMs: bar.lastActivityMs,
        label: bar.name,
        item: bar,
      })),
      {
        msToPx,
        plotRightPx: plotRight,
        measureLabelPx,
        maxLabelPx: MAX_LABEL_PX,
        markerPadPx: MARKER_PAD_PX,
        labelPadPx: LABEL_PAD_PX,
      },
    )
    const packResult = packLanes(laneBoxes, LANE_GAP_PX)
    return {
      packed: packResult.packed,
      laneCount: packResult.laneCount,
      laneByCourseId: new Map(packResult.packed.map((p) => [p.item.courseId, p.lane])),
      // Label placement per course (packLanes preserves the box fields at runtime, but its return
      // type widens to the base period, so look the boxes back up here for the typed extra fields).
      boxByCourseId: new Map(laneBoxes.map((b) => [b.key, b])),
    }
  }, [bars, min, max, width])

  // Per-course submission-density geometry + the shared vertical scale (submissions per exercise) that
  // makes lane heights comparable. `null` = no submissions → the course keeps its faint track / diamond.
  const { densityByCourse, globalMaxDensity } = useMemo(() => {
    const byCourse = new Map(enrollments.map((e) => [e.course_id, buildCourseDensity(e)]))
    return {
      densityByCourse: byCourse,
      globalMaxDensity: maxStackedPerExercise([...byCourse.values()]),
    }
  }, [enrollments])

  // Per-module rows per course (for the table) and a flat module→row lookup (for completion tooltips).
  const { moduleRowsByCourse, rowByModuleId } = useMemo(() => {
    const rowsByCourse = enrollments.map((e) => ({
      courseId: e.course_id,
      name: e.course.name,
      rows: computeModuleRows(e),
    }))
    return {
      moduleRowsByCourse: rowsByCourse,
      rowByModuleId: new Map(
        rowsByCourse.flatMap((c) => c.rows.map((r) => [r.moduleId, r] as const)),
      ),
    }
  }, [enrollments])

  const barTip = (bar: CourseBar): string => {
    const lines = [
      escapeHtml(bar.name),
      t("tooltip-enrolled", { date: dateToString(new Date(bar.enrolledMs)) }),
    ]
    if (bar.hasActivity) {
      lines.push(t("tooltip-last-activity", { date: dateToString(new Date(bar.lastActivityMs)) }))
    }
    lines.push(
      t("modules-completed-of-total", { completed: bar.completedCount, total: bar.totalModules }),
    )
    if (bar.hasActivity) {
      lines.push(
        t("tooltip-total-time", {
          duration: formatDuration(
            durationSeconds(new Date(bar.enrolledMs), new Date(bar.lastActivityMs)),
            t,
          ),
        }),
      )
    }
    if (bar.reviewCount > 0) {
      lines.push(t("awaiting-review-count", { count: bar.reviewCount }))
    }
    return lines.join(LINE_BREAK)
  }

  // `p.start`/`p.end` are pixel boxes now, so the x values come straight from the course data ms.
  const barData = packed.map((p) => ({
    value: [p.lane, p.item.enrolledMs, p.item.lastActivityMs],
    _tip: barTip(p.item),
  }))

  // One completion tooltip per completion, grouped by course so nearby ones can be merged below. Keyed
  // by course (not lane): back-to-back courses can share a lane, and completions from different courses
  // must never merge into one marker just because they landed on the same lane.
  interface CompletionPoint {
    ms: number
    tip: string
    needsReview: boolean
  }
  const completionsByCourse = new Map<string, { lane: number; points: CompletionPoint[] }>()
  for (const enrollment of enrollments) {
    const lane = laneByCourseId.get(enrollment.course_id) ?? 0
    for (const c of enrollment.course_module_completions) {
      const when = new Date(c.completion_date)
      const row = rowByModuleId.get(c.course_module_id)
      const tip = [
        escapeHtml(moduleName(enrollment, c.course_module_id)),
        t("tooltip-completed", { date: dateToString(when) }),
      ]
      if (row && row.moduleSeconds !== null) {
        tip.push(t("tooltip-time-in-module", { duration: formatDuration(row.moduleSeconds, t) }))
      }
      if (row && row.sinceEnrollSeconds !== null) {
        tip.push(
          t("tooltip-since-enrolled", { duration: formatDuration(row.sinceEnrollSeconds, t) }),
        )
      }
      if (c.needs_to_be_reviewed) {
        tip.push(t("awaiting-review"))
      }
      const entry = completionsByCourse.get(enrollment.course_id) ?? { lane, points: [] }
      entry.points.push({
        ms: when.getTime(),
        tip: tip.join(LINE_BREAK),
        needsReview: c.needs_to_be_reviewed,
      })
      completionsByCourse.set(enrollment.course_id, entry)
    }
  }

  // Merge same-course completions that land within `clusterMs` into a single marker: overlapping dots
  // would otherwise hide each other's tooltip. The merged tooltip lists each completion and, when more
  // than one is stacked, a count badge on a slightly larger dot flags the overlap.
  const clusterMs = Math.max(spanMs * COMPLETION_CLUSTER_FRACTION, MIN_CLUSTER_MS)
  interface CompletionMarker {
    value: number[]
    symbolSize: number
    itemStyle?: { color: string; borderColor: string }
    label?: {
      show: boolean
      formatter: string
      position: typeof BADGE_LABEL_POSITION
      fontSize: number
      fontWeight: typeof BADGE_LABEL_WEIGHT
      color: string
    }
    _tip: string
  }
  const completionData: CompletionMarker[] = []
  for (const { lane, points } of completionsByCourse.values()) {
    const sorted = points.toSorted((a, b) => a.ms - b.ms)
    let cluster: CompletionPoint[] = []
    const flush = () => {
      if (cluster.length === 0) {
        return
      }
      const count = cluster.length
      // A cluster is drawn red if any completion in it is awaiting review.
      const needsReview = cluster.some((p) => p.needsReview)
      const meanMs = Math.round(cluster.reduce((sum, p) => sum + p.ms, 0) / count)
      const body = cluster.map((p) => p.tip).join(TOOLTIP_DIVIDER)
      completionData.push({
        value: [meanMs, lane],
        symbolSize: count > 1 ? CLUSTER_DOT_SIZE : DOT_SIZE,
        ...includeIf(needsReview, {
          itemStyle: { color: REVIEW_DOT_FILL, borderColor: REVIEW_DOT_BORDER },
        }),
        ...includeIf(count > 1, {
          label: {
            show: true,
            formatter: String(count),
            position: BADGE_LABEL_POSITION,
            fontSize: 10,
            fontWeight: BADGE_LABEL_WEIGHT,
            color: needsReview ? REVIEW_DOT_BORDER : DOT_BORDER,
          },
        }),
        _tip: count > 1 ? `${t("completions-at-point", { n: count })}${LINE_BREAK}${body}` : body,
      })
      cluster = []
    }
    for (const point of sorted) {
      const last = cluster[cluster.length - 1]
      if (last && point.ms - last.ms > clusterMs) {
        flush()
      }
      cluster.push(point)
    }
    flush()
  }

  // One (transparent) point per active day per course, purely for a per-day submissions tooltip. The
  // course-level summary stays on the violin body (custom series); these sit under the marker series so
  // completion/review tooltips win where they overlap.
  const dailyData = enrollments.flatMap((enrollment) => {
    const density = densityByCourse.get(enrollment.course_id)
    if (!density) {
      return []
    }
    const lane = laneByCourseId.get(enrollment.course_id) ?? 0
    return density.activeDays.map((day) => {
      const tip = [dateToString(new Date(day.ms)), t("tooltip-submissions", { count: day.total })]
      if (day.breakdown.length > 1) {
        for (const b of day.breakdown) {
          tip.push(
            t("tooltip-submissions-in-module", {
              module: escapeHtml(b.name ?? t("default-module")),
              count: b.count,
            }),
          )
        }
      }
      return { value: [day.ms, lane], _tip: tip.join(LINE_BREAK) }
    })
  })

  const renderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI,
  ): CustomSeriesRenderItemReturn => {
    const lane = api.value(0) as number
    const startMs = api.value(1) as number
    const endMs = api.value(2) as number
    const start = api.coord([startMs, lane])
    const end = api.coord([endMs, lane])
    const startX = start[0] ?? 0
    const endX = end[0] ?? 0
    const laneHeight = (api.size?.([0, 1]) as number[] | undefined)?.[1] ?? 24
    const cy = start[1] ?? 0
    const coordSys = params.coordSys as unknown as {
      x: number
      y: number
      width: number
      height: number
    }
    const packedItem = packed[params.dataIndex]
    if (!packedItem) {
      return { type: "group", children: [] }
    }
    const bar = packedItem.item
    const baselineY = cy - laneHeight / 2 + laneHeight * BASELINE_FROM_TOP
    const maxViolinPx = laneHeight * VIOLIN_MAX_FRACTION

    // Reserved label placement decided at pack time (full-range scale); the anchor x below is the live
    // (zoomed) marker position, but the reserved width and flip direction come from packing.
    const box = boxByCourseId.get(bar.courseId)
    const labelWidthPx = box?.labelWidthPx ?? MAX_LABEL_PX
    const labelFlipped = box?.labelFlipped ?? false

    // Course name written just below the baseline (the violin rises above it, leaving the underside free).
    // Left-aligned from the span start by default; when flipped it right-aligns to end at the marker so a
    // course near the right edge stays inside the plot instead of clipping.
    const underLabel = (
      x: number,
      align: typeof ECHARTS.ALIGN_LEFT | typeof ECHARTS.ALIGN_RIGHT,
    ) => ({
      type: "text" as const,
      style: {
        text: bar.name,
        x,
        y: baselineY + LABEL_GAP,
        fill: LABEL_FILL,
        fontSize: 12,
        verticalAlign: ECHARTS.VALIGN_TOP,
        align,
        width: labelWidthPx,
        overflow: ECHARTS.OVERFLOW_TRUNCATE,
      },
    })

    // No activity yet: a single diamond on the baseline at the enrollment instant, name beneath it.
    if (!bar.hasActivity) {
      const cx = startX
      if (cx < coordSys.x || cx > coordSys.x + coordSys.width) {
        return { type: "group", children: [] }
      }
      const h = Math.min((laneHeight * DIAMOND_FRACTION) / 2, MAX_DIAMOND_HALF)
      return {
        type: "group",
        children: [
          {
            type: "polygon",
            shape: {
              points: [
                [cx, baselineY - h],
                [cx + h, baselineY],
                [cx, baselineY + h],
                [cx - h, baselineY],
              ],
            },
            style: {
              fill: colorAt(SERIES_COLORS, bar.colorIndex),
              stroke: MARK_BORDER,
              lineWidth: 1,
            },
          },
          labelFlipped
            ? underLabel(cx + h, ECHARTS.ALIGN_RIGHT)
            : underLabel(cx - h, ECHARTS.ALIGN_LEFT),
        ],
      }
    }

    // Faint span track (enrollment → last activity) along the baseline the density rises from. The minimum
    // width keeps single-day courses visible instead of reading as empty lanes.
    const trackWidth = Math.max(endX - startX, 6)
    const rect = clipRect(
      { x: startX, y: baselineY - TRACK_PX / 2, width: trackWidth, height: TRACK_PX },
      { x: coordSys.x, y: coordSys.y, width: coordSys.width, height: coordSys.height },
    )
    if (!rect) {
      return { type: "group", children: [] }
    }

    // One-sided, module-stacked density rising from the baseline. Layers are drawn outermost-first so
    // lower modules paint on top; a shared scale keeps lane heights comparable.
    const violins: NonNullable<CustomSeriesRenderItemReturn>[] = []
    const density = densityByCourse.get(bar.courseId)
    if (density && density.layers.length > 0 && globalMaxDensity > 0) {
      const scale = maxViolinPx / globalMaxDensity
      const xs = density.days.map((d) => api.coord([d, lane])[0] ?? 0)
      const firstX = xs[0] ?? 0
      const lastX = xs[xs.length - 1] ?? 0
      for (let li = density.layers.length - 1; li >= 0; li--) {
        const layer = density.layers[li]
        if (!layer) {
          continue
        }
        const { cumulative, colorIndex } = layer
        const top = xs.map((x, i) => [
          x,
          baselineY - Math.min((cumulative[i] ?? 0) * scale, maxViolinPx),
        ])
        violins.push({
          type: "polygon",
          shape: {
            points: [...top, [lastX, baselineY], [firstX, baselineY]],
            smooth: VIOLIN_SMOOTH,
          },
          style: { fill: colorAt(SERIES_COLORS, colorIndex) },
        } as unknown as NonNullable<CustomSeriesRenderItemReturn>)
      }
    }

    return {
      type: "group",
      children: [
        {
          type: "rect",
          shape: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, r: TRACK_PX / 2 },
          style: { fill: TRACK_FILL },
        },
        ...violins,
        labelFlipped
          ? underLabel(endX, ECHARTS.ALIGN_RIGHT)
          : underLabel(startX, ECHARTS.ALIGN_LEFT),
      ],
    }
  }

  const laneLabels = Array.from({ length: laneCount }, (_, i) => String(i))

  const options: EChartsOption = {
    tooltip: {
      trigger: ECHARTS.TRIGGER_ITEM,
      formatter: (params) => (params as unknown as { data?: { _tip?: string } }).data?._tip ?? "",
    },
    grid: { left: GRID_LEFT, right: GRID_RIGHT, top: 16, bottom: 56, containLabel: true },
    xAxis: {
      type: "time",
      min,
      max,
      axisLabel: { formatter: TIME_AXIS_LABEL, hideOverlap: true },
      splitArea: { show: true, areaStyle: { color: SPLIT_AREA_COLORS } },
    },
    yAxis: {
      type: "category",
      data: laneLabels,
      inverse: true,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    dataZoom: [
      {
        type: "slider",
        filterMode: ECHARTS.FILTER_WEAK,
        showDataShadow: false,
        bottom: 8,
        height: 18,
      },
      { type: "inside", filterMode: ECHARTS.FILTER_WEAK },
    ],
    aria: { enabled: true },
    series: [
      { type: "custom", renderItem, encode: { x: [1, 2], y: 0 }, clip: true, data: barData },
      // Transparent hit targets for the per-day submissions tooltip; below the marker series.
      {
        type: "scatter",
        symbolSize: DAY_TOOLTIP_SIZE,
        symbolOffset: [0, BASELINE_OFFSET_PX],
        z: 1,
        itemStyle: { opacity: 0 },
        data: dailyData,
      },
      {
        // symbolSize + itemStyle are per-item (larger for merged clusters, red when awaiting review);
        // see completionData above. symbolOffset drops the dots from the lane centre onto the baseline.
        type: "scatter",
        symbolOffset: [0, BASELINE_OFFSET_PX],
        z: 3,
        itemStyle: { color: DOT_FILL, borderColor: DOT_BORDER, borderWidth: 1.5 },
        data: completionData,
      },
    ],
  }

  return (
    <div ref={wrapperRef}>
      <Echarts options={options} height={Math.max(160, laneCount * LANE_ROW_PX + 70)} />
      <p className={moduleTimingLegendCss}>{t("density-legend")}</p>
      <Disclosure title={t("show-underlying-data")}>
        <table className={moduleTimingTableCss}>
          <caption className={moduleTimingCaptionCss}>{t("gantt-timeline-caption")}</caption>
          <thead>
            <tr>
              <th>{t("course")}</th>
              <th>{t("label-module")}</th>
              <th>{t("label-started")}</th>
              <th>{t("label-completed")}</th>
              <th>{t("label-time-in-module")}</th>
              <th>{t("label-since-enrolled")}</th>
            </tr>
          </thead>
          <tbody>
            {moduleRowsByCourse.flatMap((course) =>
              course.rows.map((row, i) => (
                <tr key={row.moduleId}>
                  {i === 0 ? <td rowSpan={course.rows.length}>{course.name}</td> : null}
                  <ModuleTimingCells row={row} />
                </tr>
              )),
            )}
          </tbody>
        </table>
      </Disclosure>
    </div>
  )
}

export default ActivityTimeline
