/** Narrowest a column may become, by drag or by measurement. */
export const MIN_COLUMN_WIDTH = 56

/** Caps the measured width so one pathological value cannot push every other column off-screen. */
export const MAX_MEASURED_COLUMN_WIDTH = 420

/** Widest a column may be dragged. Higher than the measured cap, which only bounds automatic sizing. */
export const MAX_COLUMN_WIDTH = 1200

/** Proportional fonts make string length only a rough proxy, so measure several of the longest. */
export const MEASURE_CANDIDATE_COUNT = 8

export interface LeafWidthInput {
  columnId: string
  /** Widest rendered text in this column, already converted to pixels. */
  contentWidth: number
  minWidth: number
}

/** A grouped header, whose own label can be wider than the columns it spans. */
export interface GroupWidthInput {
  labelWidth: number
  leafColumnIds: string[]
}

/**
 * The `MEASURE_CANDIDATE_COUNT` longest distinct strings. Scanning by length first keeps the
 * expensive text measurement to a handful of calls per column instead of one per row.
 */
export function pickWidestCandidates(
  values: readonly string[],
  limit: number = MEASURE_CANDIDATE_COUNT,
): string[] {
  const distinct = [...new Set(values)]
  return distinct.toSorted((a, b) => b.length - a.length).slice(0, limit)
}

function clampWidth(width: number, minWidth: number): number {
  return Math.min(Math.max(width, minWidth, MIN_COLUMN_WIDTH), MAX_MEASURED_COLUMN_WIDTH)
}

/** Clamped natural width per column, before any group or viewport adjustment. */
export function buildNaturalWidths(leaves: readonly LeafWidthInput[]): Record<string, number> {
  const widths: Record<string, number> = {}
  for (const leaf of leaves) {
    widths[leaf.columnId] = clampWidth(Math.ceil(leaf.contentWidth), leaf.minWidth)
  }
  return widths
}

/**
 * Widens a group's leaves until they can hold the group's own label. Without this a long chapter
 * name is silently clipped, because a fixed layout sizes only from the leaf columns.
 */
export function applyGroupLabelDeficits(
  widths: Record<string, number>,
  groups: readonly GroupWidthInput[],
): Record<string, number> {
  const adjusted = { ...widths }
  for (const group of groups) {
    const leafIds = group.leafColumnIds.filter((id) => adjusted[id] !== undefined)
    if (leafIds.length === 0) {
      continue
    }
    const total = leafIds.reduce((sum, id) => sum + (adjusted[id] ?? 0), 0)
    const deficit = Math.ceil(group.labelWidth) - total
    if (deficit <= 0) {
      continue
    }
    for (const id of leafIds) {
      const share = total > 0 ? (adjusted[id] ?? 0) / total : 1 / leafIds.length
      adjusted[id] = Math.ceil((adjusted[id] ?? 0) + deficit * share)
    }
  }
  return adjusted
}

/**
 * Grows columns proportionally so they span `availableWidth` exactly. A no-op when the columns
 * already overflow, since the table scrolls horizontally in that case.
 */
export function stretchToFill(
  widths: Record<string, number>,
  orderedColumnIds: readonly string[],
  availableWidth: number,
): Record<string, number> {
  const ids = orderedColumnIds.filter((id) => widths[id] !== undefined)
  if (ids.length === 0 || availableWidth <= 0) {
    return { ...widths }
  }
  const total = ids.reduce((sum, id) => sum + (widths[id] ?? 0), 0)
  if (total >= availableWidth || total <= 0) {
    return { ...widths }
  }

  const stretched = { ...widths }
  const slack = availableWidth - total
  let distributed = 0
  // The last column absorbs the rounding remainder so the widths sum to availableWidth exactly.
  ids.forEach((id, index) => {
    if (index === ids.length - 1) {
      stretched[id] = (widths[id] ?? 0) + (slack - distributed)
      return
    }
    const share = Math.floor(slack * ((widths[id] ?? 0) / total))
    stretched[id] = (widths[id] ?? 0) + share
    distributed += share
  })
  return stretched
}

/**
 * Merges freshly measured widths with the ones the user dragged, so a page change or a resize
 * does not undo their adjustments.
 */
export function preserveUserWidths(
  measured: Record<string, number>,
  current: Record<string, number>,
  userResizedColumnIds: ReadonlySet<string>,
): Record<string, number> {
  const merged = { ...measured }
  for (const id of userResizedColumnIds) {
    const width = current[id]
    if (width !== undefined && merged[id] !== undefined) {
      merged[id] = width
    }
  }
  return merged
}

/**
 * Spreads a grouped header's new total across the columns it spans, keeping their relative widths
 * and each one's own minimum. Sums to `targetTotal` exactly unless the minimums forbid it.
 */
export function distributeGroupWidth(
  widths: Record<string, number>,
  leaves: readonly { columnId: string; minWidth: number }[],
  targetTotal: number,
): Record<string, number> {
  const next = { ...widths }
  const present = leaves.filter((leaf) => widths[leaf.columnId] !== undefined)
  const currentTotal = present.reduce((sum, leaf) => sum + (widths[leaf.columnId] ?? 0), 0)
  if (present.length === 0 || currentTotal <= 0) {
    return next
  }

  const scale = targetTotal / currentTotal
  let assigned = 0
  present.forEach((leaf, index) => {
    // The last column takes whatever is left, so rounding cannot drift the total off target.
    const raw =
      index === present.length - 1
        ? targetTotal - assigned
        : Math.round((widths[leaf.columnId] ?? 0) * scale)
    const width = Math.max(raw, leaf.minWidth, MIN_COLUMN_WIDTH)
    next[leaf.columnId] = width
    assigned += width
  })
  return next
}
