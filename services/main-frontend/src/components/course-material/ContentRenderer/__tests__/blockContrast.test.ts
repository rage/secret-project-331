import { baseTheme } from "@/shared-module/common/styles"
import { contrastRatio as contrast } from "@/shared-module/common/utils/color"

import { CODE_BACKGROUND_COLOR } from "../core/formatting/CodeBlock/styles"

describe("block colour contrast (F-21a, F-22a)", () => {
  it("uses text and header tokens of at least 4.5:1", () => {
    expect(contrast(baseTheme.colors.gray[500], "#ffffff")).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ffffff", baseTheme.colors.green[600])).toBeGreaterThanOrEqual(4.5)
  })

  it("overrides the code comment and subst colours with 4.5:1 values on the code background", () => {
    expect(contrast("#9ca3af", CODE_BACKGROUND_COLOR)).toBeGreaterThanOrEqual(4.5)
    expect(contrast("#ef8890", CODE_BACKGROUND_COLOR)).toBeGreaterThanOrEqual(4.5)
  })
})
