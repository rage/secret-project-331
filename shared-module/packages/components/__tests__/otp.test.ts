"use client"

import {
  applyOtpBackspace,
  applyOtpCharacter,
  applyOtpPaste,
  joinOtpSlots,
  sanitizeOtpText,
  splitOtpValue,
} from "../src/lib/utils/otp"

describe("otp utils", () => {
  test("sanitizes unsupported characters", () => {
    expect(sanitizeOtpText("a1-2b3")).toBe("123")
  })

  test("splits and joins values", () => {
    expect(splitOtpValue("123", 4)).toEqual(["1", "2", "3", ""])
    expect(joinOtpSlots(["1", "2", "3", ""])).toBe("123")
  })

  test("applies a single character", () => {
    const result = applyOtpCharacter(["", "", ""], 0, "7", /[0-9]/)
    expect(result.slots).toEqual(["7", "", ""])
    expect(result.nextIndex).toBe(1)
  })

  test("applies pasted text across slots", () => {
    const result = applyOtpPaste(["", "", "", ""], 1, "1234", /[0-9]/)
    expect(result.slots).toEqual(["", "1", "2", "3"])
    expect(result.nextIndex).toBe(3)
  })

  test("backspace clears the current slot first", () => {
    const result = applyOtpBackspace(["1", "2", ""], 1)
    expect(result.slots).toEqual(["1", "", ""])
    expect(result.nextIndex).toBe(1)
  })
})
