import { headingAnchorIdPart, headingTextFromHtml, slugifyHeadingText } from "../headingAnchors"

const CLIENT_ID_A = "3f2b8c1a-0000-4000-8000-000000000000"

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

    it("ignores an anchor that does not start with one", () => {
      expect(headingAnchorIdPart("when-connection-is-opened")).toBeUndefined()
      expect(headingAnchorIdPart("intro")).toBeUndefined()
      // Too short to be a client id fragment
      expect(headingAnchorIdPart("3f2b8c-slug")).toBeUndefined()
    })
  })
})
