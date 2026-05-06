/**
 * @jest-environment jsdom
 */

import { shouldWarnAboutParagraphLookingLikeHeading } from "../../src/utils/Gutenberg/paragraphHeadingWarning"

describe("shouldWarnAboutParagraphLookingLikeHeading", () => {
  it("warns for a short single bolded line", () => {
    expect(shouldWarnAboutParagraphLookingLikeHeading("<strong>Introduction</strong>")).toBe(true)
  })

  it("warns for inline markup nested inside the bolded line", () => {
    expect(
      shouldWarnAboutParagraphLookingLikeHeading(
        "<strong><span>Course</span> <em>Overview</em></strong>",
      ),
    ).toBe(true)
  })

  it("does not warn for a regular paragraph", () => {
    expect(shouldWarnAboutParagraphLookingLikeHeading("This is normal paragraph text.")).toBe(false)
  })

  it("does not warn when only part of the paragraph is bolded", () => {
    expect(
      shouldWarnAboutParagraphLookingLikeHeading("Text <strong>with emphasis</strong> only"),
    ).toBe(false)
  })

  it("does not warn for multi-line bold content", () => {
    expect(
      shouldWarnAboutParagraphLookingLikeHeading("<strong>First line<br>Second line</strong>"),
    ).toBe(false)
  })

  it("does not warn for long bold text that looks like a sentence", () => {
    expect(
      shouldWarnAboutParagraphLookingLikeHeading(
        "<strong>This is a fully bolded sentence that is long enough to read like emphasis instead of a section heading.</strong>",
      ),
    ).toBe(false)
  })

  it("does not warn for block-level markup", () => {
    expect(
      shouldWarnAboutParagraphLookingLikeHeading("<div><strong>Introduction</strong></div>"),
    ).toBe(false)
  })

  it("does not warn for empty content", () => {
    expect(shouldWarnAboutParagraphLookingLikeHeading("   ")).toBe(false)
  })
})
