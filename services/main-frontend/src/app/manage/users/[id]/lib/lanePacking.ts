export interface LanePeriod<T> {
  start: number
  end: number
  item: T
}

export interface PackedPeriod<T> extends LanePeriod<T> {
  lane: number
}

/**
 * Greedy interval packing: sort by start, drop each period into the first lane that is free by its
 * start time, opening a new lane only when none is. With `minGap` (default 0) a lane is only reused once
 * the previous period ended at least `minGap` before this one starts, so overlapping periods always get
 * their own lane while near-adjacent ones are spread across lanes for legibility; the lane count is then
 * peak concurrency or a little more.
 */
export function packLanes<T>(
  periods: LanePeriod<T>[],
  minGap = 0,
): {
  packed: PackedPeriod<T>[]
  laneCount: number
} {
  const sorted = periods.toSorted((a, b) => a.start - b.start || a.end - b.end)
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
