import { ALT_TEXT_NOT_CHANGED_PLACEHOLDER } from "../../src/services/backend/media/altTextPlaceholder"
import { shouldWarnAboutImageAltPlaceholder } from "../../src/utils/Gutenberg/imageAltWarning"

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

  it("does not warn for an empty alt text", () => {
    expect(shouldWarnAboutImageAltPlaceholder("")).toBe(false)
  })

  it("does not warn for missing alt text", () => {
    expect(shouldWarnAboutImageAltPlaceholder(undefined)).toBe(false)
  })
})
