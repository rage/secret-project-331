/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"

type MockBlockVariation = {
  name: string
}

type MockBlockType = {
  name: string
  variations: MockBlockVariation[]
}

const getVariationNames = (blockTypes: Map<string, MockBlockType>, blockName: string): string[] => {
  return (blockTypes.get(blockName)?.variations ?? []).map((variation) => variation.name)
}

const loadEnsureStandaloneGutenbergBootstrap = async (
  blockTypes: Map<string, MockBlockType>,
  registerBlockVariation: (blockName: string, variation: MockBlockVariation) => void,
  unregisterBlockVariation: (blockName: string, variationName: string) => void,
) => {
  await jest.unstable_mockModule("@wordpress/block-library", () => ({
    registerCoreBlocks: jest.fn(),
  }))
  await jest.unstable_mockModule("@wordpress/blocks", () => ({
    getBlockType: jest.fn((blockName: string) => blockTypes.get(blockName)),
    getBlockTypes: jest.fn(() => Array.from(blockTypes.values())),
    registerBlockType: jest.fn(),
    registerBlockVariation,
    setCategories: jest.fn(),
    unregisterBlockType: jest.fn(),
    unregisterBlockVariation,
  }))
  await jest.unstable_mockModule("@wordpress/hooks", () => ({
    addFilter: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/blocks", () => ({
    blockTypeMapForFrontPages: [],
    blockTypeMapForPages: [],
    blockTypeMapForResearchConsentForm: [],
    blockTypeMapForTopLevelPages: [],
  }))
  await jest.unstable_mockModule("../../src/blocks/supportedGutenbergBlocks", () => ({
    allowedBlockVariants: { "core/embed": ["youtube", "mentimeter"] },
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/ai/abilities", () => ({
    registerEditorAiAbilities: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/modifyBlockAttributes", () => ({
    modifyEmbedBlockAttributes: jest.fn((settings: unknown) => settings),
    modifyImageBlockAttributes: jest.fn((settings: unknown) => settings),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/modifyBlockButton", () => ({
    modifyBlockButton: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/modifyGutenbergCategories", () => ({
    modifyGutenbergCategories: jest.fn(() => []),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/registerBlockVariations", () => ({
    registerBlockVariations: jest.fn(() => {
      registerBlockVariation("core/embed", { name: "mentimeter" })
      registerBlockVariation("core/embed", { name: "thinglink" })
    }),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/withMentimeterInspector", () => ({
    __esModule: true,
    default: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/withParagraphAiToolbarAction", () => ({
    __esModule: true,
    default: jest.fn(),
  }))

  return import("../../src/utils/Gutenberg/bootstrapStandaloneGutenberg")
}

describe("ensureStandaloneGutenbergBootstrap", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    delete (window as Window & { wp?: unknown }).wp
  })

  it("keeps disallowed embed variations filtered after later bootstrap syncs", async () => {
    const blockTypes = new Map<string, MockBlockType>([
      [
        "core/embed",
        {
          name: "core/embed",
          variations: [{ name: "youtube" }, { name: "twitter" }],
        },
      ],
    ])

    const registerBlockVariation = jest.fn((blockName: string, variation: MockBlockVariation) => {
      const blockType = blockTypes.get(blockName)
      if (!blockType || blockType.variations.some((existing) => existing.name === variation.name)) {
        return
      }

      blockType.variations.push(variation)
    })
    const unregisterBlockVariation = jest.fn((blockName: string, variationName: string) => {
      const blockType = blockTypes.get(blockName)
      if (!blockType) {
        return
      }

      blockType.variations = blockType.variations.filter(
        (variation) => variation.name !== variationName,
      )
    })

    const { ensureStandaloneGutenbergBootstrap } = await loadEnsureStandaloneGutenbergBootstrap(
      blockTypes,
      registerBlockVariation,
      unregisterBlockVariation,
    )
    const allowedBlockVariations = { "core/embed": ["youtube", "mentimeter"] }

    ensureStandaloneGutenbergBootstrap({ allowedBlockVariations })
    expect(getVariationNames(blockTypes, "core/embed")).toEqual(["youtube", "mentimeter"])

    unregisterBlockVariation.mockClear()

    ensureStandaloneGutenbergBootstrap({ allowedBlockVariations })
    expect(getVariationNames(blockTypes, "core/embed")).toEqual(["youtube", "mentimeter"])
    expect(unregisterBlockVariation).toHaveBeenCalledWith("core/embed", "twitter")
    expect(unregisterBlockVariation).toHaveBeenCalledWith("core/embed", "thinglink")
  })
})
