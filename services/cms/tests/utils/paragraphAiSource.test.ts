/**
 * @jest-environment jsdom
 */

import { buildParagraphSuggestionRequest } from "../../src/utils/Gutenberg/ai/abilities"
import {
  createParagraphAiSource,
  hasMeaningfulParagraphSuggestionChange,
} from "../../src/utils/Gutenberg/paragraphAiSource"

describe("createParagraphAiSource", () => {
  it("keeps existing inline markup in the AI request content", () => {
    const source = createParagraphAiSource(
      'Keep <a href="https://example.com">link</a> and <code>inline()</code>',
    )

    expect(source.originalText).toBe("Keep link and inline()")
    expect(source.requestContent).toBe(
      'Keep <a href="https://example.com">link</a> and <code>inline()</code>',
    )
    expect(source.requestIsHtml).toBe(true)
  })

  it("keeps plain text requests marked as non-html", () => {
    const source = createParagraphAiSource("Plain paragraph")

    expect(source.originalText).toBe("Plain paragraph")
    expect(source.requestContent).toBe("Plain paragraph")
    expect(source.requestIsHtml).toBe(false)
  })
})

describe("buildParagraphSuggestionRequest", () => {
  it("preserves html content and marks the payload as html", () => {
    const request = buildParagraphSuggestionRequest("moocfi/fix-spelling", {
      text: 'Use <em>markup</em> and <a href="/docs">links</a>',
      isHtml: true,
      meta: {
        tone: "formal",
        language: "en",
        settingType: "course-material",
        context: {
          page_id: "page-id",
          course_id: "course-id",
          locale: "en",
        },
      },
    })

    expect(request).toEqual({
      action: "moocfi/fix-spelling",
      content: 'Use <em>markup</em> and <a href="/docs">links</a>',
      is_html: true,
      meta: {
        tone: "formal",
        language: "en",
        setting_type: "course-material",
      },
      context: {
        page_id: "page-id",
        course_id: "course-id",
        locale: "en",
      },
    })
  })
})

describe("hasMeaningfulParagraphSuggestionChange", () => {
  it("returns false for an identical html suggestion", () => {
    expect(hasMeaningfulParagraphSuggestionChange("Keep <em>this</em>", "Keep <em>this</em>")).toBe(
      false,
    )
  })

  it("returns true for markup-only changes with the same visible text", () => {
    expect(
      hasMeaningfulParagraphSuggestionChange("Keep <em>this</em>", "Keep <strong>this</strong>"),
    ).toBe(true)
  })

  it("returns false for blank suggestions", () => {
    expect(hasMeaningfulParagraphSuggestionChange("Keep <em>this</em>", "   ")).toBe(false)
  })
})
