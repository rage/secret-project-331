import { citationDisplayNumber, planCitationPortals } from "../chatbotCitationPortals"

describe("chatbotCitationPortals", () => {
  describe("citationDisplayNumber", () => {
    const citationNumberingMap = new Map<number, number>([
      [3, 1],
      [13, 2],
    ])

    it("returns the renumbered display value for a known citation number", () => {
      expect(citationDisplayNumber(3, citationNumberingMap)).toBe(1)
      expect(citationDisplayNumber(13, citationNumberingMap)).toBe(2)
    })

    it("returns null for a citation number that is not in the map (hallucinated)", () => {
      expect(citationDisplayNumber(0, citationNumberingMap)).toBeNull()
    })

    it("returns null when data-citation-n was missing/unparseable (the map has no NaN key)", () => {
      expect(citationDisplayNumber(NaN, citationNumberingMap)).toBeNull()
    })
  })

  describe("planCitationPortals", () => {
    // Builds a DOM fragment mimicking sanitized chatbot markdown: one citation placeholder
    // span per 【x:y†source】 marker (carrying data-citation-n="y"). When `adjacent` is false,
    // a text node is inserted between placeholders, mirroring markers separated by prose.
    const buildNodes = (rawCitNs: number[], { adjacent = false } = {}): Element[] => {
      const container = document.createElement("div")
      rawCitNs.forEach((n, i) => {
        if (i > 0 && !adjacent) {
          container.appendChild(document.createTextNode(" some text "))
        }
        const span = document.createElement("span")
        span.setAttribute("data-chatbot-citation", "true")
        span.setAttribute("data-citation-n", String(n))
        container.appendChild(span)
      })
      return Array.from(container.querySelectorAll<Element>("[data-chatbot-citation='true']"))
    }

    it("renders one button per citation, in order, on the happy path", () => {
      const citationNumberingMap = new Map<number, number>([
        [3, 1],
        [12, 2],
        [5, 3],
      ])
      const nodes = buildNodes([3, 12, 5])
      expect(planCitationPortals(nodes, citationNumberingMap)).toStrictEqual([
        { rawCitN: 3, citN: 1 },
        { rawCitN: 12, citN: 2 },
        { rawCitN: 5, citN: 3 },
      ])
    })

    it("drops a marker that references a non-existent citation without throwing", () => {
      // Regression for the crash: 【10:0†source】【10:3†source】【10:13†source】 where citation 0
      // does not exist. The extra placeholder used to misalign positional indexing and throw
      // "Value cannot be null or undefined." when the references were expanded.
      const citationNumberingMap = new Map<number, number>([
        [3, 1],
        [13, 2],
      ])
      const nodes = buildNodes([0, 3, 13])
      expect(() => planCitationPortals(nodes, citationNumberingMap)).not.toThrow()
      expect(planCitationPortals(nodes, citationNumberingMap)).toStrictEqual([
        null,
        { rawCitN: 3, citN: 1 },
        { rawCitN: 13, citN: 2 },
      ])
    })

    it("collapses consecutive citations to the same document into a single button", () => {
      // citations 3 and 7 share a document, so both renumber to display number 1.
      const citationNumberingMap = new Map<number, number>([
        [3, 1],
        [7, 1],
      ])
      const nodes = buildNodes([3, 7], { adjacent: true })
      expect(planCitationPortals(nodes, citationNumberingMap)).toStrictEqual([
        { rawCitN: 3, citN: 1 },
        null,
      ])
    })

    it("does not collapse same-document citations separated by other content", () => {
      const citationNumberingMap = new Map<number, number>([
        [3, 1],
        [7, 1],
      ])
      const nodes = buildNodes([3, 7]) // text node between the two placeholders
      expect(planCitationPortals(nodes, citationNumberingMap)).toStrictEqual([
        { rawCitN: 3, citN: 1 },
        { rawCitN: 7, citN: 1 },
      ])
    })

    it("keeps both real citations when a hallucinated marker sits between them", () => {
      // 【x:3†source】【x:0†source】【x:7†source】 with 3 and 7 sharing a document. The dropped
      // middle placeholder breaks adjacency, so both real citations still render.
      const citationNumberingMap = new Map<number, number>([
        [3, 1],
        [7, 1],
      ])
      const nodes = buildNodes([3, 0, 7], { adjacent: true })
      expect(planCitationPortals(nodes, citationNumberingMap)).toStrictEqual([
        { rawCitN: 3, citN: 1 },
        null,
        { rawCitN: 7, citN: 1 },
      ])
    })
  })
})
