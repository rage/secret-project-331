import { baseTheme } from "@/shared-module/exercise-react/styles"

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe("Timeline correct badge colours", () => {
  it("has at least 4.5:1 contrast", () => {
    expect(
      contrast(baseTheme.colors.clear[100], baseTheme.colors.green[700]),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
