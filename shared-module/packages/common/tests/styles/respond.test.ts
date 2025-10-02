import { BACKGROUND_BREAKPOINT_PIXELS } from "../../src/styles/respond"

describe("respond.ts - Pixel Value Calculations", () => {
  describe("BACKGROUND_BREAKPOINT_PIXELS", () => {
    it("should match the documented pixel values", () => {
      expect(BACKGROUND_BREAKPOINT_PIXELS.MEDIUM).toBe(768) // md breakpoint
      expect(BACKGROUND_BREAKPOINT_PIXELS.LARGE).toBe(992) // lg breakpoint
      expect(BACKGROUND_BREAKPOINT_PIXELS.X_LARGE).toBe(1200) // xl breakpoint
    })
  })
})
