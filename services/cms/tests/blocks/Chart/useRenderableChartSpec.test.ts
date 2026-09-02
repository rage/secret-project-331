/**
 * @jest-environment jsdom
 */

import { renderHook } from "@testing-library/react"

import { useRenderableChartSpec } from "../../../src/blocks/Chart/useRenderableChartSpec"

const SINGLE_VIEW = JSON.stringify({
  mark: "bar",
  data: { url: "/uploads/data.csv" },
  encoding: { x: { field: "a", type: "nominal" } },
})

const MULTI_VIEW = JSON.stringify({
  hconcat: [
    { mark: "bar", data: { url: "/uploads/data.csv" } },
    { mark: "line", data: { url: "/uploads/other.csv" } },
  ],
})

interface Options {
  spec?: string
  containerWidthPx?: number | null
  heightPx?: number
  heightIsAuto?: boolean
  naturalHeightPx?: number | null
  caption?: string
}

const render = (options: Options = {}) =>
  renderHook(() =>
    useRenderableChartSpec({
      spec: SINGLE_VIEW,
      containerWidthPx: 800,
      heightPx: 300,
      heightIsAuto: false,
      naturalHeightPx: null,
      ...options,
    }),
  ).result.current

// The hook types its output as the renderer's spec, which is a union rather than a plain record.
const asRecord = (spec: unknown): Record<string, unknown> => spec as Record<string, unknown>

describe("useRenderableChartSpec", () => {
  it("sizes a single-view spec to the measured width and the set height", () => {
    const { responsiveSpec, isValidJson, hasData } = render()

    expect(isValidJson).toBe(true)
    expect(hasData).toBe(true)
    const spec = asRecord(responsiveSpec)
    expect(spec.width).toBe(800)
    expect(spec.height).toBe(300)
    expect(spec.autosize).toEqual({ type: "fit", contains: "padding" })
  })

  it("draws the chart's text in the site font, without discarding the spec's own config", () => {
    const withConfig = JSON.stringify({
      mark: "bar",
      data: { url: "/uploads/data.csv" },
      config: { background: "#fff" },
    })

    const spec = asRecord(render({ spec: withConfig }).responsiveSpec)

    expect(spec.config).toEqual({ font: expect.stringContaining("Inter"), background: "#fff" })
  })

  it("lets a spec keep a font it chose for itself", () => {
    const withFont = JSON.stringify({
      mark: "bar",
      data: { url: "/uploads/data.csv" },
      config: { font: "Comic Sans MS" },
    })

    const spec = asRecord(render({ spec: withFont }).responsiveSpec)

    expect(spec.config).toEqual({ font: "Comic Sans MS" })
  })

  it("leaves a multi-view spec unsized, since Vega-Lite would ignore it", () => {
    const spec = asRecord(render({ spec: MULTI_VIEW }).responsiveSpec)

    expect(spec.width).toBe(800)
    expect("height" in spec).toBe(false)
    expect("autosize" in spec).toBe(false)
  })

  it("waits for the container to be measured before producing a spec", () => {
    expect(render({ containerWidthPx: null }).responsiveSpec).toBeNull()
  })

  it("names the chart with the caption when the spec has no description of its own", () => {
    const spec = asRecord(render({ caption: "Sales by month" }).responsiveSpec)

    expect(spec.description).toBe("Sales by month")
  })

  it("prefers the spec's own description over the caption", () => {
    const described = JSON.stringify({
      mark: "bar",
      data: { url: "/uploads/data.csv" },
      description: "From the spec",
    })

    const spec = asRecord(render({ spec: described, caption: "The caption" }).responsiveSpec)

    expect(spec.description).toBe("From the spec")
  })

  it("adds no description when there is neither", () => {
    expect("description" in asRecord(render().responsiveSpec)).toBe(false)
  })

  it("reports an unparseable spec instead of a chart", () => {
    const { isValidJson, hasData, responsiveSpec } = render({ spec: "{ not json" })

    expect(isValidJson).toBe(false)
    expect(hasData).toBe(false)
    expect(responsiveSpec).toBeNull()
  })

  it("reports a spec with no data source anywhere", () => {
    const { isValidJson, hasData } = render({ spec: JSON.stringify({ mark: "bar" }) })

    expect(isValidJson).toBe(true)
    expect(hasData).toBe(false)
  })

  it("finds data a multi-view spec only declares on its sub-views", () => {
    expect(render({ spec: MULTI_VIEW }).hasData).toBe(true)
  })

  describe("layout", () => {
    it("uses the set height at full scale for a single-view chart", () => {
      const { boxHeightPx, scale, isMultiView } = render({ naturalHeightPx: 900 })

      expect(isMultiView).toBe(false)
      expect(boxHeightPx).toBe(300)
      expect(scale).toBe(1)
    })

    it("scales a multi-view chart down into the set height", () => {
      const { boxHeightPx, scale } = render({
        spec: MULTI_VIEW,
        heightPx: 300,
        naturalHeightPx: 600,
      })

      expect(boxHeightPx).toBe(300)
      expect(scale).toBe(0.5)
    })

    it("shows a multi-view chart at natural size while the height is still automatic", () => {
      const { boxHeightPx, scale } = render({
        spec: MULTI_VIEW,
        heightPx: 300,
        heightIsAuto: true,
        naturalHeightPx: 600,
      })

      expect(boxHeightPx).toBe(600)
      expect(scale).toBe(1)
    })

    it("does not magnify a multi-view chart past its natural size", () => {
      const { boxHeightPx, scale } = render({
        spec: MULTI_VIEW,
        heightPx: 900,
        naturalHeightPx: 300,
      })

      expect(boxHeightPx).toBe(900)
      expect(scale).toBe(1)
    })

    it("falls back to the set height until the chart has been measured", () => {
      const { boxHeightPx, scale } = render({ spec: MULTI_VIEW, naturalHeightPx: null })

      expect(boxHeightPx).toBe(300)
      expect(scale).toBe(1)
    })
  })
})
