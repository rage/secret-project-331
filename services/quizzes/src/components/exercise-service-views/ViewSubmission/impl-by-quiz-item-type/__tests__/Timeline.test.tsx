import { contrastRatio as contrast } from "@/shared-module/common/utils/color"
import { baseTheme } from "@/shared-module/exercise-react/styles"

describe("Timeline correct badge colours", () => {
  it("has at least 4.5:1 contrast", () => {
    expect(
      contrast(baseTheme.colors.clear[100], baseTheme.colors.green[700]),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
