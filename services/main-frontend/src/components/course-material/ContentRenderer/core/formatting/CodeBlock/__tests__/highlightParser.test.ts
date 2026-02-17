import { parseHighlightedCode } from "../highlightParser"

describe("parseHighlightedCode", () => {
  describe("Basic functionality", () => {
    it("should highlight a single line with // HIGHLIGHT LINE", () => {
      const input = "const x = 1\nfoo() // HIGHLIGHT LINE\nbar()"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("const x = 1\nfoo()\nbar()")
      expect(result.highlightedLines).toEqual(new Set([2]))
    })

    it("should highlight a range with // BEGIN HIGHLIGHT and // END HIGHLIGHT", () => {
      const input = "line1\n// BEGIN HIGHLIGHT\nline2\nline3\n// END HIGHLIGHT\nline4"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("line1\nline2\nline3\nline4")
      expect(result.highlightedLines).toEqual(new Set([2, 3]))
    })

    it("should support multiple separate highlight regions", () => {
      const input =
        "a\n// BEGIN HIGHLIGHT\nb\n// END HIGHLIGHT\nc\n// BEGIN HIGHLIGHT\nd\n// END HIGHLIGHT\ne"
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
        "a // HIGHLIGHT LINE\n// BEGIN HIGHLIGHT\nb\nc\n// END HIGHLIGHT\nd // HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc\nd")
      expect(result.highlightedLines).toEqual(new Set([1, 2, 3, 4]))
    })

    it("should highlight standalone // HIGHLIGHT LINE but not standalone // BEGIN HIGHLIGHT", () => {
      const input = "// HIGHLIGHT LINE\n// BEGIN HIGHLIGHT\ncode\n// END HIGHLIGHT"
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
      const input = "// BEGIN HIGHLIGHT\n// END HIGHLIGHT"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should handle markers on otherwise empty lines", () => {
      const input = "// BEGIN HIGHLIGHT\n  \n// END HIGHLIGHT"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("  ")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })

    it("should handle consecutive highlight regions", () => {
      const input =
        "// BEGIN HIGHLIGHT\na\n// END HIGHLIGHT\n// BEGIN HIGHLIGHT\nb\n// END HIGHLIGHT"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb")
      expect(result.highlightedLines).toEqual(new Set([1, 2]))
    })

    it("should treat overlapping regions as highlight (second start extends range)", () => {
      const input =
        "// BEGIN HIGHLIGHT\na\n// BEGIN HIGHLIGHT\nb\n// END HIGHLIGHT\nc\n// END HIGHLIGHT"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc")
      expect(result.highlightedLines).toEqual(new Set([1, 2, 3]))
    })
  })

  describe("BR tags and input format", () => {
    it("should NOT recognize markers when content has <br> tags (expects pre-processed input)", () => {
      const rawGutenbergContent = "const x = 1 // HIGHLIGHT LINE<br/>const y = 2"
      const result = parseHighlightedCode(rawGutenbergContent)
      expect(result.highlightedLines.size).toBe(0)
      expect(result.cleanCode).toContain("<br/>")
    })

    it("should recognize markers after <br> tags are replaced with newlines", () => {
      const processedContent = "const x = 1 // HIGHLIGHT LINE\nconst y = 2"
      const result = parseHighlightedCode(processedContent)
      expect(result.highlightedLines.size).toBe(1)
      expect(result.highlightedLines.has(1)).toBe(true)
      expect(result.cleanCode).toBe("const x = 1\nconst y = 2")
    })
  })

  describe("Malformed input handling", () => {
    it("should highlight to end when BEGIN HIGHLIGHT has no matching end", () => {
      const input = "a\n// BEGIN HIGHLIGHT\nb\nc"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc")
      expect(result.highlightedLines).toEqual(new Set([2, 3]))
    })

    it("should ignore END HIGHLIGHT when no matching start", () => {
      const input = "a\n// END HIGHLIGHT\nb"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should handle multiple starts before single end (first range only closed)", () => {
      const input = "// BEGIN HIGHLIGHT\n// BEGIN HIGHLIGHT\na\n// END HIGHLIGHT\nb"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb")
      expect(result.highlightedLines).toEqual(new Set([1, 2]))
    })

    it("should allow nested start/end pairs", () => {
      const input =
        "// BEGIN HIGHLIGHT\na\n// BEGIN HIGHLIGHT\nb\n// END HIGHLIGHT\nc\n// END HIGHLIGHT\nd"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc\nd")
      expect(result.highlightedLines).toEqual(new Set([1, 2, 3]))
    })

    it("should accept markers with leading whitespace", () => {
      const input = "   // BEGIN HIGHLIGHT   \na\n  // END HIGHLIGHT  "
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })

    it("should not treat marker in middle of line as marker", () => {
      const input = "foo(); // HIGHLIGHT LINE; bar()"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("foo(); // HIGHLIGHT LINE; bar()")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should strip only trailing // HIGHLIGHT LINE", () => {
      const input = "// HIGHLIGHT LINE at end is valid // HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("// HIGHLIGHT LINE at end is valid")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })

    it("should not strip when no whitespace before // HIGHLIGHT LINE", () => {
      const input = "pathological// HIGHLIGHT LINE\nnext"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("pathological// HIGHLIGHT LINE\nnext")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should not match partial marker", () => {
      const input = "code // HIGHLIGHT LIN\ncode // BEGIN HIGHLIGH\ncode"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("code // HIGHLIGHT LIN\ncode // BEGIN HIGHLIGH\ncode")
      expect(result.highlightedLines.size).toBe(0)
    })
  })

  describe("Real-world scenarios", () => {
    it("should parse proposed syntax example", () => {
      const input = `const url = process.env.MONGODB_URI // HIGHLIGHT LINE

mongoose.connect(url)
// BEGIN HIGHLIGHT
.then(result => {
  console.log('connected to MongoDB')
})
.catch(error => {
  console.log('error connecting to MongoDB:', error.message)
})
// END HIGHLIGHT

module.exports = mongoose.model('Note', noteSchema) // HIGHLIGHT LINE`
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toContain("const url = process.env.MONGODB_URI")
      expect(result.cleanCode).not.toContain("// HIGHLIGHT LINE")
      expect(result.cleanCode).not.toContain("// BEGIN HIGHLIGHT")
      expect(result.cleanCode).not.toContain("// END HIGHLIGHT")
      expect(result.highlightedLines).toContain(1)
      expect(result.highlightedLines).toContain(4)
      expect(result.highlightedLines).toContain(5)
      expect(result.highlightedLines).toContain(6)
      expect(result.highlightedLines).toContain(7)
      expect(result.highlightedLines).toContain(8)
      expect(result.highlightedLines).toContain(9)
      expect(result.highlightedLines).toContain(11)
    })

    it("should strip # HIGHLIGHT LINE when at end of line (both styles supported)", () => {
      const input = "# HIGHLIGHT LINE is just a comment\nx = 1  # HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("# HIGHLIGHT LINE is just a comment\nx = 1")
      expect(result.highlightedLines).toEqual(new Set([2]))
    })

    it("should recognize both // and # markers in the same block", () => {
      const input = "a // HIGHLIGHT LINE\nb\nc  # HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc")
      expect(result.highlightedLines).toEqual(new Set([1, 3]))
    })

    it("should handle long code block", () => {
      const lines = Array.from({ length: 150 }, (_, i) =>
        i === 49 ? `line ${i + 1} // HIGHLIGHT LINE` : `line ${i + 1}`,
      )
      const input = lines.join("\n")
      const result = parseHighlightedCode(input)
      expect(result.highlightedLines).toEqual(new Set([50]))
      expect(result.cleanCode.split("\n").length).toBe(150)
    })

    it("should preserve HTML entities in code", () => {
      const input = "&lt;div&gt; // HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("&lt;div&gt;")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })
  })

  describe("Line number accuracy", () => {
    it("should use 1-indexed line numbers", () => {
      const input = "first // HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.highlightedLines.has(1)).toBe(true)
      expect(result.highlightedLines.has(0)).toBe(false)
    })

    it("should assign correct line numbers after marker removal", () => {
      const input = "a\nb\nc // HIGHLIGHT LINE\nd\ne // HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode.split("\n").length).toBe(5)
      expect(result.highlightedLines).toEqual(new Set([3, 5]))
    })

    it("should not highlight marker-only lines", () => {
      const input = "// BEGIN HIGHLIGHT\ncode\n// END HIGHLIGHT"
      const result = parseHighlightedCode(input)
      expect(result.highlightedLines).toEqual(new Set([1]))
      expect(result.cleanCode).toBe("code")
    })

    it("omits marker-only lines from cleanCode so copy matches display", () => {
      const input = "a\n// BEGIN HIGHLIGHT\nb\n// END HIGHLIGHT\nc"
      const result = parseHighlightedCode(input)
      const outputLines = result.cleanCode.split("\n")
      expect(outputLines.length).toBe(3)
      expect(outputLines[0]).toBe("a")
      expect(outputLines[1]).toBe("b")
      expect(outputLines[2]).toBe("c")
    })
  })

  describe("Hash comment style", () => {
    it("should highlight a single line with # HIGHLIGHT LINE", () => {
      const input = "x = 1\ny = 2  # HIGHLIGHT LINE\nz = 3"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("x = 1\ny = 2\nz = 3")
      expect(result.highlightedLines).toEqual(new Set([2]))
    })

    it("should highlight a range with # BEGIN HIGHLIGHT and # END HIGHLIGHT", () => {
      const input = "line1\n# BEGIN HIGHLIGHT\nline2\nline3\n# END HIGHLIGHT\nline4"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("line1\nline2\nline3\nline4")
      expect(result.highlightedLines).toEqual(new Set([2, 3]))
    })

    it("should combine single-line and range highlights with hash style", () => {
      const input =
        "a  # HIGHLIGHT LINE\n# BEGIN HIGHLIGHT\nb\nc\n# END HIGHLIGHT\nd  # HIGHLIGHT LINE"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a\nb\nc\nd")
      expect(result.highlightedLines).toEqual(new Set([1, 2, 3, 4]))
    })

    it("should accept hash markers with leading whitespace", () => {
      const input = "   # BEGIN HIGHLIGHT   \na\n  # END HIGHLIGHT  "
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("a")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })

    it("should not strip when no whitespace before # HIGHLIGHT LINE", () => {
      const input = "pathological# HIGHLIGHT LINE\nnext"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("pathological# HIGHLIGHT LINE\nnext")
      expect(result.highlightedLines.size).toBe(0)
    })

    it("should strip # HIGHLIGHT LINE and highlight", () => {
      const input = "def foo():  # HIGHLIGHT LINE\n    return 42"
      const result = parseHighlightedCode(input)
      expect(result.cleanCode).toBe("def foo():\n    return 42")
      expect(result.highlightedLines).toEqual(new Set([1]))
    })
  })
})
