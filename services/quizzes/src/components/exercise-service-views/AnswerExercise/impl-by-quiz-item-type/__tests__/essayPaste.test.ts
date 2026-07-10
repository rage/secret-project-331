import type { TFunction } from "i18next"

import {
  getEssayPasteWarning,
  isLargePaste,
  LARGE_PASTE_CHAR_THRESHOLD,
  LARGE_PASTE_WORD_THRESHOLD,
} from "../essayPaste"

import enQuizzes from "@/shared-module/common/locales/en/quizzes.json"

const words = (n: number, token = "word"): string =>
  Array.from({ length: n }, () => token).join(" ")

/** Identity translator: returns the key, so tests can assert which key was requested. */
const identityT = ((key: string) => key) as unknown as TFunction

/** Translator backed by the real English quizzes strings. */
const enT = ((key: string) =>
  (enQuizzes as Record<string, string>)[key] ?? key) as unknown as TFunction

describe("isLargePaste", () => {
  it("is false for empty or whitespace-only input", () => {
    expect(isLargePaste("")).toBe(false)
    expect(isLargePaste("   \n\t  ")).toBe(false)
  })

  it("is false for an ordinary small paste", () => {
    expect(isLargePaste("Just fixing a typo")).toBe(false)
    expect(isLargePaste(words(LARGE_PASTE_WORD_THRESHOLD - 1, "a"))).toBe(false)
  })

  it("is true once the word threshold is reached", () => {
    expect(isLargePaste(words(LARGE_PASTE_WORD_THRESHOLD))).toBe(true)
    expect(isLargePaste(words(LARGE_PASTE_WORD_THRESHOLD + 20))).toBe(true)
  })

  it("counts words separated by newlines and tabs, not just spaces", () => {
    const multiline = Array.from({ length: LARGE_PASTE_WORD_THRESHOLD }, (_, i) => `w${i}`).join(
      "\n",
    )
    expect(isLargePaste(multiline)).toBe(true)
  })

  it("is true for a long unbroken block via the character fallback, even with few words", () => {
    expect(isLargePaste("x".repeat(LARGE_PASTE_CHAR_THRESHOLD))).toBe(true)
  })

  it("is false for a block just under the character fallback with few words", () => {
    expect(isLargePaste("x".repeat(LARGE_PASTE_CHAR_THRESHOLD - 1))).toBe(false)
  })
})

describe("getEssayPasteWarning", () => {
  it("returns null for a small paste (no warning)", () => {
    expect(getEssayPasteWarning("a quick fix", identityT)).toBeNull()
    expect(getEssayPasteWarning("", identityT)).toBeNull()
  })

  it("returns a warning dialog requesting the right translation keys for a large paste", () => {
    const warning = getEssayPasteWarning(words(LARGE_PASTE_WORD_THRESHOLD), identityT)
    expect(warning).toEqual({
      dialogType: "warning",
      title: "essay-paste-warning-title",
      body: ["essay-paste-warning-body"],
      confirmButtonLabel: "essay-paste-warning-acknowledge",
    })
  })

  it("fills the dialog with the localized strings", () => {
    const warning = getEssayPasteWarning(words(LARGE_PASTE_WORD_THRESHOLD), enT)
    expect(warning?.dialogType).toBe("warning")
    expect(warning?.title).toBe(enQuizzes["essay-paste-warning-title"])
    expect(warning?.body).toEqual(enQuizzes["essay-paste-warning-body"].split("\n\n"))
    expect(warning?.confirmButtonLabel).toBe(enQuizzes["essay-paste-warning-acknowledge"])
  })
})
