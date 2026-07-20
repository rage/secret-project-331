"use client"

import dynamicImport from ".."
describe("dynamicImport", () => {
  test("is a function", () => {
    expect(typeof dynamicImport).toBe("function")
  })
})
