import { citationDisplayNumber } from "../shared/RenderedMessage"

describe("RenderedMessage", () => {
  describe("citationDisplayNumber", () => {
    // Regression test for the crash when a message cites a non-existent citation number,
    // e.g. 【10:0†source】. The markdown parser still produces a placeholder node for such a
    // marker, but it is filtered out of the renumbering map, so its lookup must resolve to
    // null (render no button) instead of throwing "Value cannot be null or undefined."
    const citationNumberingMap = new Map<number, number>([
      [3, 1],
      [13, 2],
    ])

    it("returns null for a citation number that is not in the map", () => {
      expect(citationDisplayNumber(0, citationNumberingMap)).toBeNull()
    })

    it("returns the renumbered display value for known citation numbers", () => {
      expect(citationDisplayNumber(3, citationNumberingMap)).toBe(1)
      expect(citationDisplayNumber(13, citationNumberingMap)).toBe(2)
    })

    it("returns null for NaN (missing or unparseable data-citation-n)", () => {
      expect(citationDisplayNumber(NaN, citationNumberingMap)).toBeNull()
    })

    it("resolves a message's raw citation order without throwing on unknown markers", () => {
      // raw numbers as they appear in 【10:0†source】【10:3†source】【10:13†source】
      const rawCitNs = [0, 3, 13]
      const resolved = rawCitNs.map((n) => citationDisplayNumber(n, citationNumberingMap))
      expect(resolved).toStrictEqual([null, 1, 2])
    })
  })
})
