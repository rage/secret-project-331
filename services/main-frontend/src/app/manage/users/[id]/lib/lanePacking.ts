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
 * start time, opening a new lane only when none is. The resulting lane count equals peak concurrency.
 */
export function packLanes<T>(periods: LanePeriod<T>[]): {
  packed: PackedPeriod<T>[]
  laneCount: number
} {
  const sorted = [...periods].sort((a, b) => a.start - b.start || a.end - b.end)
  const laneEnds: number[] = [] // last end-time per open lane
  const packed = sorted.map((period) => {
    let lane = laneEnds.findIndex((end) => end <= period.start)
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
