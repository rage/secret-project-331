import { BlockInstance } from "@wordpress/blocks"

import {
  modifyBlocks,
  removeUncommonSpacesFromBlocks,
} from "../../src/utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../src/utils/Gutenberg/removeUnsupportedBlockType"

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

    expect(result[0].attributes.content).toBe("Hello World More Text")
    expect(blocks[0].attributes.content).toBe("Hello\u00A0World\u2003More\u3000Text")
  })

  it("should replace non-breaking spaces in heading blocks", () => {
    const blocks: BlockInstance[] = [
      {
        name: "core/heading",
        attributes: {
          content: "Header\u00A0Text\u2003Here",
          level: 2,
        },
        clientId: "1",
        isValid: true,
        innerBlocks: [],
      },
    ]

    const result = removeUncommonSpacesFromBlocks(blocks)

    expect(result[0].attributes.content).toBe("Header Text Here")
    expect(blocks[0].attributes.content).toBe("Header\u00A0Text\u2003Here")
  })

  it("should replace non-breaking spaces in hero-section blocks", () => {
    const blocks: BlockInstance[] = [
      {
        name: "moocfi/hero-section",
        attributes: {
          title: "Main\u00A0Title\u2003Here",
          subtitle: "Sub\u00A0Title\u2003Text",
        },
        clientId: "1",
        isValid: true,
        innerBlocks: [],
      },
    ]

    const result = removeUncommonSpacesFromBlocks(blocks)

    expect(result[0].attributes.title).toBe("Main Title Here")
    expect(result[0].attributes.subtitle).toBe("Sub Title Text")
    expect(blocks[0].attributes.title).toBe("Main\u00A0Title\u2003Here")
    expect(blocks[0].attributes.subtitle).toBe("Sub\u00A0Title\u2003Text")
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

    expect(result[0].innerBlocks[0].attributes.content).toBe("Nested Content")
    expect(blocks[0].innerBlocks[0].attributes.content).toBe("Nested\u00A0Content")
  })

  it("should ignore unsupported block types", () => {
    const blocks: BlockInstance[] = [
      {
        name: "core/image",
        attributes: {
          caption: "Image\u00A0Caption",
        },
        clientId: "1",
        isValid: true,
        innerBlocks: [],
      },
    ]

    const result = removeUncommonSpacesFromBlocks(blocks)

    expect(result[0].attributes.caption).toBe("Image\u00A0Caption")
    expect(blocks[0].attributes.caption).toBe("Image\u00A0Caption")
  })

  it("should handle empty blocks array", () => {
    const blocks: BlockInstance[] = []
    const result = removeUncommonSpacesFromBlocks(blocks)
    expect(result).toEqual([])
  })
})

describe("unsupported block helpers", () => {
  it("should wrap and restore nested unsupported blocks", () => {
    const unsupportedNestedBlock: BlockInstance = {
      name: "moocfi/unsupported-nested",
      attributes: { value: "nested" },
      clientId: "nested-unsupported",
      isValid: true,
      innerBlocks: [],
    }

    const blocks: BlockInstance[] = [
      {
        name: "core/group",
        attributes: {},
        clientId: "group",
        isValid: true,
        innerBlocks: [unsupportedNestedBlock],
      },
    ]

    const modifiedBlocks = modifyBlocks(blocks, ["core/group"])

    expect(modifiedBlocks[0].innerBlocks[0].name).toBe("moocfi/unsupported-block-type")
    expect(modifiedBlocks[0].innerBlocks[0].attributes.originalBlockJson).toEqual(
      unsupportedNestedBlock,
    )
    expect(removeUnsupportedBlockType(modifiedBlocks)).toEqual(blocks)
  })

  it("should keep supported leaf blocks without innerBlocks unchanged", () => {
    const blocks = [
      {
        name: "core/paragraph",
        attributes: { content: "Leaf block" },
        clientId: "paragraph",
        isValid: true,
      },
    ] as BlockInstance[]

    expect(modifyBlocks(blocks, ["core/paragraph"])).toEqual(blocks)
    expect(removeUnsupportedBlockType(blocks)).toEqual(blocks)
  })

  it("should restore wrapped blocks when nested supported leaves omit innerBlocks", () => {
    const unsupportedLeaf = {
      name: "moocfi/unsupported-nested",
      attributes: { value: "nested" },
      clientId: "nested-unsupported",
      isValid: true,
    } as BlockInstance
    const blocks = [
      {
        name: "core/group",
        attributes: {},
        clientId: "group",
        isValid: true,
        innerBlocks: [unsupportedLeaf],
      },
    ] as BlockInstance[]

    const modifiedBlocks = modifyBlocks(blocks, ["core/group"])

    expect(modifiedBlocks[0].innerBlocks[0].name).toBe("moocfi/unsupported-block-type")
    expect(removeUnsupportedBlockType(modifiedBlocks)).toEqual(blocks)
  })
})
