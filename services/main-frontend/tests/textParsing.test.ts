import {
  findTermMatches,
  parseText,
  replaceTextNodeWithGlossarySpans,
} from "@/components/course-material/ContentRenderer/util/textParsing"
import { Term } from "@/shared-module/common/bindings"

describe("findTermMatches", () => {
  test("single match in middle of string", () => {
    expect(findTermMatches("An algorithm here", "algorithm")).toEqual([{ index: 3, length: 9 }])
  })

  test("multiple matches", () => {
    expect(findTermMatches("algorithm and algorithm", "algorithm")).toEqual([
      { index: 0, length: 9 },
      { index: 14, length: 9 },
    ])
  })

  test("no match when term is absent", () => {
    expect(findTermMatches("No match here", "algorithm")).toEqual([])
  })

  test("no match on partial word", () => {
    expect(findTermMatches("Algorithms", "algorithm")).toEqual([])
  })

  test("match at start of string", () => {
    expect(findTermMatches("algorithm runs", "algorithm")).toEqual([{ index: 0, length: 9 }])
  })

  test("match at end of string", () => {
    expect(findTermMatches("We need an algorithm", "algorithm")).toEqual([{ index: 11, length: 9 }])
  })

  test("is case-sensitive", () => {
    expect(findTermMatches("Algorithm with capital A", "algorithm")).toEqual([])
  })

  test("adjacent to punctuation matches at correct index", () => {
    expect(findTermMatches("An algorithm, or two", "algorithm")).toEqual([{ index: 3, length: 9 }])
  })

  test("empty input string returns no matches", () => {
    expect(findTermMatches("", "algorithm")).toEqual([])
  })
})

