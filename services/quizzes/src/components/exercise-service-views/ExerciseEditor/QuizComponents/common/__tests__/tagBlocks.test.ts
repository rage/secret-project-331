import { containsMarkdownBlock } from "../tagBlocks"

describe("containsMarkdownBlock", () => {
  describe("empty / nullish input", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["empty string", ""],
    ])("returns false for %s", (_label, input) => {
      expect(containsMarkdownBlock(input)).toBe(false)
    })

    it("returns false for plain text without any tags", () => {
      expect(containsMarkdownBlock("just some feedback text")).toBe(false)
    })
  })

  describe("complete blocks", () => {
    it("returns true for a basic block with content", () => {
      expect(containsMarkdownBlock("[markdown]**bold**[/markdown]")).toBe(true)
    })

    it("returns true for an empty block (the [markdown][/markdown] case)", () => {
      expect(containsMarkdownBlock("[markdown][/markdown]")).toBe(true)
    })

    it("returns true when the block is surrounded by other text", () => {
      expect(containsMarkdownBlock("intro [markdown]x[/markdown] outro")).toBe(true)
    })

    it("returns true when the block spans multiple lines", () => {
      expect(containsMarkdownBlock("[markdown]line one\n\nline two[/markdown]")).toBe(true)
    })

    it("returns true when there are multiple blocks", () => {
      expect(containsMarkdownBlock("[markdown]a[/markdown] and [markdown]b[/markdown]")).toBe(true)
    })

    it("returns true for nested / overlapping markdown tags (a complete pair still exists)", () => {
      expect(containsMarkdownBlock("[markdown][markdown]x[/markdown][/markdown]")).toBe(true)
      expect(containsMarkdownBlock("[markdown]a[markdown]b[/markdown]")).toBe(true)
    })

    it("returns true for a valid pair that follows a stray closing tag", () => {
      expect(containsMarkdownBlock("[/markdown][markdown][/markdown]")).toBe(true)
    })
  })

  describe("incomplete or malformed blocks", () => {
    it("returns false for an opening tag with no closing tag", () => {
      expect(containsMarkdownBlock("[markdown]unfinished")).toBe(false)
    })

    it("returns false for a closing tag with no opening tag", () => {
      expect(containsMarkdownBlock("orphaned[/markdown]")).toBe(false)
    })

    it("returns false when the closing tag appears before the opening tag", () => {
      expect(containsMarkdownBlock("[/markdown][markdown]")).toBe(false)
      expect(containsMarkdownBlock("foo [/markdown] bar [markdown] baz")).toBe(false)
    })

    it("returns false when the closing tag is missing its bracket", () => {
      expect(containsMarkdownBlock("[markdown]foo[/markdown")).toBe(false)
    })

    it("returns false when the opening tag is missing its bracket", () => {
      expect(containsMarkdownBlock("[markdown foo[/markdown]")).toBe(false)
    })

    it("returns false for tags with extra inner whitespace (exact match required)", () => {
      expect(containsMarkdownBlock("[ markdown ]x[/ markdown ]")).toBe(false)
    })

    it("returns false for uppercase tags (matching is case-sensitive)", () => {
      expect(containsMarkdownBlock("[MARKDOWN]x[/MARKDOWN]")).toBe(false)
    })
  })

  describe("does not confuse markdown with latex", () => {
    it("returns false for a latex-only block", () => {
      expect(containsMarkdownBlock("[latex]x^2[/latex]")).toBe(false)
    })

    it("returns false when a markdown opening is closed by a latex closing tag", () => {
      expect(containsMarkdownBlock("[markdown]x[/latex]")).toBe(false)
    })

    it("returns true for the markdown block in mixed latex + markdown text", () => {
      expect(containsMarkdownBlock("[latex]x^2[/latex] and [markdown]**b**[/markdown]")).toBe(true)
    })
  })

  it("is stateless across repeated calls on the same input", () => {
    const input = "[markdown]x[/markdown]"
    expect(containsMarkdownBlock(input)).toBe(true)
    expect(containsMarkdownBlock(input)).toBe(true)
    expect(containsMarkdownBlock(input)).toBe(true)
  })
})
