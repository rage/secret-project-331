import { stripProtocolBeforePlaceholderLinks } from "../../src/utils/emailPlaceholderLinks"
import type { BlockInstance } from "../../src/utils/Gutenberg/types"

/** Shaped like @wordpress/rich-text's RichTextData: HTML in a private field, exposed via toJSON. */
class FakeRichTextData {
  #html: string
  public constructor(html: string) {
    this.#html = html
  }
  public toJSON() {
    return this.#html
  }
}

const paragraph = (content: unknown): BlockInstance =>
  ({
    name: "core/paragraph",
    clientId: "paragraph",
    isValid: true,
    attributes: { content },
    innerBlocks: [],
  }) as unknown as BlockInstance

describe("stripProtocolBeforePlaceholderLinks", () => {
  it("keeps edited rich text as its HTML", () => {
    const [block] = stripProtocolBeforePlaceholderLinks([
      paragraph(new FakeRichTextData("Hello <strong>there</strong>")),
    ])
    expect(block?.attributes.content).toBe("Hello <strong>there</strong>")
  })

  it("strips the prepended protocol from placeholder links in edited rich text", () => {
    const [block] = stripProtocolBeforePlaceholderLinks([
      paragraph(new FakeRichTextData('<a href="https://{{LINK}}">link</a>')),
    ])
    expect(block?.attributes.content).toBe('<a href="{{LINK}}">link</a>')
  })
})
