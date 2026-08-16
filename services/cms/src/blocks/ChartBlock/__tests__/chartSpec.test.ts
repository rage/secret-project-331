import { DEFAULT_CHART_HEIGHT, isAutoHeight, resolveChartLayout, specHasData } from "../chartSpec"

describe("specHasData", () => {
  it("finds a top-level data source", () => {
    expect(specHasData({ data: { url: "data.csv" }, mark: "bar" })).toBe(true)
  })

  it("finds data carried by individual layers", () => {
    expect(
      specHasData({
        layer: [
          { data: { url: "a.csv" }, mark: "line" },
          { data: { url: "b.csv" }, mark: "point" },
        ],
      }),
    ).toBe(true)
  })

  it("finds data nested in a concatenated sub-spec", () => {
    expect(specHasData({ hconcat: [{ vconcat: [{ data: { url: "a.csv" }, mark: "bar" }] }] })).toBe(
      true,
    )
  })

  it("finds data in a facet's inner spec", () => {
    expect(specHasData({ facet: { field: "group" }, spec: { data: { url: "a.csv" } } })).toBe(true)
  })

  it("reports a spec with no data source anywhere", () => {
    expect(specHasData({ layer: [{ mark: "line" }, { mark: "point" }] })).toBe(false)
  })

  it("reports non-spec values", () => {
    expect(specHasData(null)).toBe(false)
    expect(specHasData("data")).toBe(false)
  })
})

describe("isAutoHeight", () => {
  it("honours an explicit flag even at the default height", () => {
    expect(isAutoHeight(DEFAULT_CHART_HEIGHT, false)).toBe(false)
    expect(isAutoHeight(500, true)).toBe(true)
  })

  it("falls back to the default height for blocks saved without the flag", () => {
    expect(isAutoHeight(DEFAULT_CHART_HEIGHT, undefined)).toBe(true)
    expect(isAutoHeight(500, undefined)).toBe(false)
  })
})

describe("resolveChartLayout", () => {
  it("scales a multi-view chart to a height equal to the default", () => {
    expect(
      resolveChartLayout({
        heightAttr: DEFAULT_CHART_HEIGHT,
        heightIsAuto: false,
        naturalHeightPx: 800,
        isMultiView: true,
      }),
    ).toEqual({ boxHeightPx: DEFAULT_CHART_HEIGHT, scale: DEFAULT_CHART_HEIGHT / 800 })
  })

  it("shows a multi-view chart at natural size while its height is automatic", () => {
    expect(
      resolveChartLayout({
        heightAttr: DEFAULT_CHART_HEIGHT,
        heightIsAuto: true,
        naturalHeightPx: 800,
        isMultiView: true,
      }),
    ).toEqual({ boxHeightPx: 800, scale: 1 })
  })

  it("leaves single-view charts unscaled at the set height", () => {
    expect(
      resolveChartLayout({
        heightAttr: 420,
        heightIsAuto: false,
        naturalHeightPx: 800,
        isMultiView: false,
      }),
    ).toEqual({ boxHeightPx: 420, scale: 1 })
  })
})
