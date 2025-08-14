import { formatText, isValidText } from "../tagParser"

describe("formatText", () => {
  describe("latex parsing", () => {
    it("should parse latex tags when latex is enabled", () => {
      const input = "Here is a formula: [latex]x^2 + y^2 = z^2[/latex]"
      const result = formatText(true, false, input)

      expect(result).toContain("x^2 + y^2 = z^2")
      expect(result).toContain("katex")
      expect(result).toContain("math")
    })

    it("should not parse latex tags when latex is disabled", () => {
      const input = "Here is a formula: [latex]x^2 + y^2 = z^2[/latex]"
      const result = formatText(false, false, input)

      expect(result).toBe(input)
    })

    it("should handle inline latex mode", () => {
      const input = "Inline formula: [latex]x^2[/latex]"
      const result = formatText(true, false, input, true)

      expect(result).toContain("x^2")
      expect(result).toContain("katex")
      expect(result).toContain("math")
    })

    it("should handle display latex mode", () => {
      const input = "Display formula: [latex]x^2 + y^2 = z^2[/latex]"
      const result = formatText(true, false, input, false)

      expect(result).toContain("x^2 + y^2 = z^2")
      expect(result).toContain("katex")
      expect(result).toContain("math")
    })

    it("should handle multiple latex tags", () => {
      const input = "First: [latex]a + b[/latex] and second: [latex]c + d[/latex]"
      const result = formatText(true, false, input)

      expect(result).toContain("a + b")
      expect(result).toContain("c + d")
      expect(result).toContain("katex")
    })

    it("should handle empty latex content", () => {
      const input = "Empty: [latex][/latex]"
      const result = formatText(true, false, input)

      expect(result).toContain("katex")
    })
  })

  describe("markdown parsing", () => {
    it("should parse markdown tags when markdown is enabled", () => {
      const input = "Here is **bold** text: [markdown]**bold**[/markdown]"
      const result = formatText(false, true, input)

      expect(result).toContain("<strong>bold</strong>")
    })

    it("should not parse markdown tags when markdown is disabled", () => {
      const input = "Here is **bold** text: [markdown]**bold**[/markdown]"
      const result = formatText(false, false, input)

      expect(result).toBe(input)
    })

    it("should handle single paragraph markdown", () => {
      const input = "Text: [markdown]This is a paragraph[/markdown]"
      const result = formatText(false, true, input)

      // Should remove wrapping paragraph tags for single paragraph
      expect(result).toContain("This is a paragraph")
      expect(result).not.toContain("<p>This is a paragraph</p>")
    })

    it("should handle multiple paragraphs markdown", () => {
      const input = "Text: [markdown]First paragraph\n\nSecond paragraph[/markdown]"
      const result = formatText(false, true, input)

      // Should keep paragraph tags for multiple paragraphs
      expect(result).toContain("<p>First paragraph</p>")
      expect(result).toContain("<p>Second paragraph</p>")
    })

    it("should handle markdown formatting", () => {
      const input = "Formatting: [markdown]**bold** *italic* `code`[/markdown]"
      const result = formatText(false, true, input)

      expect(result).toContain("<strong>bold</strong>")
      expect(result).toContain("<em>italic</em>")
      expect(result).toContain("<code>code</code>")
    })

    it("should handle empty markdown content", () => {
      const input = "Empty: [markdown][/markdown]"
      const result = formatText(false, true, input)

      expect(result).toBe("Empty: ")
    })
  })

  describe("combined parsing", () => {
    it("should parse both latex and markdown when both are enabled", () => {
      const input = "Formula: [latex]x^2[/latex] and text: [markdown]**bold**[/markdown]"
      const result = formatText(true, true, input)

      expect(result).toContain("x^2")
      expect(result).toContain("katex")
      expect(result).toContain("<strong>bold</strong>")
    })

    it("should handle mixed content with both parsers", () => {
      const input = "Mixed: [markdown]**bold**[/markdown] and [latex]y = mx + b[/latex]"
      const result = formatText(true, true, input)

      expect(result).toContain("<strong>bold</strong>")
      expect(result).toContain("y = mx + b")
      expect(result).toContain("katex")
    })
  })

  describe("edge cases", () => {
    it("should handle null input", () => {
      const result = formatText(true, true, null)
      expect(result).toBe("")
    })

    it("should handle empty string input", () => {
      const result = formatText(true, true, "")
      expect(result).toBe("")
    })

    it("should handle text without any tags", () => {
      const input = "Plain text without any tags"
      const result = formatText(true, true, input)
      expect(result).toBe(input)
    })

    it("should handle malformed latex tags", () => {
      const input = "Malformed: [latex]x^2[/markdown]"
      const result = formatText(true, false, input)
      expect(result).toBe(input)
    })

    it("should handle malformed markdown tags", () => {
      const input = "Malformed: [markdown]**bold**[/latex]"
      const result = formatText(false, true, input)
      expect(result).toBe(input)
    })

    it("should handle nested tags (escape entire input)", () => {
      const input = "Nested: [latex][markdown]**bold**[/markdown][/latex]"
      const result = formatText(true, true, input)
      // Escaping leaves content unchanged here (no angle brackets/quotes outside tags)
      expect(result).toBe(input)
    })

    it("should handle tags with special characters", () => {
      const input = "Special: [latex]\\frac{a}{b}[/latex]"
      const result = formatText(true, false, input)
      expect(result).toContain("\\frac{a}{b}")
      expect(result).toContain("katex")
    })

    it("should handle markdown with raw HTML (not escaped)", () => {
      const input = 'Special: [markdown]# Heading & <script>alert("xss")</script>[/markdown]'
      const result = formatText(false, true, input)
      expect(result).toContain("<h1>Heading &amp; <script>alert(&quot;xss&quot;)</script></h1>")
    })
  })

  describe("default parameters", () => {
    it("should work with default parameters (all false)", () => {
      const input = "Text with [latex]x^2[/latex] and [markdown]**bold**[/markdown]"
      const result = formatText(false, false, input)
      expect(result).toBe(input)
    })

    it("should work with default inline parameter", () => {
      const input = "Formula: [latex]x^2[/latex]"
      const result = formatText(true, false, input)
      // Default inline should be false, so display mode
      expect(result).toContain("x^2")
      expect(result).toContain("katex")
    })
  })
})

