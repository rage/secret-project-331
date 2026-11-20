import { parseText } from "../textParsing"

describe("parseText LaTeX", () => {
  it("renders character references the rich text stores as the characters they stand for", () => {
    const { count, parsedText } = parseText(
      "[latex]a &lt; b &gt; c[/latex] and [latex]\\begin{matrix} 1 &amp; 2 \\end{matrix}[/latex]",
      [],
    )
    expect(count).toBe(2)
    expect(parsedText).not.toContain("katex-error")
    expect(parsedText).toContain("a &lt; b &gt; c")
  })
})
