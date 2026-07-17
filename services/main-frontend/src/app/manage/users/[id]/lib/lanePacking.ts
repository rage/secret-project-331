export interface LanePeriod<T> {
  start: number
  end: number
  item: T
  /**
   * Stable tiebreak for periods with equal `start`/`end`. When keys are distinct the comparator is a
   * total order, so packing is deterministic regardless of input order (and identical across engines).
   * Absent/duplicate keys fall back to `""` and compare equal, so equal-span periods then retain their
   * input order — pass a unique key (production packs by `courseId`) when order-independence matters.
   */
  key?: string
}

export interface PackedPeriod<T> extends LanePeriod<T> {
  lane: number
}

/**
 * Greedy interval packing: sort by start, drop each period into the first lane that is free by its
 * start time, opening a new lane only when none is. With `minGap` (default 0) a lane is only reused once
 * the previous period ended at least `minGap` before this one starts, so overlapping periods always get
 * their own lane while near-adjacent ones are spread across lanes for legibility; the lane count is then
 * peak concurrency or a little more. Units are caller-defined (data-time or pixels); the sort orders by
 * (`start`, then `end`, then `key`). With distinct keys this is a total order, so identical inputs pack
 * identically regardless of input order; equal-span periods with equal/absent keys keep their input order.
 */
export function packLanes<T>(
  periods: LanePeriod<T>[],
  minGap = 0,
): {
  packed: PackedPeriod<T>[]
  laneCount: number
} {
  const sorted = periods.toSorted((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start
    }
    if (a.end !== b.end) {
      return a.end - b.end
    }
    // Plain codepoint comparison, not localeCompare: deterministic across engines/ICU versions and
    // cheaper, which is exactly the cross-engine stability the total order is here to guarantee.
    const ak = a.key ?? ""
    const bk = b.key ?? ""
    return ak < bk ? -1 : ak > bk ? 1 : 0
  })
  const laneEnds: number[] = [] // last end-time per open lane
  const packed = sorted.map((period) => {
    let lane = laneEnds.findIndex((end) => end + minGap <= period.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(period.end)
    } else {
      laneEnds[lane] = period.end
    }
    return { ...period, lane }
  })
  return { packed, laneCount: laneEnds.length }
}

export interface LaneBoxInput<T> {
  /** Stable tiebreak (e.g. courseId). */
  key: string
  startMs: number
  endMs: number
  label: string
  item: T
}

export interface LaneBox<T> extends LanePeriod<T> {
  key: string
  /** Label anchored left from the span start (default) or flipped to end at the marker near the right edge. */
  labelFlipped: boolean
  /** Measured, padded, capped label width in px; the renderer truncates the label to exactly this. */
  labelWidthPx: number
  /** Left edge of the reserved label region in px; place the label here (right-align when flipped). */
  labelStartPx: number
  /** Raw scaled marker positions in px (no marker pad) for placing the track/diamond. */
  spanStartPx: number
  spanEndPx: number
}

/**
 * Turn data-time spans into pixel boxes whose extent covers the marker overhang *and* the rendered
 * label, so packing them keeps labels from colliding by construction. Text measurement is injected so
 * this stays pure and DOM-free (production passes a canvas `measureText`).
 *
 * The label anchors at the span start and grows rightward; when that would run past `plotRightPx` it
 * flips to end at the marker and grows leftward instead (`start`/`end` are the resulting box in px).
 * Marker overhang is reserved on *both* ends (a completion dot can sit at either end; the no-activity
 * diamond extends left of the start), so the footprint contains what is drawn and same-lane courses
 * keep the intended gap. Zero-length spans need no special case — the label alone dominates the box.
 */
export function computeLaneBoxes<T>(
  inputs: LaneBoxInput<T>[],
  opts: {
    /** Full-range time scale; packing at full range is the worst case so it stays valid when zoomed. */
    msToPx: (ms: number) => number
    /** Right plot edge; a label reaching past it flips inward. */
    plotRightPx: number
    /** Injected label measurer (canvas `measureText` in prod). */
    measureLabelPx: (text: string) => number
    maxLabelPx: number
    markerPadPx: number
    labelPadPx: number
  },
): LaneBox<T>[] {
  const { msToPx, plotRightPx, measureLabelPx, maxLabelPx, markerPadPx, labelPadPx } = opts
  return inputs.map((input) => {
    const labelWidthPx = Math.min(measureLabelPx(input.label) + labelPadPx, maxLabelPx)
    const spanStartPx = msToPx(input.startMs)
    const spanEndPx = msToPx(input.endMs)
    // Marker overhang extends the drawn footprint past both ends of the span: past the end (cluster
    // dots), and left of the start (the no-activity diamond / a completion dot at enrollment).
    const markerStartPx = spanStartPx - markerPadPx
    const markerEndPx = spanEndPx + markerPadPx
    const labelFlipped = spanStartPx + labelWidthPx > plotRightPx
    const labelStartPx = labelFlipped ? markerEndPx - labelWidthPx : spanStartPx
    return {
      key: input.key,
      item: input.item,
      labelFlipped,
      labelWidthPx,
      labelStartPx,
      spanStartPx,
      spanEndPx,
      start: Math.min(markerStartPx, labelStartPx),
      end: Math.max(markerEndPx, labelStartPx + labelWidthPx),
    }
  })
}
