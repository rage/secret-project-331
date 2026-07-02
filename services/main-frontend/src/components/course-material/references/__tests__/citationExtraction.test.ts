import { extractCitationsFromText } from "@/components/course-material/ContentRenderer/util/textParsing"
import {
  extractPageCitations,
  orderedUniqueCitationKeys,
} from "@/components/course-material/references/citationExtraction"
import { Block } from "@/types/courseMaterialBlock"

const block = (
  name: string,
  attributes: unknown,
  innerBlocks: Block<unknown>[] = [],
): Block<unknown> => ({
  name,
  attributes,
  innerBlocks,
  clientId: "test-client-id",
  isValid: true,
})

const keysOf = (blocks: Block<unknown>[]) => extractPageCitations(blocks).map((c) => c.citationKey)

describe("extractCitationsFromText", () => {
  test("parses a single \\cite{key}", () => {
    expect(extractCitationsFromText("before \\cite{smith2020} after")).toEqual([
      { citationKey: "smith2020", prenote: undefined, postnote: undefined },
    ])
  })

  test("parses multiple cites in left-to-right order", () => {
    expect(
      extractCitationsFromText("\\cite{a} and \\cite{b} and \\cite{c}").map((c) => c.citationKey),
    ).toEqual(["a", "b", "c"])
  })

  test("treats a single bracket as the POSTNOTE, not the prenote", () => {
    expect(extractCitationsFromText("\\cite[pp. 5-7]{k}")).toEqual([
      { citationKey: "k", prenote: undefined, postnote: "pp. 5-7" },
    ])
  })

  test("treats two brackets as prenote then postnote", () => {
    expect(extractCitationsFromText("\\cite[see][p. 5]{k}")).toEqual([
      { citationKey: "k", prenote: "see", postnote: "p. 5" },
    ])
  })

  test("surfaces an empty key for \\cite{}", () => {
    expect(extractCitationsFromText("\\cite{}")).toEqual([
      { citationKey: "", prenote: undefined, postnote: undefined },
    ])
  })

  test("ignores a malformed \\cite without braces", () => {
    expect(extractCitationsFromText("this \\cite has no braces")).toEqual([])
  })

  test("keeps keys with spaces, dots, colons and unicode verbatim", () => {
    expect(extractCitationsFromText("\\cite{leinonen2019:exploring föö}")[0].citationKey).toBe(
      "leinonen2019:exploring föö",
    )
  })

  test("does not count a \\cite inside a [latex] block", () => {
    expect(extractCitationsFromText("[latex]\\cite{k}[/latex]")).toEqual([])
  })

  test("counts a real cite alongside a latex block", () => {
    expect(
      extractCitationsFromText("[latex]x^2[/latex] and \\cite{k}").map((c) => c.citationKey),
    ).toEqual(["k"])
  })

  test("returns [] for empty, whitespace, null and undefined input", () => {
    expect(extractCitationsFromText("")).toEqual([])
    expect(extractCitationsFromText("   ")).toEqual([])
    expect(extractCitationsFromText(null)).toEqual([])
    expect(extractCitationsFromText(undefined)).toEqual([])
  })

  test("is not affected by the global regex's shared lastIndex across calls", () => {
    // Two calls in a row must both find the citation (regression against a shared lastIndex).
    expect(extractCitationsFromText("\\cite{k}")).toHaveLength(1)
    expect(extractCitationsFromText("\\cite{k}")).toHaveLength(1)
  })
})

describe("extractPageCitations - per block field map", () => {
  test("extracts from core/paragraph content", () => {
    expect(keysOf([block("core/paragraph", { content: "hi \\cite{p}" })])).toEqual(["p"])
  })

  test("extracts from core/list-item content", () => {
    expect(keysOf([block("core/list-item", { content: "\\cite{li}" })])).toEqual(["li"])
  })

  test("extracts from old-format core/list values", () => {
    expect(
      keysOf([block("core/list", { values: "<li>\\cite{v1}</li><li>\\cite{v2}</li>" })]),
    ).toEqual(["v1", "v2"])
  })

  test("extracts from core/quote citation but NOT from value", () => {
    expect(
      keysOf([block("core/quote", { value: "\\cite{raw}", citation: "\\cite{cited}" })]),
    ).toEqual(["cited"])
  })

  test("extracts from moocfi/terminology-block title but NOT from blockName", () => {
    expect(
      keysOf([
        block("moocfi/terminology-block", { title: "\\cite{t}", blockName: "\\cite{ignored}" }),
      ]),
    ).toEqual(["t"])
  })

  test("extracts from moocfi/ingress in title-then-subtitle order", () => {
    expect(
      keysOf([block("moocfi/ingress", { title: "\\cite{a}", subtitle: "\\cite{b}" })]),
    ).toEqual(["a", "b"])
  })

  test("extracts from moocfi/highlightbox title then content", () => {
    expect(
      keysOf([block("moocfi/highlightbox", { title: "\\cite{a}", content: "\\cite{b}" })]),
    ).toEqual(["a", "b"])
  })

  test("extracts from moocfi/aside-with-image title then content", () => {
    expect(
      keysOf([block("moocfi/aside-with-image", { title: "\\cite{a}", content: "\\cite{b}" })]),
    ).toEqual(["a", "b"])
  })

  test("extracts from core/image caption", () => {
    expect(keysOf([block("core/image", { caption: "\\cite{cap}" })])).toEqual(["cap"])
  })

  test("extracts from core/table cells (head, body, foot) then caption", () => {
    const table = block("core/table", {
      head: [{ cells: [{ content: "\\cite{h}" }] }],
      body: [{ cells: [{ content: "\\cite{b1}" }, { content: "\\cite{b2}" }] }],
      foot: [{ cells: [{ content: "\\cite{f}" }] }],
      caption: "\\cite{cap}",
    })
    expect(keysOf([table])).toEqual(["h", "b1", "b2", "f", "cap"])
  })

  test("unknown block scans only top-level string attributes (not nested objects or arrays)", () => {
    const unknown = block("unknown/custom", {
      top: "\\cite{top}",
      nested: { inner: "\\cite{nested}" },
      list: ["\\cite{arr}"],
    })
    expect(keysOf([unknown])).toEqual(["top"])
  })
})

