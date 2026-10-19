import type { HeadingAnchorBlock } from "../headingAnchors"
import {
  buildHeadingAnchorIds,
  headingAnchorIdPart,
  headingTextFromHtml,
  slugifyHeadingText,
} from "../headingAnchors"

const heading = (
  clientId: string,
  content: string,
  anchor?: string,
  innerBlocks: HeadingAnchorBlock[] = [],
): HeadingAnchorBlock => ({
  name: "core/heading",
  clientId,
  attributes: { content, level: 2, ...(anchor === undefined ? {} : { anchor }) },
  innerBlocks,
})

const columns = (clientId: string, innerBlocks: HeadingAnchorBlock[]): HeadingAnchorBlock => ({
  name: "core/columns",
  clientId,
  attributes: {},
  innerBlocks,
})

const CLIENT_ID_A = "3f2b8c1a-0000-4000-8000-000000000000"
const CLIENT_ID_B = "9a7d4e2b-0000-4000-8000-000000000000"

describe("headingAnchors", () => {
  describe("headingTextFromHtml", () => {
    it("strips inline markup", () => {
      expect(headingTextFromHtml("When <em>connection</em> is opened")).toBe(
        "When connection is opened",
      )
    })

    it("decodes named and numeric entities", () => {
      expect(headingTextFromHtml("Cats &amp; dogs")).toBe("Cats & dogs")
      expect(headingTextFromHtml("Caf&#233;")).toBe("Café")
      expect(headingTextFromHtml("Caf&#xe9;")).toBe("Café")
    })

    it("leaves unknown entities alone rather than mangling them", () => {
      expect(headingTextFromHtml("A &notanentity; B")).toBe("A &notanentity; B")
      expect(headingTextFromHtml("A &#abc; B")).toBe("A &#abc; B")
      expect(headingTextFromHtml("A &#99999999; B")).toBe("A &#99999999; B")
    })

    it("does not glue words together when a tag separates them", () => {
      expect(headingTextFromHtml("one<br>two")).toBe("one two")
    })

    it("returns an empty string for missing content", () => {
      expect(headingTextFromHtml(undefined)).toBe("")
    })
  })

  describe("slugifyHeadingText", () => {
    it("lowercases and hyphenates", () => {
      expect(slugifyHeadingText("When connection is opened")).toBe("when-connection-is-opened")
    })

    it("folds Finnish and Swedish letters to ASCII", () => {
      expect(slugifyHeadingText("Yhteyden määrittely")).toBe("yhteyden-maarittely")
      expect(slugifyHeadingText("Övningar och åtgärder")).toBe("ovningar-och-atgarder")
    })

    it("spells out letters that do not decompose", () => {
      expect(slugifyHeadingText("Straße")).toBe("strasse")
      expect(slugifyHeadingText("Ønsker")).toBe("onsker")
      // Would be dropped entirely rather than folded, leaving a hole in the slug.
      expect(slugifyHeadingText("Ŋ ŧ ı")).toBe("ng-t-i")
    })

    it("keeps contractions whole instead of splitting on the apostrophe", () => {
      expect(slugifyHeadingText("Don't panic")).toBe("dont-panic")
      expect(slugifyHeadingText("Don’t panic")).toBe("dont-panic")
    })

    it("still separates on quotation marks around a word", () => {
      expect(slugifyHeadingText("Opiskelijan ’oma’ sivu")).toBe("opiskelijan-oma-sivu")
    })

    it("collapses punctuation into single separators", () => {
      expect(slugifyHeadingText("HTTP/1.1 & TLS")).toBe("http-1-1-tls")
      expect(slugifyHeadingText("  Spaced   out!  ")).toBe("spaced-out")
    })

    it("keeps original letters for scripts that have no ASCII spelling", () => {
      expect(slugifyHeadingText("Вступ до курсу")).toBe("вступ-до-курсу")
    })

    it("keeps those letters when the heading also has digits or Latin words", () => {
      expect(slugifyHeadingText("Розділ 1")).toBe("розділ-1")
      expect(slugifyHeadingText("Вступ до Python")).toBe("вступ-до-python")
      expect(slugifyHeadingText("Café і кава")).toBe("cafe-і-кава")
    })

    it("keeps the marks that other scripts spell with", () => {
      expect(slugifyHeadingText("Йога")).toBe("йога")
      expect(slugifyHeadingText("हिन्दी पाठ")).toBe("हिन्दी-पाठ")
    })

    it("folds a Latin letter written with a separate combining mark", () => {
      expect(slugifyHeadingText("Cafe\u0301")).toBe("cafe")
    })

    it("falls back when nothing usable is left", () => {
      expect(slugifyHeadingText("!!!")).toBe("heading")
      expect(slugifyHeadingText("")).toBe("heading")
    })

    it("truncates over-long headings at a word boundary", () => {
      const slug = slugifyHeadingText(
        "This heading is far too long to make a reasonable anchor out of and just keeps going",
      )
      expect(slug).toBe(
        "this-heading-is-far-too-long-to-make-a-reasonable-anchor-out-of-and-just-keeps",
      )
      expect(slug.length).toBeLessThanOrEqual(80)
    })
  })

  describe("headingAnchorIdPart", () => {
    it("reads the client id fragment an anchor starts with", () => {
      expect(headingAnchorIdPart("3f2b8c1a-when-connection-is-opened")).toBe("3f2b8c1a")
    })

    it("reads it from a whole client id too, so block anchors keep resolving", () => {
      expect(headingAnchorIdPart(CLIENT_ID_A)).toBe("3f2b8c1a")
    })

    it("reads a lengthened fragment, as used when two blocks would share one", () => {
      expect(headingAnchorIdPart("3f2b8c1affff4695-second")).toBe("3f2b8c1affff4695")
    })

    it("ignores an anchor that does not start with one", () => {
      expect(headingAnchorIdPart("when-connection-is-opened")).toBeUndefined()
      expect(headingAnchorIdPart("intro")).toBeUndefined()
      // Too short to be a client id fragment
      expect(headingAnchorIdPart("3f2b8c-slug")).toBeUndefined()
    })
  })

  describe("buildHeadingAnchorIds", () => {
    it("puts the client id fragment before the readable slug", () => {
      const ids = buildHeadingAnchorIds([heading(CLIENT_ID_A, "Getting started")])
      expect(ids.get(CLIENT_ID_A)).toBe("3f2b8c1a-getting-started")
    })

    it("prefers an author-set anchor over the generated one", () => {
      const ids = buildHeadingAnchorIds([heading(CLIENT_ID_A, "Getting started", "intro")])
      expect(ids.get(CLIENT_ID_A)).toBe("intro")
    })

    it("ignores a blank author-set anchor", () => {
      const ids = buildHeadingAnchorIds([heading(CLIENT_ID_A, "Getting started", "   ")])
      expect(ids.get(CLIENT_ID_A)).toBe("3f2b8c1a-getting-started")
    })

    it("needs no suffix for headings that share their text", () => {
      const ids = buildHeadingAnchorIds([
        heading(CLIENT_ID_A, "Summary"),
        heading(CLIENT_ID_B, "Summary"),
      ])
      expect(ids.get(CLIENT_ID_A)).toBe("3f2b8c1a-summary")
      expect(ids.get(CLIENT_ID_B)).toBe("9a7d4e2b-summary")
    })

    it("lengthens the id fragment when two blocks would share one", () => {
      const twin = "3f2b8c1a-ffff-4000-8000-000000000000"
      const ids = buildHeadingAnchorIds([heading(CLIENT_ID_A, "First"), heading(twin, "Second")])
      expect(ids.get(CLIENT_ID_A)).toBe("3f2b8c1a-first")
      expect(ids.get(twin)).toBe("3f2b8c1affff4000-second")
    })

    it("does not repeat an anchor that a duplicated block brought with it", () => {
      const ids = buildHeadingAnchorIds([
        heading(CLIENT_ID_A, "Summary", "summary"),
        heading(CLIENT_ID_B, "Summary", "summary"),
      ])
      expect(ids.get(CLIENT_ID_A)).toBe("summary")
      expect(ids.get(CLIENT_ID_B)).toBe("9a7d4e2b-summary")
    })

    it("suffixes a generated anchor that an author-set anchor already uses", () => {
      const ids = buildHeadingAnchorIds([
        heading(CLIENT_ID_A, "Getting started"),
        heading(CLIENT_ID_B, "Copied link", "3f2b8c1a-getting-started"),
      ])
      expect(ids.get(CLIENT_ID_B)).toBe("3f2b8c1a-getting-started")
      expect(ids.get(CLIENT_ID_A)).toBe("3f2b8c1a-getting-started-2")
    })

    it("walks inner blocks", () => {
      const ids = buildHeadingAnchorIds([
        heading(CLIENT_ID_A, "Top level"),
        columns("cols", [heading(CLIENT_ID_B, "Nested heading")]),
      ])
      expect(ids.get(CLIENT_ID_B)).toBe("9a7d4e2b-nested-heading")
    })

    it("skips blocks that are not headings", () => {
      const ids = buildHeadingAnchorIds([columns("cols", [])])
      expect(ids.size).toBe(0)
    })

    it("skips malformed entries and inner blocks that are not arrays", () => {
      const malformed = [
        null,
        "not a block",
        { name: "core/group", clientId: "group", attributes: {} },
        { name: "core/group", clientId: "group2", attributes: {}, innerBlocks: null },
        columns("cols", [null as unknown as HeadingAnchorBlock, heading(CLIENT_ID_B, "Nested")]),
        heading(CLIENT_ID_A, "Top level"),
      ] as unknown as HeadingAnchorBlock[]
      const ids = buildHeadingAnchorIds(malformed)
      expect(ids.get(CLIENT_ID_A)).toBe("3f2b8c1a-top-level")
      expect(ids.get(CLIENT_ID_B)).toBe("9a7d4e2b-nested")
      expect(ids.size).toBe(2)
    })

    it("keeps the id fragment when the heading is reworded, so old links still resolve", () => {
      const before = buildHeadingAnchorIds([heading(CLIENT_ID_A, "Old title")])
      const after = buildHeadingAnchorIds([heading(CLIENT_ID_A, "New title")])
      const idPart = headingAnchorIdPart(before.get(CLIENT_ID_A) ?? "")
      expect(idPart).toBeDefined()
      expect(headingAnchorIdPart(after.get(CLIENT_ID_A) ?? "")).toBe(idPart)
    })

    it("keeps anchors attached to their own heading when blocks are reordered", () => {
      const inOrder = buildHeadingAnchorIds([
        heading(CLIENT_ID_A, "Summary"),
        heading(CLIENT_ID_B, "Summary"),
      ])
      const reordered = buildHeadingAnchorIds([
        heading(CLIENT_ID_B, "Summary"),
        heading(CLIENT_ID_A, "Summary"),
      ])
      expect(reordered.get(CLIENT_ID_A)).toBe(inOrder.get(CLIENT_ID_A))
      expect(reordered.get(CLIENT_ID_B)).toBe(inOrder.get(CLIENT_ID_B))
    })
  })
})
