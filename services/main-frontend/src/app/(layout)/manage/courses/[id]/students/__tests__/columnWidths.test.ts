import {
  applyGroupLabelDeficits,
  buildNaturalWidths,
  distributeGroupWidth,
  MAX_MEASURED_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  pickWidestCandidates,
  preserveUserWidths,
  stretchToFill,
} from "../columnWidths"

describe("pickWidestCandidates", () => {
  it("returns the longest distinct values, longest first", () => {
    expect(pickWidestCandidates(["a", "cccc", "bb", "cccc"], 2)).toEqual(["cccc", "bb"])
  })
})

describe("buildNaturalWidths", () => {
  it("never goes below the column's own minimum or the global floor", () => {
    const widths = buildNaturalWidths([
      { columnId: "narrow", contentWidth: 10, minWidth: 0 },
      { columnId: "custom", contentWidth: 10, minWidth: 200 },
    ])
    expect(widths.narrow).toBe(MIN_COLUMN_WIDTH)
    expect(widths.custom).toBe(200)
  })

  it("caps a pathological value so it cannot crowd out every other column", () => {
    const widths = buildNaturalWidths([{ columnId: "huge", contentWidth: 9000, minWidth: 0 }])
    expect(widths.huge).toBe(MAX_MEASURED_COLUMN_WIDTH)
  })
})

describe("applyGroupLabelDeficits", () => {
  it("widens a group's leaves when its own label does not fit above them", () => {
    const widths = applyGroupLabelDeficits({ points: 100, attempts: 100 }, [
      { labelWidth: 300, leafColumnIds: ["points", "attempts"] },
    ])
    expect((widths.points ?? 0) + (widths.attempts ?? 0)).toBeGreaterThanOrEqual(300)
  })

  it("leaves a group alone when its leaves are already wide enough", () => {
    const widths = applyGroupLabelDeficits({ points: 100, attempts: 100 }, [
      { labelWidth: 50, leafColumnIds: ["points", "attempts"] },
    ])
    expect(widths).toEqual({ points: 100, attempts: 100 })
  })
})

describe("stretchToFill", () => {
  it("distributes the slack so the columns span the container exactly", () => {
    const widths = stretchToFill({ a: 100, b: 300 }, ["a", "b"], 800)
    const a = widths.a ?? 0
    const b = widths.b ?? 0
    expect(a + b).toBe(800)
    // Proportional, so the wider column absorbs more of the slack.
    expect(b).toBeGreaterThan(a)
  })

  it("is a no-op once the columns already overflow, since the table scrolls instead", () => {
    expect(stretchToFill({ a: 500, b: 500 }, ["a", "b"], 400)).toEqual({ a: 500, b: 500 })
  })
})

describe("preserveUserWidths", () => {
  it("keeps a dragged width across a re-measure but takes the fresh value elsewhere", () => {
    const merged = preserveUserWidths(
      { student: 200, points: 80 },
      { student: 350, points: 80 },
      new Set(["student"]),
    )
    expect(merged).toEqual({ student: 350, points: 80 })
  })

  it("drops the override once the column is reset", () => {
    const merged = preserveUserWidths({ student: 200 }, { student: 350 }, new Set())
    expect(merged).toEqual({ student: 200 })
  })
})

describe("distributeGroupWidth", () => {
  const leaves = [
    { columnId: "points", minWidth: MIN_COLUMN_WIDTH },
    { columnId: "attempts", minWidth: MIN_COLUMN_WIDTH },
  ]

  it("hits the dragged total exactly, keeping the columns' relative widths", () => {
    const widths = distributeGroupWidth({ points: 100, attempts: 300, other: 80 }, leaves, 800)
    expect((widths.points ?? 0) + (widths.attempts ?? 0)).toBe(800)
    expect(widths.attempts).toBeGreaterThan(widths.points ?? 0)
    expect(widths.other).toBe(80)
  })

  it("holds every spanned column at its minimum rather than collapsing one of them", () => {
    const widths = distributeGroupWidth({ points: 400, attempts: 100 }, leaves, 0)
    expect(widths).toEqual({ points: MIN_COLUMN_WIDTH, attempts: MIN_COLUMN_WIDTH })
  })
})
