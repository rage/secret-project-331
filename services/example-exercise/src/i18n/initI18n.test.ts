import { afterEach, describe, expect, it, vi } from "vitest"

import initI18n from "./initI18n"

const i18n = initI18n("example-exercise")

afterEach(() => {
  vi.restoreAllMocks()
})

describe("initI18n", () => {
  it.each([
    ["fi-FI", "Odotetaan porttia..."],
    ["en-US", "Waiting for port..."],
    ["sv", "Waiting for port..."],
  ])("loads %s without errors", async (language, expected) => {
    const consoleError = vi.spyOn(console, "error")
    await i18n.changeLanguage(language)
    expect(i18n.t("waiting-for-port")).toBe(expected)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
