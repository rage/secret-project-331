import { parseText } from "../src/components/ContentRenderer/util/textParsing"

describe("parseText", () => {
  test("Does not remove spaces in middle of sentences.", () => {
    const { parsedText } = parseText("a     a", [])
    expect(parsedText).toBe("a     a")
  })

  describe("citation parsing", () => {
    test("parses a single citation", () => {
      const { parsedText } = parseText("This is a citation\\cite{key1}.", [], { glossary: false })
      expect(parsedText).toContain('data-citation-id="key1"')
      expect(parsedText).toContain("<span")
    })

    test("parses multiple citations with different keys", () => {
      const { parsedText } = parseText(
        "First citation\\cite{key1} and second citation\\cite{key2}.",
        [],
        { glossary: false },
      )
      expect(parsedText).toContain('data-citation-id="key1"')
      expect(parsedText).toContain('data-citation-id="key2"')
    })

    test("parses multiple citations with the same key", () => {
      const { parsedText } = parseText(
        "First mention\\cite{key1} and second mention\\cite{key1}.",
        [],
        { glossary: false },
      )
      const matches = parsedText.match(/data-citation-id="key1"/g)
      expect(matches).toHaveLength(2)
    })

    test("parses citation at the beginning of text", () => {
      const { parsedText } = parseText("\\cite{key1} is at the start.", [], { glossary: false })
      expect(parsedText).toContain('data-citation-id="key1"')
    })

    test("parses citation at the end of text", () => {
      const { parsedText } = parseText("Citation at the end\\cite{key1}", [], { glossary: false })
      expect(parsedText).toContain('data-citation-id="key1"')
    })

    test("parses citations with alphanumeric keys", () => {
      const { parsedText } = parseText("Citation\\cite{key123} with numbers.", [], {
        glossary: false,
      })
      expect(parsedText).toContain('data-citation-id="key123"')
    })

    test("parses citations with underscores and hyphens in keys", () => {
      const { parsedText } = parseText("Citation\\cite{key_with-dash} with special chars.", [], {
        glossary: false,
      })
      expect(parsedText).toContain('data-citation-id="key_with-dash"')
    })

    test("parses citations with empty key", () => {
      const { parsedText } = parseText("Citation\\cite{} with empty key.", [], {
        glossary: false,
      })
      expect(parsedText).toContain('data-citation-id=""')
    })

    test("parses multiple consecutive citations", () => {
      const { parsedText } = parseText("Citations\\cite{key1}\\cite{key2} together.", [], {
        glossary: false,
      })
      expect(parsedText).toContain('data-citation-id="key1"')
      expect(parsedText).toContain('data-citation-id="key2"')
    })

    test("parses citations mixed with regular text", () => {
      const { parsedText } = parseText(
        "Some text\\cite{key1} more text\\cite{key2} and even more text.",
        [],
        { glossary: false },
      )
      expect(parsedText).toContain('data-citation-id="key1"')
      expect(parsedText).toContain('data-citation-id="key2"')
      expect(parsedText).toContain("Some text")
      expect(parsedText).toContain("more text")
    })

    test("parses citation even with double backslashes before it", () => {
      const { parsedText } = parseText("This\\\\cite{key1} has double backslashes.", [], {
        glossary: false,
      })
      expect(parsedText).toContain('data-citation-id="key1"')
    })

    test("handles text without citations", () => {
      const { parsedText } = parseText("This text has no citations.", [], { glossary: false })
      expect(parsedText).not.toContain("data-citation-id")
    })

    test("sets hasCitationsOrGlossary to true when citations are present", () => {
      const { hasCitationsOrGlossary } = parseText("Text with\\cite{key1} citation.", [], {
        glossary: false,
      })
      expect(hasCitationsOrGlossary).toBe(true)
    })

    test("sets hasCitationsOrGlossary to false when no citations are present", () => {
      const { hasCitationsOrGlossary } = parseText("Text without citations.", [], {
        glossary: false,
      })
      expect(hasCitationsOrGlossary).toBe(false)
    })

    describe("prenotes and postnotes", () => {
      test("parses citation with prenote only (explicit empty second bracket)", () => {
        const { parsedText } = parseText("Text\\cite[see][]{key1} with prenote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="see"')
        expect(parsedText).not.toContain("data-citation-postnote")
      })

      test("parses citation with postnote only (single bracket)", () => {
        const { parsedText } = parseText("Text\\cite[pp.~16-17]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="pp.&nbsp;16-17"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })

      test("parses citation with postnote only (explicit empty first bracket)", () => {
        const { parsedText } = parseText("Text\\cite[][pp.~16-17]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="pp.&nbsp;16-17"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })

      test("parses citation with both prenote and postnote", () => {
        const { parsedText } = parseText("Text\\cite[see][pp.~16-17]{key1} with both.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="see"')
        expect(parsedText).toContain('data-citation-postnote="pp.&nbsp;16-17"')
      })

      test("parses citation with empty prenote and postnote", () => {
        const { parsedText } = parseText("Text\\cite[][]{key1} with empty notes.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).not.toContain("data-citation-prenote")
        expect(parsedText).not.toContain("data-citation-postnote")
      })

      test("parses citation with prenote containing special characters", () => {
        const { parsedText } = parseText("Text\\cite[see, e.g.,][]{key1} with special chars.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="see, e.g.,"')
      })

      test("parses citation with postnote containing page ranges", () => {
        const { parsedText } = parseText("Text\\cite[][p.~12]{key1} with page.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="p.&nbsp;12"')
      })

      test("parses multiple citations with different prenotes and postnotes", () => {
        const { parsedText } = parseText(
          "First\\cite[see][p.~1]{key1} and second\\cite[cf.][pp.~2-3]{key2}.",
          [],
          { glossary: false },
        )
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="see"')
        expect(parsedText).toContain('data-citation-postnote="p.&nbsp;1"')
        expect(parsedText).toContain('data-citation-id="key2"')
        expect(parsedText).toContain('data-citation-prenote="cf."')
        expect(parsedText).toContain('data-citation-postnote="pp.&nbsp;2-3"')
      })

      test("parses citation with prenote and postnote at beginning of text", () => {
        const { parsedText } = parseText("\\cite[see][p.~1]{key1} at start.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="see"')
        expect(parsedText).toContain('data-citation-postnote="p.&nbsp;1"')
      })

      test("parses citation with prenote and postnote at end of text", () => {
        const { parsedText } = parseText("At end\\cite[see][p.~1]{key1}", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="see"')
        expect(parsedText).toContain('data-citation-postnote="p.&nbsp;1"')
      })

      test("handles prenote with quotes correctly", () => {
        const { parsedText } = parseText('Text\\cite["see"][]{key1} with quotes.', [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="&quot;see&quot;"')
      })

      test("backwards compatible: citation without brackets still works", () => {
        const { parsedText } = parseText("Text\\cite{key1} without notes.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).not.toContain("data-citation-prenote")
        expect(parsedText).not.toContain("data-citation-postnote")
      })

      test("parses single bracket as postnote (LaTeX standard)", () => {
        const { parsedText } = parseText("Text\\cite[see]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="see"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })

      test("parses single bracket with page reference as postnote", () => {
        const { parsedText } = parseText("Text\\cite[pp.~16-17]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="pp.&nbsp;16-17"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })

      test("parses single bracket with p. as postnote", () => {
        const { parsedText } = parseText("Text\\cite[p.~12]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="p.&nbsp;12"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })

      test("parses single bracket with page as postnote", () => {
        const { parsedText } = parseText("Text\\cite[page 5]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="page 5"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })

      test("parses single bracket with chapter as postnote", () => {
        const { parsedText } = parseText("Text\\cite[chap. 3]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="chap. 3"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })

      test("parses citation with cf. as prenote (explicit empty second bracket)", () => {
        const { parsedText } = parseText("Text\\cite[cf.][]{key1} with prenote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="cf."')
        expect(parsedText).not.toContain("data-citation-postnote")
      })

      test("replaces tilde with non-breaking space in prenotes", () => {
        const { parsedText } = parseText("Text\\cite[see~also][]{key1} with prenote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-prenote="see&nbsp;also"')
        expect(parsedText).not.toContain("data-citation-postnote")
      })

      test("replaces tilde with non-breaking space in postnotes", () => {
        const { parsedText } = parseText("Text\\cite[][p.~12]{key1} with postnote.", [], {
          glossary: false,
        })
        expect(parsedText).toContain('data-citation-id="key1"')
        expect(parsedText).toContain('data-citation-postnote="p.&nbsp;12"')
        expect(parsedText).not.toContain("data-citation-prenote")
      })
    })
  })
})