describe("replaceTextNodeWithGlossarySpans", () => {
  test("single match splits text node into text, span, text", () => {
    const doc = new DOMParser().parseFromString("<p></p>", "text/html")
    const p = doc.body.firstElementChild!
    const textNode = doc.createTextNode("An algorithm here")
    p.appendChild(textNode)
    replaceTextNodeWithGlossarySpans(doc, textNode, [{ index: 3, length: 9 }], "term-1")
    expect(p.innerHTML).toBe('An <span data-glossary-id="term-1"></span> here')
  })

  test("multiple matches produce correct sequence of text nodes and spans", () => {
    const doc = new DOMParser().parseFromString("<p></p>", "text/html")
    const p = doc.body.firstElementChild!
    const textNode = doc.createTextNode("algorithm and algorithm")
    p.appendChild(textNode)
    replaceTextNodeWithGlossarySpans(
      doc,
      textNode,
      [
        { index: 0, length: 9 },
        { index: 14, length: 9 },
      ],
      "id-a",
    )
    expect(p.innerHTML).toBe(
      '<span data-glossary-id="id-a"></span> and <span data-glossary-id="id-a"></span>',
    )
  })

  test("match at start: no leading text, starts with span", () => {
    const doc = new DOMParser().parseFromString("<p></p>", "text/html")
    const p = doc.body.firstElementChild!
    const textNode = doc.createTextNode("algorithm here")
    p.appendChild(textNode)
    replaceTextNodeWithGlossarySpans(doc, textNode, [{ index: 0, length: 9 }], "x")
    expect(p.innerHTML).toBe('<span data-glossary-id="x"></span> here')
  })

  test("match at end: no trailing text, ends with span", () => {
    const doc = new DOMParser().parseFromString("<p></p>", "text/html")
    const p = doc.body.firstElementChild!
    const textNode = doc.createTextNode("the algorithm")
    p.appendChild(textNode)
    replaceTextNodeWithGlossarySpans(doc, textNode, [{ index: 4, length: 9 }], "y")
    expect(p.innerHTML).toBe('the <span data-glossary-id="y"></span>')
  })

  test("span has correct data-glossary-id attribute value", () => {
    const doc = new DOMParser().parseFromString("<p></p>", "text/html")
    const p = doc.body.firstElementChild!
    const textNode = doc.createTextNode("word")
    p.appendChild(textNode)
    replaceTextNodeWithGlossarySpans(doc, textNode, [{ index: 0, length: 4 }], "custom-id-123")
    expect(p.querySelector("span")?.getAttribute("data-glossary-id")).toBe("custom-id-123")
  })

  test("original text node is removed from the parent", () => {
    const doc = new DOMParser().parseFromString("<p></p>", "text/html")
    const p = doc.body.firstElementChild!
    const textNode = doc.createTextNode("an algorithm")
    p.appendChild(textNode)
    replaceTextNodeWithGlossarySpans(doc, textNode, [{ index: 3, length: 9 }], "id")
    expect(p.contains(textNode)).toBe(false)
  })

  test("text with HTML-special chars is preserved and not interpreted as HTML", () => {
    const doc = new DOMParser().parseFromString("<p></p>", "text/html")
    const p = doc.body.firstElementChild!
    const textNode = doc.createTextNode("Use x<y and a&b")
    p.appendChild(textNode)
    replaceTextNodeWithGlossarySpans(doc, textNode, [{ index: 4, length: 1 }], "id")
    expect(p.querySelectorAll("span")).toHaveLength(1)
    expect(p.childNodes.length).toBe(3)
    const parts = Array.from(p.childNodes).map((n) => n.textContent ?? "")
    expect(parts[0]).toBe("Use ")
    expect(parts[1]).toBe("")
    expect(parts[2]).toBe("<y and a&b")
  })
})

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

  describe("glossary parsing", () => {
    const term: Term = {
      id: "term-1",
      term: "algorithm",
      definition: "A step-by-step procedure.",
    }

    test("wraps glossary term in span with data-glossary-id", () => {
      const { parsedText } = parseText("An algorithm solves it.", [term])
      expect(parsedText).toBe('An <span data-glossary-id="term-1"></span> solves it.')
    })

    test("returns used term in glossaryEntries", () => {
      const { parsedText, glossaryEntries } = parseText("Text with algorithm inside.", [term])
      expect(parsedText).toBe('Text with <span data-glossary-id="term-1"></span> inside.')
      expect(glossaryEntries).toHaveLength(1)
      expect(glossaryEntries[0].id).toBe("term-1")
      expect(glossaryEntries[0].term).toBe("algorithm")
    })

    test("does not match partial word", () => {
      const { parsedText } = parseText("Algorithms are many.", [term])
      expect(parsedText).toBe("Algorithms are many.")
    })

    test("does nothing when glossary option is false", () => {
      const { parsedText } = parseText("An algorithm here.", [term], {
        glossary: false,
      })
      expect(parsedText).toBe("An algorithm here.")
    })

    test("replaces same term multiple times and dedupes glossaryEntries", () => {
      const { parsedText, glossaryEntries } = parseText(
        "An algorithm here and an algorithm there.",
        [term],
      )
      expect(parsedText).toBe(
        'An <span data-glossary-id="term-1"></span> here and an <span data-glossary-id="term-1"></span> there.',
      )
      expect(glossaryEntries).toHaveLength(1)
      expect(glossaryEntries[0].id).toBe("term-1")
    })

    test("replaces two different terms in one string", () => {
      const terms: Term[] = [
        { id: "id-a", term: "algorithm", definition: "Step-by-step procedure." },
        { id: "id-b", term: "variable", definition: "Named storage." },
      ]
      const { parsedText, glossaryEntries } = parseText("An algorithm uses a variable.", terms)
      expect(parsedText).toBe(
        'An <span data-glossary-id="id-a"></span> uses a <span data-glossary-id="id-b"></span>.',
      )
      expect(glossaryEntries).toHaveLength(2)
      expect(glossaryEntries.map((t) => t.id).sort()).toEqual(["id-a", "id-b"])
    })

    test("term at start and term at end of string", () => {
      const { parsedText } = parseText("algorithm runs.", [term])
      expect(parsedText).toBe('<span data-glossary-id="term-1"></span> runs.')
      const { parsedText: endText } = parseText("We need an algorithm", [term])
      expect(endText).toBe('We need an <span data-glossary-id="term-1"></span>')
    })

    test("is case-sensitive", () => {
      const { parsedText } = parseText("Algorithm with capital A.", [term])
      expect(parsedText).toBe("Algorithm with capital A.")
    })

    test("empty glossary leaves text unchanged", () => {
      const { parsedText, glossaryEntries } = parseText("An algorithm here.", [])
      expect(parsedText).toBe("An algorithm here.")
      expect(glossaryEntries).toHaveLength(0)
    })

    test("matches term with trailing punctuation", () => {
      const { parsedText } = parseText("An algorithm, or two.", [term])
      expect(parsedText).toBe('An <span data-glossary-id="term-1"></span>, or two.')
    })

    test("first matching term wins when one term is substring of another", () => {
      const terms: Term[] = [
        { id: "loop", term: "loop", definition: "Repetition." },
        { id: "for-loop", term: "for loop", definition: "Loop construct." },
      ]
      const { parsedText } = parseText("Use a for loop here.", terms)
      expect(parsedText).toBe('Use a for <span data-glossary-id="loop"></span> here.')
    })

    test("does not replace glossary term inside link href (preserves URL)", () => {
      const input = 'See <a href="https://example.com/algorithm">documentation</a>.'
      const { parsedText } = parseText(input, [term])
      expect(parsedText).toContain('href="https://example.com/algorithm"')
    })

    test("does not replace glossary term inside link href query string", () => {
      const input = 'Search <a href="https://example.com/search?q=algorithm">results</a> here.'
      const { parsedText } = parseText(input, [term])
      expect(parsedText).toContain('href="https://example.com/search?q=algorithm"')
    })

    test("does not replace glossary term inside link href fragment", () => {
      const input = 'Jump to <a href="#algorithm">section</a> below.'
      const { parsedText } = parseText(input, [term])
      expect(parsedText).toContain('href="#algorithm"')
    })

    test("does not replace glossary term inside link title attribute", () => {
      const input = '<a href="https://example.com" title="See algorithm definition">link</a>'
      const { parsedText } = parseText(input, [term])
      expect(parsedText).toContain('title="See algorithm definition"')
    })

    test("does not replace glossary term inside abbr title attribute", () => {
      const input = 'An <abbr title="algorithm">algo</abbr> is a procedure.'
      const { parsedText } = parseText(input, [term])
      expect(parsedText).toContain('title="algorithm"')
    })
  })
})