describe("isValidText", () => {
  describe("latex validation", () => {
    it("should return true when latex is disabled", () => {
      const input = "Text with [latex]x^2[/latex]"
      const result = isValidText(false, false, input)
      expect(result).toBe(true)
    })

    it("should return true for valid latex tags", () => {
      const input = "Text with [latex]x^2[/latex]"
      const result = isValidText(true, false, input)
      expect(result).toBe(true)
    })

    it("should return false for overlapping latex tags", () => {
      const input = "[latex][latex]x^2[/latex][/latex]"
      const result = isValidText(true, false, input)
      expect(result).toBe(false)
    })
  })

  describe("markdown validation", () => {
    it("should return true when markdown is disabled", () => {
      const input = "Text with [markdown]**bold**[/markdown]"
      const result = isValidText(false, false, input)
      expect(result).toBe(true)
    })

    it("should return true for valid markdown tags", () => {
      const input = "Text with [markdown]**bold**[/markdown]"
      const result = isValidText(false, true, input)
      expect(result).toBe(true)
    })

    it("should return false for overlapping markdown tags", () => {
      const input = "[markdown][markdown]**bold**[/markdown][/markdown]"
      const result = isValidText(false, true, input)
      expect(result).toBe(false)
    })
  })

  describe("combined validation", () => {
    it("should return true for non-overlapping latex and markdown tags", () => {
      const input = "[latex]x^2[/latex] and [markdown]**bold**[/markdown]"
      const result = isValidText(true, true, input)
      expect(result).toBe(true)
    })

    it("should return false for overlapping latex and markdown tags", () => {
      const input = "[latex][markdown]**bold**[/latex][/markdown]"
      const result = isValidText(true, true, input)
      expect(result).toBe(false)
    })

    it("should return false for reverse overlapping latex and markdown tags", () => {
      const input = "[markdown][latex]x^2[/markdown][/latex]"
      const result = isValidText(true, true, input)
      expect(result).toBe(false)
    })

    it("should return true for adjacent tags", () => {
      const input = "[latex]x^2[/latex][markdown]**bold**[/markdown]"
      const result = isValidText(true, true, input)
      expect(result).toBe(true)
    })
  })

  describe("edge cases", () => {
    it("should return true for empty string", () => {
      const result = isValidText(true, true, "")
      expect(result).toBe(true)
    })

    it("should return true for text without tags", () => {
      const result = isValidText(true, true, "Plain text")
      expect(result).toBe(true)
    })

    it("should return true when both parsers are disabled", () => {
      const input = "[latex]x^2[/latex][markdown]**bold**[/markdown]"
      const result = isValidText(false, false, input)
      expect(result).toBe(true)
    })
  })
})

