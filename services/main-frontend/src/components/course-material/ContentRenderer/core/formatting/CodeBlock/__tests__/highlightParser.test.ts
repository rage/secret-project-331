import { parseHighlightedCode } from "../highlightParser"

describe("parseHighlightedCode", () => {
  describe("Basic functionality", () => {
    it("should highlight a single line with // highlight-line", () => {
      const input = "const x = 1\nfoo() // highlight-line\nbar()"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("const x = 1\nfoo()\nbar()")
      expect(result.highlightedLines).toEqual(new Set([2]))
    })

    it("should highlight a range with // highlight-start and // highlight-end", () => {
      const input = "line1\n// highlight-start\nline2\nline3\n// highlight-end\nline4"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("line1\nline2\nline3\nline4")
      expect(result.highlightedLines).toEqual(new Set([2, 3]))
    })

    it("should support multiple separate highlight regions", () => {
      const input =
        "a\n// highlight-start\nb\n// highlight-end\nc\n// highlight-start\nd\n// highlight-end\ne"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc\nd\ne")
      expect(result.highlightedLines).toEqual(new Set([2, 4]))
    })

    it("should return empty set when no markers present", () => {
      const input = "const x = 1\nconst y = 2"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("const x = 1\nconst y = 2")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should combine single-line and range highlights", () => {
      const input =
        "a // highlight-line\n// highlight-start\nb\nc\n// highlight-end\nd // highlight-line"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc\nd")
      expect(result.highlightedLines).toEqual(new Set([1, 2, 3, 4]))
    })

    it("should highlight standalone // highlight-line but not standalone // highlight-start", () => {
      const input = "// highlight-line\n// highlight-start\ncode\n// highlight-end"
      const result = parseHighlightedCode(input)
      expect(result.highlightedLines).toContain(1)
      expect(result.highlightedLines).toContain(2)
      expect(result.cleanCode).toBe("\ncode")
    })
  })

  describe("Edge cases", () => {
    it("should return empty cleanCode and empty set for empty string", () => {
      const result = parseHighlightedCode("")
      expect(result.cleanCode).toBe("")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should return empty cleanCode and empty set for null", () => {
      const result = parseHighlightedCode(null)
      expect(result.cleanCode).toBe("")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should preserve empty lines in code", () => {
      const input = "a\n\nc"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\n\nc")
      expect(result.cleanCode.split("\n").length).toBe(3)
    })

    it("should return empty cleanCode and empty set for undefined", () => {
      const result = parseHighlightedCode(undefined)
      expect(result.cleanCode).toBe("")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should preserve code with no markers unchanged", () => {
      const input = "function foo() {\n  return 42;\n}"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe(input)
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should handle only marker lines", () => {
      const input = "// highlight-start\n// highlight-end"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should handle markers on otherwise empty lines", () => {
      const input = "// highlight-start\n  \n// highlight-end"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("  ")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })

    it("should handle consecutive highlight regions", () => {
      const input =
        "// highlight-start\na\n// highlight-end\n// highlight-start\nb\n// highlight-end"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb")
      expect(result.highlightedLines).toEqual(new Set([1, 2]))
    })

    it("should treat overlapping regions as highlight (second start extends range)", () => {
      const input =
        "// highlight-start\na\n// highlight-start\nb\n// highlight-end\nc\n// highlight-end"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc")
      expect(result.highlightedLines).toEqual(new Set([1, 2, 3]))
    })
  })

  describe("BR tags and input format", () => {
    it("should NOT recognize markers when content has <br> tags (expects pre-processed input)", () => {
      const rawGutenbergContent = "const x = 1 // highlight-line<br/>const y = 2"
      const result = parseHighlightedCode(rawGutenbergContent)
      expect(result.highlightedLines.size).toBe(0)
      expect(result.cleanCode).toContain("<br/>")
    })

    it("should recognize markers after <br> tags are replaced with newlines", () => {
      const processedContent = "const x = 1 // highlight-line\nconst y = 2"
      const result = parseHighlightedCode(processedContent)
      expect(result.highlightedLines.size).toBe(1)
      expect(result.highlightedLines.has(1)).toBe(true)
      expect(result.cleanCode).toBe("const x = 1\nconst y = 2")
    })
  })

  describe("Malformed input handling", () => {
    it("should highlight to end when highlight-start has no matching end", () => {
      const input = "a\n// highlight-start\nb\nc"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc")
      expect(result.highlightedLines).toEqual(new Set([2, 3]))
    })

    it("should ignore highlight-end when no matching start", () => {
      const input = "a\n// highlight-end\nb"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should handle multiple starts before single end (first range only closed)", () => {
      const input = "// highlight-start\n// highlight-start\na\n// highlight-end\nb"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb")
      expect(result.highlightedLines).toEqual(new Set([1, 2]))
    })

    it("should allow nested start/end pairs", () => {
      const input =
        "// highlight-start\na\n// highlight-start\nb\n// highlight-end\nc\n// highlight-end\nd"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc\nd")
      expect(result.highlightedLines).toEqual(new Set([1, 2, 3]))
    })

    it("should accept markers with leading whitespace", () => {
      const input = "   // highlight-start   \na\n  // highlight-end  "
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })

    it("should not treat marker in middle of line as marker", () => {
      const input = "foo(); // highlight-line; bar()"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("foo(); // highlight-line; bar()")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should strip only trailing // highlight-line", () => {
      const input = "// highlight-line at end is valid // highlight-line"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("// highlight-line at end is valid")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })

    it("should not strip when no whitespace before // highlight-line", () => {
      const input = "pathological// highlight-line\nnext"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("pathological// highlight-line\nnext")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should not match partial marker", () => {
      const input = "code // highlight-lin\ncode // highlight-start\ncode"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("code // highlight-lin\ncode // highlight-start\ncode")
      expect(result.highlightedLines.size).toBe(0)
    })
  })

  describe("Real-world scenarios", () => {
    it("should parse proposed syntax example", () => {
      const input = `const url = process.env.MONGODB_URI // highlight-line

mongoose.connect(url)
// highlight-start
.then(result => {
  console.log('connected to MongoDB')
})
.catch(error => {
  console.log('error connecting to MongoDB:', error.message)
})
// highlight-end

module.exports = mongoose.model('Note', noteSchema) // highlight-line`
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toContain("const url = process.env.MONGODB_URI")
      expect(result.cleanCode).not.toContain("// highlight-line")
      expect(result.cleanCode).not.toContain("// highlight-start")
      expect(result.cleanCode).not.toContain("// highlight-end")
      expect(result.highlightedLines).toContain(1)
      expect(result.highlightedLines).toContain(4)
      expect(result.highlightedLines).toContain(5)
      expect(result.highlightedLines).toContain(6)
      expect(result.highlightedLines).toContain(7)
      expect(result.highlightedLines).toContain(8)
      expect(result.highlightedLines).toContain(9)
      expect(result.highlightedLines).toContain(11)
    })

    it("should preserve Python-style comments without treating as markers", () => {
      const input = "# highlight-line is just a comment\nx = 1  # highlight-line"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("# highlight-line is just a comment\nx = 1  # highlight-line")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should handle long code block", () => {
      const lines = Array.from({ length: 150 }, (_, i) =>
        i === 49 ? `line ${i + 1} // highlight-line` : `line ${i + 1}`,
      )
      const input = lines.join("\n")
      const result = parseHighlightedCode(input)
      expect(result.highlightedLines).toEqual(new Set([50]))
      expect(result.cleanCode.split("\n").length).toBe(150)
    })

    it("should preserve HTML entities in code", () => {
      const input = "&lt;div&gt; // highlight-line"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("&lt;div&gt;")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })
  })

  describe("Line number accuracy", () => {
    it("should use 1-indexed line numbers", () => {
      const input = "first // highlight-line"
      const result = parseHighlightedCode(input)
      expect(result.highlightedLines.has(1)).toBe(true)
      expect(result.highlightedLines.has(0)).toBe(false)
    })

    it("should assign correct line numbers after marker removal", () => {
      const input = "a\nb\nc // highlight-line\nd\ne // highlight-line"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode.split("\n").length).toBe(5)
      expect(result.highlightedLines).toEqual(new Set([3, 5]))
    })

    it("should not highlight marker-only lines", () => {
      const input = "// highlight-start\ncode\n// highlight-end"
      const result = parseHighlightedCode(input)
      expect(result.highlightedLines).toEqual(new Set([1]))
      expect(result.cleanCode).toBe("code")
    })

    it("omits marker-only lines from cleanCode so copy matches display", () => {
      const input = "a\n// highlight-start\nb\n// highlight-end\nc"
      const result = parseHighlightedCode(input)
      const outputLines = result.cleanCode.split("\n")
      expect(outputLines.length).toBe(3)
      expect(outputLines[0]).toBe("a")
      expect(outputLines[1]).toBe("b")
      expect(outputLines[2]).toBe("c")
    })
  })
})
