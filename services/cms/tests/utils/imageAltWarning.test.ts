import { ALT_TEXT_NOT_CHANGED_PLACEHOLDER } from "../../src/services/altTextPlaceholder"
import {
  isGoogleDocsImageUrl,
  shouldWarnAboutImageAltPlaceholder,
} from "../../src/utils/Gutenberg/imageAltWarning"

describe("shouldWarnAboutImageAltPlaceholder", () => {
  it("warns when the alt text is still the default placeholder", () => {
    expect(shouldWarnAboutImageAltPlaceholder(ALT_TEXT_NOT_CHANGED_PLACEHOLDER)).toBe(true)
  })

  it("warns when the placeholder has surrounding whitespace", () => {
    expect(shouldWarnAboutImageAltPlaceholder(` ${ALT_TEXT_NOT_CHANGED_PLACEHOLDER} `)).toBe(true)
  })

  it("does not warn for a custom alt text", () => {
    expect(shouldWarnAboutImageAltPlaceholder("Student looking at a laptop")).toBe(false)
  })

  it("warns for an empty alt text on a non-decorative image", () => {
    expect(shouldWarnAboutImageAltPlaceholder("")).toBe(true)
  })

  it("warns for a whitespace-only alt text on a non-decorative image", () => {
    expect(shouldWarnAboutImageAltPlaceholder("   ")).toBe(true)
  })

  it("does not warn for missing alt text", () => {
    expect(shouldWarnAboutImageAltPlaceholder(undefined)).toBe(false)
  })

  it("does not warn for a decorative image even when the alt is still the placeholder", () => {
    expect(shouldWarnAboutImageAltPlaceholder(ALT_TEXT_NOT_CHANGED_PLACEHOLDER, true)).toBe(false)
  })

  it("does not warn for a decorative image with an empty alt text", () => {
    expect(shouldWarnAboutImageAltPlaceholder("", true)).toBe(false)
  })

  it("still warns for a non-decorative image with the placeholder alt", () => {
    expect(shouldWarnAboutImageAltPlaceholder(ALT_TEXT_NOT_CHANGED_PLACEHOLDER, false)).toBe(true)
  })
})

describe("isGoogleDocsImageUrl", () => {
  it("recognizes images pasted from a Google Doc", () => {
    expect(
      isGoogleDocsImageUrl("https://lh7-rt.googleusercontent.com/docsz/AD_4nXc1?key=abc"),
    ).toBe(true)
    expect(isGoogleDocsImageUrl("https://lh7-us.googleusercontent.com/AD_4nXc1")).toBe(true)
  })

  it("ignores other images", () => {
    expect(isGoogleDocsImageUrl("https://lh3.googleusercontent.com/a/profile.png")).toBe(false)
    expect(isGoogleDocsImageUrl("https://example.com/docs/cat.png")).toBe(false)
    expect(isGoogleDocsImageUrl(undefined)).toBe(false)
  })
})