describe("escaping outside tags", () => {
  it("escapes raw HTML when no tags are present", () => {
    const input = "<b>Hello</b> & <i>world</i> \"quotes\" 'single'"
    const result = formatText(true, true, input)
    expect(result).toBe(
      "&lt;b&gt;Hello&lt;/b&gt; &amp; &lt;i&gt;world&lt;/i&gt; \"quotes\" 'single'",
    )
  })

  it("escapes HTML outside and renders markdown inside tags", () => {
    const input = "<i>hi</i> [markdown]**bold**[/markdown] <script>x()</script>"
    const result = formatText(false, true, input)
    expect(result).toContain("&lt;i&gt;hi&lt;/i&gt; ")
    expect(result).toContain("<strong>bold</strong>")
    expect(result).toContain(" &lt;script&gt;x()&lt;/script&gt;")
  })

  it("escapes HTML outside and renders latex inside tags", () => {
    const input = "<div>pre</div> [latex]x^2[/latex] <span>post</span>"
    const result = formatText(true, false, input, true)
    expect(result).toContain("&lt;div&gt;pre&lt;/div&gt; ")
    expect(result).toContain("x^2")
    expect(result).toContain("katex")
    expect(result).toContain(" &lt;span&gt;post&lt;/span&gt;")
  })

  it("escapes around multiple interleaved tags", () => {
    const input = "<p>A</p> [markdown]*it*[/markdown] <b>B</b> [latex]c+d[/latex] <i>C</i>"
    const result = formatText(true, true, input)
    expect(result).toContain("&lt;p&gt;A&lt;/p&gt; ")
    expect(result).toContain("<em>it</em>")
    expect(result).toContain(" &lt;b&gt;B&lt;/b&gt; ")
    expect(result).toContain("c+d")
    expect(result).toContain("katex")
    expect(result).toContain(" &lt;i&gt;C&lt;/i&gt;")
  })

  it("shows tag literally (escaped) when disabled and inner HTML is present", () => {
    const input = "X [markdown]<b>H</b>[/markdown] Y"
    const result = formatText(false, false, input)
    expect(result).toBe("X [markdown]&lt;b&gt;H&lt;/b&gt;[/markdown] Y")
  })

  it("renders raw HTML inside markdown content", () => {
    const input = "[markdown]<b>H</b>[/markdown]"
    const result = formatText(false, true, input)
    // Single paragraph is unwrapped by implementation
    expect(result).toBe("<b>H</b>")
  })

  it("properly escapes ampersands and quotes outside tags", () => {
    const input = "Text & \"quotes\" 's' [markdown]**bold**[/markdown] & more"
    const result = formatText(false, true, input)
    expect(result).toContain("Text &amp; \"quotes\" 's' ")
    expect(result).toContain("<strong>bold</strong>")
    expect(result).toContain(" &amp; more")
  })

  it("does not introduce extra spaces or drop characters at tag boundaries", () => {
    const input = "A<b>A</b>[markdown]B[/markdown]<i>C</i>"
    const result = formatText(false, true, input)
    expect(result).toBe("A&lt;b&gt;A&lt;/b&gt;B&lt;i&gt;C&lt;/i&gt;")
  })
})
