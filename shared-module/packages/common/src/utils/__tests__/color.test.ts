import { contrastRatio, parseRgb, relativeLuminance } from "../color"

describe("color", () => {
  test("parses hex and rgb() colours", () => {
    expect(parseRgb("#fff")).toEqual([255, 255, 255])
    expect(parseRgb("#1a2333")).toEqual([26, 35, 51])
    expect(parseRgb("rgb(250, 250, 250)")).toEqual([250, 250, 250])
    expect(parseRgb("papayawhip")).toBeUndefined()
  })

  test("computes luminance and contrast", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1)
    expect(relativeLuminance("#000000")).toBeCloseTo(0)
    expect(relativeLuminance("nope")).toBeUndefined()
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21)
    expect(contrastRatio("#fff", "#1f6964")).toBeCloseTo(6.44, 2)
    expect(contrastRatio("#fff", "nope")).toBeUndefined()
  })
})
