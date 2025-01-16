import { BlockInstance } from "@wordpress/blocks"

import { removeUncommonSpacesFromBlocks } from "../../src/utils/Gutenberg/modifyBlocks"

describe("removeUncommonSpacesFromBlocks", () => {
  it("should replace non-breaking spaces with regular spaces in paragraph blocks", () => {
    const blocks: BlockInstance[] = [
      {
        name: "core/paragraph",
        attributes: {
          content: "Hello\u00A0World\u2003More\u3000Text",
        },
        clientId: "1",
        isValid: true,
        innerBlocks: [],
      },
    ]

    const result = removeUncommonSpacesFromBlocks(blocks)

    // Check that the result has the correct content
    expect(result[0].attributes.content).toBe("Hello World More Text")
    // Verify original wasn't modified
    expect(blocks[0].attributes.content).toBe("Hello\u00A0World\u2003More\u3000Text")
  })

  it("should handle nested blocks", () => {
    const blocks: BlockInstance[] = [
      {
        name: "core/group",
        attributes: {},
        clientId: "1",
        isValid: true,
        innerBlocks: [
          {
            name: "core/paragraph",
            attributes: {
              content: "Nested\u00A0Content",
            },
            clientId: "2",
            isValid: true,
            innerBlocks: [],
          },
        ],
      },
    ]

    const result = removeUncommonSpacesFromBlocks(blocks)

    // Check that the nested content was modified in the result
    expect(result[0].innerBlocks[0].attributes.content).toBe("Nested Content")
    // Verify original wasn't modified
    expect(blocks[0].innerBlocks[0].attributes.content).toBe("Nested\u00A0Content")
  })

  it("should ignore non-paragraph blocks", () => {
    const blocks: BlockInstance[] = [
      {
        name: "core/heading",
        attributes: {
          content: "Header\u00A0Text",
        },
        clientId: "1",
        isValid: true,
        innerBlocks: [],
      },
    ]

    const result = removeUncommonSpacesFromBlocks(blocks)

    expect(result[0].attributes.content).toBe("Header\u00A0Text")
    // Verify original wasn't modified
    expect(blocks[0].attributes.content).toBe("Header\u00A0Text")
  })

  it("should handle empty blocks array", () => {
    const blocks: BlockInstance[] = []
    const result = removeUncommonSpacesFromBlocks(blocks)
    expect(result).toEqual([])
  })
})
