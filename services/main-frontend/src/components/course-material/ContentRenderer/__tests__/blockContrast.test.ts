import { baseTheme } from "@/shared-module/common/styles"

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe("block colour contrast (F-21a, F-22a)", () => {
  it("uses text and header tokens of at least 4.5:1", () => {
    expect(contrast(baseTheme.colors.gray[500], "#ffffff")).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ffffff", baseTheme.colors.green[600])).toBeGreaterThanOrEqual(4.5)
  })

  it("overrides the code comment and subst colours with 4.5:1 values on #282c34", () => {
    expect(contrast("#9ca3af", "#282c34")).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ef8890", "#282c34")).toBeGreaterThanOrEqual(4.5)
  })
})
