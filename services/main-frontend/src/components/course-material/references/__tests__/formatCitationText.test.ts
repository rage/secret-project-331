import { formatCitationText } from "../index"

describe("formatCitationText", () => {
  test("formats citation with only number", () => {
    expect(formatCitationText(1, undefined, undefined)).toBe("[1]")
    expect(formatCitationText(2, undefined, undefined)).toBe("[2]")
  })

  test("formats citation with prenote only", () => {
    expect(formatCitationText(1, "see", undefined)).toBe("see [1]")
    expect(formatCitationText(2, "cf.", undefined)).toBe("cf. [2]")
  })

  test("formats citation with postnote only", () => {
    expect(formatCitationText(1, undefined, "pp.&nbsp;16-17")).toBe("[1, pp.&nbsp;16-17]")
    expect(formatCitationText(2, undefined, "p.&nbsp;12")).toBe("[2, p.&nbsp;12]")
  })

  test("formats citation with both prenote and postnote", () => {
    expect(formatCitationText(1, "see", "pp.&nbsp;16-17")).toBe("see [1, pp.&nbsp;16-17]")
    expect(formatCitationText(2, "cf.", "p.&nbsp;12")).toBe("cf. [2, p.&nbsp;12]")
  })

  test("formats citation with empty prenote", () => {
    expect(formatCitationText(1, "", undefined)).toBe("[1]")
  })

  test("formats citation with empty postnote", () => {
    expect(formatCitationText(1, "see", "")).toBe("see [1]")
  })

  test("formats citation with both empty prenote and postnote", () => {
    expect(formatCitationText(1, "", "")).toBe("[1]")
  })

  test("handles large citation numbers", () => {
    expect(formatCitationText(42, "see", "p.&nbsp;100")).toBe("see [42, p.&nbsp;100]")
  })
})