describe("extractPageCitations - tree walk", () => {
  test("descends into innerBlocks depth-first with parent text before children", () => {
    const tree = [
      block("core/paragraph", { content: "\\cite{parent}" }, [
        block("core/paragraph", { content: "\\cite{child}" }),
      ]),
      block("core/paragraph", { content: "\\cite{sibling}" }),
    ]
    expect(keysOf(tree)).toEqual(["parent", "child", "sibling"])
  })

  test("handles missing / empty innerBlocks and undefined fields without throwing", () => {
    expect(keysOf([block("core/paragraph", {})])).toEqual([])
    expect(keysOf([block("core/paragraph", { content: undefined })])).toEqual([])
    expect(() => extractPageCitations(null)).not.toThrow()
    expect(() => extractPageCitations(undefined)).not.toThrow()
    expect(extractPageCitations([])).toEqual([])
  })

  test("preserves duplicate occurrences and their prenote/postnote", () => {
    const occurrences = extractPageCitations([
      block("core/paragraph", { content: "\\cite[see][p. 5]{k} ... \\cite{k}" }),
    ])
    expect(occurrences).toEqual([
      { citationKey: "k", prenote: "see", postnote: "p. 5" },
      { citationKey: "k", prenote: undefined, postnote: undefined },
    ])
  })
})

describe("orderedUniqueCitationKeys", () => {
  test("returns unique keys in first-occurrence document order", () => {
    const tree = [
      block("core/paragraph", { content: "\\cite{b}" }),
      block("core/paragraph", { content: "\\cite{a}" }),
      block("core/paragraph", { content: "\\cite{b}" }),
    ]
    expect(orderedUniqueCitationKeys(tree)).toEqual(["b", "a"])
  })

  test("numbers a key by its first occurrence even across collapsed and open blocks", () => {
    const tree = [
      block("core/paragraph", { content: "\\cite{shared}" }),
      block("moocfi/expandable-content", {}, [
        block("moocfi/expandable-content-inner-block", { name: "Section" }, [
          block("core/paragraph", { content: "\\cite{shared} \\cite{onlyInside}" }),
        ]),
      ]),
    ]
    expect(orderedUniqueCitationKeys(tree)).toEqual(["shared", "onlyInside"])
  })

  test("drops empty keys", () => {
    expect(
      orderedUniqueCitationKeys([block("core/paragraph", { content: "\\cite{} and \\cite{k}" })]),
    ).toEqual(["k"])
  })
})

describe("regression: citation inside a collapsed expandable block", () => {
  // The exact block tree from the bug report. Before the fix this citation was never listed in the
  // references accordion because it lives inside a collapsed (unmounted) expandable block.
  const bugTree: Block<unknown>[] = [
    block("moocfi/hero-section", {
      backgroundColor: "#F5F6F7",
      fontColor: "#1A2333",
      subtitle: "",
      title: "Citations page",
    }),
    block("moocfi/expandable-content", {}, [
      block("moocfi/expandable-content-inner-block", { name: "Best sectoin" }, [
        block("core/paragraph", {
          content: "This section is the best\\cite{leinonen2019exploring}",
          dropCap: false,
        }),
      ]),
    ]),
  ]

  test("extracts the citation key from the nested expandable block", () => {
    expect(extractPageCitations(bugTree)).toHaveLength(1)
    expect(orderedUniqueCitationKeys(bugTree)).toEqual(["leinonen2019exploring"])
  })

  test("does not pick up the hero-section title as a citation", () => {
    // hero-section does not render through ParsedText, and its title has no \cite anyway.
    expect(orderedUniqueCitationKeys(bugTree)).not.toContain("Citations page")
  })
})
