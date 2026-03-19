/**
 * @jest-environment jsdom
 */

import { shouldWarnAboutMissingParagraphWrapperInCustomHtml } from "../../src/utils/Gutenberg/customHtmlParagraphWarning"

describe("shouldWarnAboutMissingParagraphWrapperInCustomHtml", () => {
  it("warns for plain text that looks like a single paragraph", () => {
    expect(shouldWarnAboutMissingParagraphWrapperInCustomHtml("Single paragraph")).toBe(true)
  })

  it("warns for inline markup without a paragraph wrapper", () => {
    expect(
      shouldWarnAboutMissingParagraphWrapperInCustomHtml(
        'Text with <strong>bold</strong> and <a href="/docs">link</a>.',
      ),
    ).toBe(true)
  })

  it("warns for inline content with line breaks", () => {
    expect(shouldWarnAboutMissingParagraphWrapperInCustomHtml("First line<br>Second line")).toBe(
      true,
    )
  })

  it("does not warn when the content is already wrapped in a paragraph", () => {
    expect(shouldWarnAboutMissingParagraphWrapperInCustomHtml("<p>Already wrapped</p>")).toBe(false)
  })

  it("does not warn for multiple paragraphs", () => {
    expect(shouldWarnAboutMissingParagraphWrapperInCustomHtml("<p>First</p><p>Second</p>")).toBe(
      false,
    )
  })

  it("does not warn for block-level html", () => {
    expect(shouldWarnAboutMissingParagraphWrapperInCustomHtml("<div>Block content</div>")).toBe(
      false,
    )
  })

  it("does not warn for list markup", () => {
    expect(
      shouldWarnAboutMissingParagraphWrapperInCustomHtml("<ul><li>First</li><li>Second</li></ul>"),
    ).toBe(false)
  })

  it("does not warn when there is no meaningful text", () => {
    expect(
      shouldWarnAboutMissingParagraphWrapperInCustomHtml(
        '<img src="/example.png" alt="Example" />',
      ),
    ).toBe(false)
  })

  it("does not warn for empty content", () => {
    expect(shouldWarnAboutMissingParagraphWrapperInCustomHtml("   ")).toBe(false)
  })
})
