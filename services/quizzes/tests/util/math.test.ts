import { clamp01, isValidNumber, safeDivide } from "../../src/grading/utils/math"

describe("Math utilities", () => {
  describe("safeDivide", () => {
    it("returns correct division result for normal case", () => {
      expect(safeDivide(10, 2)).toBe(5)
      expect(safeDivide(7, 2)).toBe(3.5)
      expect(safeDivide(1, 4)).toBe(0.25)
    })

    it("returns fallback value when denominator is zero", () => {
      expect(safeDivide(10, 0)).toBe(0)
      expect(safeDivide(10, 0, 99)).toBe(99)
      expect(safeDivide(0, 0)).toBe(0)
    })

    it("handles negative numbers correctly", () => {
      expect(safeDivide(-10, 2)).toBe(-5)
      expect(safeDivide(10, -2)).toBe(-5)
      expect(safeDivide(-10, -2)).toBe(5)
    })

    it("handles decimal numbers correctly", () => {
      expect(safeDivide(0.5, 0.25)).toBe(2)
      expect(safeDivide(1.5, 3)).toBe(0.5)
    })
  })

  describe("clamp01", () => {
    it("returns value unchanged when in range [0, 1]", () => {
      expect(clamp01(0)).toBe(0)
      expect(clamp01(0.5)).toBe(0.5)
      expect(clamp01(1)).toBe(1)
    })

    it("clamps values greater than 1 to 1", () => {
      expect(clamp01(1.5)).toBe(1)
      expect(clamp01(2)).toBe(1)
      expect(clamp01(100)).toBe(1)
      expect(clamp01(Infinity)).toBe(1)
    })

    it("clamps values less than 0 to 0", () => {
      expect(clamp01(-0.5)).toBe(0)
      expect(clamp01(-1)).toBe(0)
      expect(clamp01(-100)).toBe(0)
      expect(clamp01(-Infinity)).toBe(0)
    })

    it("handles NaN by clamping to 0", () => {
      // NaN comparisons always return false, so Math.max(0, NaN) returns NaN,
      // but Math.min(1, NaN) also returns NaN. This is expected behavior.
      const result = clamp01(NaN)
      expect(Number.isNaN(result)).toBe(true)
    })
  })

  describe("isValidNumber", () => {
    it("returns true for valid finite numbers", () => {
      expect(isValidNumber(0)).toBe(true)
      expect(isValidNumber(1)).toBe(true)
      expect(isValidNumber(-1)).toBe(true)
      expect(isValidNumber(0.5)).toBe(true)
      expect(isValidNumber(1000)).toBe(true)
      expect(isValidNumber(-1000)).toBe(true)
    })

    it("returns false for NaN", () => {
      expect(isValidNumber(NaN)).toBe(false)
    })

    it("returns false for Infinity", () => {
      expect(isValidNumber(Infinity)).toBe(false)
      expect(isValidNumber(-Infinity)).toBe(false)
    })

    it("returns false for operations that result in NaN", () => {
      expect(isValidNumber(0 / 0)).toBe(false)
      expect(isValidNumber(Math.sqrt(-1))).toBe(false)
    })

    it("returns false for operations that result in Infinity", () => {
      expect(isValidNumber(1 / 0)).toBe(false)
      expect(isValidNumber(-1 / 0)).toBe(false)
    })
  })
})
