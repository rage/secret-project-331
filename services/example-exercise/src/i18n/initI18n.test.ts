import { afterEach, describe, expect, it, vi } from "vitest"

import initI18n from "./initI18n"

const i18n = initI18n("example-exercise")

afterEach(() => {
  vi.restoreAllMocks()
})

describe("initI18n", () => {
  it.each([
    ["fi-FI", "Oikein"],
    ["en-US", "Correct"],
    ["sv", "Correct"],
  ])("loads %s without errors", async (language, expected) => {
    const consoleError = vi.spyOn(console, "error")
    await i18n.changeLanguage(language)
    expect(i18n.t("correct")).toBe(expected)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
