import { containsLatexTag, containsMarkdownTag, containsRenderableTag } from "../tagBlocks"

describe("containsMarkdownTag", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
  ])("returns false for %s", (_label, input) => {
    expect(containsMarkdownTag(input)).toBe(false)
  })

  it("returns false for plain text without any tags", () => {
    expect(containsMarkdownTag("just some feedback text")).toBe(false)
  })

  it("returns true for a complete block", () => {
    expect(containsMarkdownTag("[markdown]**bold**[/markdown]")).toBe(true)
  })

  it("returns true for an opening tag on its own (block being composed)", () => {
    expect(containsMarkdownTag("[markdown]unfinished")).toBe(true)
  })

  it("returns true for a closing tag on its own (opening tag mid-edit)", () => {
    expect(containsMarkdownTag("orphaned[/markdown]")).toBe(true)
  })

  it("returns true regardless of tag order", () => {
    expect(containsMarkdownTag("[/markdown][markdown]")).toBe(true)
  })

  it("returns false while the tag is missing its closing bracket", () => {
    expect(containsMarkdownTag("[markdown")).toBe(false)
  })

  it("returns false for latex-only content", () => {
    expect(containsMarkdownTag("[latex]x^2[/latex]")).toBe(false)
  })

  it("is case-sensitive", () => {
    expect(containsMarkdownTag("[MARKDOWN]x[/MARKDOWN]")).toBe(false)
  })

  it("is stateless across repeated calls", () => {
    const input = "[markdown]x[/markdown]"
    expect(containsMarkdownTag(input)).toBe(true)
    expect(containsMarkdownTag(input)).toBe(true)
    expect(containsMarkdownTag(input)).toBe(true)
  })
})

describe("containsLatexTag", () => {
  it("returns false for plain text and markdown-only content", () => {
    expect(containsLatexTag("plain")).toBe(false)
    expect(containsLatexTag("[markdown]x[/markdown]")).toBe(false)
  })

  it("returns true for opening, closing, or complete latex tags", () => {
    expect(containsLatexTag("[latex]x^2[/latex]")).toBe(true)
    expect(containsLatexTag("[latex]unfinished")).toBe(true)
    expect(containsLatexTag("orphaned[/latex]")).toBe(true)
  })
})

describe("containsRenderableTag", () => {
  it("returns false for plain text", () => {
    expect(containsRenderableTag("just some feedback text")).toBe(false)
  })

  it("returns true for either a markdown or a latex tag", () => {
    expect(containsRenderableTag("[markdown]x[/markdown]")).toBe(true)
    expect(containsRenderableTag("[latex]x^2[/latex]")).toBe(true)
    expect(containsRenderableTag("[markdown]a[/markdown] [latex]b[/latex]")).toBe(true)
  })
})
