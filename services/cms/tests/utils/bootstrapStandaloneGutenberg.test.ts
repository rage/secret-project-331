/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"

import {
  coreBlocksToRegister,
  supportedCoreBlocks,
} from "../../src/blocks/supportedGutenbergBlocks"
import type { ensureStandaloneGutenbergBootstrap } from "../../src/utils/Gutenberg/bootstrapStandaloneGutenberg"

interface MockBlockVariation {
  name: string
}

interface MockBlockType {
  name: string
  variations: MockBlockVariation[]
}

interface MockCoreBlockModule {
  name: string
  init: () => void
}

type CustomBlockDefinition = NonNullable<
  NonNullable<Parameters<typeof ensureStandaloneGutenbergBootstrap>[0]>["customBlocks"]
>[number]

/**
 * Core blocks the installed @wordpress/block-library ships and `registerCoreBlocks()` would register
 * bare. The first group needs @wordpress/core-data and WordPress REST endpoints this app has no
 * server for; the rest are simply blocks no editor here offers.
 */
const UNSUPPORTED_CORE_BLOCKS = [
  "core/query",
  "core/post-template",
  "core/post-title",
  "core/post-content",
  "core/comments",
  "core/comment-template",
  "core/comments-pagination",
  "core/navigation",
  "core/template-part",
  "core/site-logo",
  "core/footnotes",
  "core/breadcrumbs",
  "core/gallery",
  "core/cover",
  "core/freeform",
]

const createCustomBlockDefinition = (blockName: string): CustomBlockDefinition => [
  blockName,
  {
    title: blockName,
    category: "moocfi",
    attributes: {},
    save: () => null,
  } as CustomBlockDefinition[1],
]

const CUSTOM_BLOCKS_FOR_PAGES = ["moocfi/aside", "moocfi/exercise"].map((blockName) =>
  createCustomBlockDefinition(blockName),
)
const CUSTOM_BLOCKS_FOR_RESEARCH_CONSENT_FORM = ["moocfi/research-consent-question"].map(
  (blockName) => createCustomBlockDefinition(blockName),
)

const getVariationNames = (blockTypes: Map<string, MockBlockType>, blockName: string): string[] => {
  return (blockTypes.get(blockName)?.variations ?? []).map((variation) => variation.name)
}

interface BootstrapHarnessOptions {
  /** Stands in for the inventory `__experimentalGetCoreBlocks()` finds in the installed package. */
  availableCoreBlockNames?: string[]
  blockTypes?: Map<string, MockBlockType>
  customBlocksForPages?: CustomBlockDefinition[]
  customBlocksForResearchConsentForm?: CustomBlockDefinition[]
  registerBlockVariation?: (blockName: string, variation: MockBlockVariation) => void
  unregisterBlockVariation?: (blockName: string, variationName: string) => void
}

const loadBootstrapModule = async ({
  availableCoreBlockNames = [...coreBlocksToRegister, ...UNSUPPORTED_CORE_BLOCKS],
  blockTypes = new Map<string, MockBlockType>(),
  customBlocksForPages = [],
  customBlocksForResearchConsentForm = [],
  registerBlockVariation = jest.fn(),
  unregisterBlockVariation = jest.fn(),
}: BootstrapHarnessOptions = {}) => {
  const registerBlockType = jest.fn((blockName: string) => {
    blockTypes.set(blockName, { name: blockName, variations: [] })
  })
  const unregisterBlockType = jest.fn((blockName: string) => {
    blockTypes.delete(blockName)
  })
  const coreBlockModules: MockCoreBlockModule[] = availableCoreBlockNames.map((blockName) => ({
    name: blockName,
    init: () => {
      // Gutenberg keeps the first registration of a name, so seeded block types survive.
      if (!blockTypes.has(blockName)) {
        blockTypes.set(blockName, { name: blockName, variations: [] })
      }
    },
  }))
  const registerCoreBlocks = jest.fn((blocks: MockCoreBlockModule[]) => {
    blocks.forEach((block) => block.init())
  })

  await jest.unstable_mockModule("@wordpress/block-library", () => ({
    __experimentalGetCoreBlocks: jest.fn(() => coreBlockModules),
    registerCoreBlocks,
  }))
  await jest.unstable_mockModule("@wordpress/blocks", () => ({
    getBlockType: jest.fn((blockName: string) => blockTypes.get(blockName)),
    getBlockTypes: jest.fn(() => Array.from(blockTypes.values())),
    registerBlockType,
    registerBlockVariation,
    setCategories: jest.fn(),
    unregisterBlockType,
    unregisterBlockVariation,
  }))
  await jest.unstable_mockModule("@wordpress/hooks", () => ({
    addFilter: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/blocks", () => ({
    blockTypeMapForFrontPages: [],
    blockTypeMapForPages: customBlocksForPages,
    blockTypeMapForResearchConsentForm: customBlocksForResearchConsentForm,
    blockTypeMapForTopLevelPages: [],
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/ai/abilities", () => ({
    registerEditorAiAbilities: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/modifyBlockAttributes", () => ({
    modifyCodeBlockAttributes: jest.fn((settings: unknown) => settings),
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
  await jest.unstable_mockModule("../../src/utils/Gutenberg/withCodeLanguageControls", () => ({
    __esModule: true,
    default: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/withMentimeterInspector", () => ({
    __esModule: true,
    default: jest.fn(),
  }))
  await jest.unstable_mockModule("../../src/utils/Gutenberg/withParagraphAiToolbarAction", () => ({
    __esModule: true,
    default: jest.fn(),
  }))

  const bootstrapModule = await import("../../src/utils/Gutenberg/bootstrapStandaloneGutenberg")

  return {
    ...bootstrapModule,
    blockTypes,
    registerBlockType,
    unregisterBlockType,
    registerCoreBlocks,
  }
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

    const { ensureStandaloneGutenbergBootstrap } = await loadBootstrapModule({
      blockTypes,
      registerBlockVariation,
      unregisterBlockVariation,
    })
    const allowedBlockVariations = { "core/embed": ["youtube", "mentimeter"] }

    ensureStandaloneGutenbergBootstrap({ allowedBlockVariations })
    expect(getVariationNames(blockTypes, "core/embed")).toEqual(["youtube", "mentimeter"])

    unregisterBlockVariation.mockClear()

    ensureStandaloneGutenbergBootstrap({ allowedBlockVariations })
    expect(getVariationNames(blockTypes, "core/embed")).toEqual(["youtube", "mentimeter"])
    expect(unregisterBlockVariation).toHaveBeenCalledWith("core/embed", "twitter")
    expect(unregisterBlockVariation).toHaveBeenCalledWith("core/embed", "thinglink")
  })

  it("keeps custom blocks registered when an editor bootstraps without customBlocks", async () => {
    const { ensureStandaloneGutenbergBootstrap, blockTypes, unregisterBlockType } =
      await loadBootstrapModule({
        customBlocksForPages: CUSTOM_BLOCKS_FOR_PAGES,
        customBlocksForResearchConsentForm: CUSTOM_BLOCKS_FOR_RESEARCH_CONSENT_FORM,
      })

    ensureStandaloneGutenbergBootstrap({ customBlocks: CUSTOM_BLOCKS_FOR_PAGES })
    // An editor such as the peer review one, which brings no blocks and no allow list of its own.
    ensureStandaloneGutenbergBootstrap()

    expect(blockTypes.has("moocfi/aside")).toBe(true)
    expect(blockTypes.has("moocfi/exercise")).toBe(true)
    expect(blockTypes.has("moocfi/research-consent-question")).toBe(true)
    expect(unregisterBlockType).not.toHaveBeenCalled()
  })

  it("keeps custom blocks registered when another editor bootstraps with a narrower set", async () => {
    const { ensureStandaloneGutenbergBootstrap, blockTypes, unregisterBlockType } =
      await loadBootstrapModule({
        customBlocksForPages: CUSTOM_BLOCKS_FOR_PAGES,
        customBlocksForResearchConsentForm: CUSTOM_BLOCKS_FOR_RESEARCH_CONSENT_FORM,
      })

    ensureStandaloneGutenbergBootstrap({ customBlocks: CUSTOM_BLOCKS_FOR_PAGES })
    ensureStandaloneGutenbergBootstrap({
      customBlocks: CUSTOM_BLOCKS_FOR_RESEARCH_CONSENT_FORM,
    })

    expect(blockTypes.has("moocfi/aside")).toBe(true)
    expect(blockTypes.has("moocfi/exercise")).toBe(true)
    expect(blockTypes.has("moocfi/research-consent-question")).toBe(true)
    expect(unregisterBlockType).not.toHaveBeenCalled()
  })

  it("registers custom blocks an editor brings along that no static block map lists", async () => {
    const editorOnlyBlocks = ["moocfi/editor-only"].map((blockName) =>
      createCustomBlockDefinition(blockName),
    )
    const { ensureStandaloneGutenbergBootstrap, blockTypes } = await loadBootstrapModule({
      customBlocksForPages: CUSTOM_BLOCKS_FOR_PAGES,
    })

    ensureStandaloneGutenbergBootstrap({ customBlocks: editorOnlyBlocks })

    expect(blockTypes.has("moocfi/editor-only")).toBe(true)
    expect(blockTypes.has("moocfi/aside")).toBe(true)
  })

  it("registers only the core blocks this app supports", async () => {
    const { ensureStandaloneGutenbergBootstrap, blockTypes, registerCoreBlocks } =
      await loadBootstrapModule()

    ensureStandaloneGutenbergBootstrap()

    expect(registerCoreBlocks).toHaveBeenCalledTimes(1)
    const registeredNames = (registerCoreBlocks.mock.calls[0]?.[0] ?? []).map((block) => block.name)
    expect(registeredNames.toSorted()).toEqual(coreBlocksToRegister.toSorted())

    for (const blockName of UNSUPPORTED_CORE_BLOCKS) {
      expect(blockTypes.has(blockName)).toBe(false)
    }
  })

  it("warns when block-library stops shipping a configured core block", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    const droppedUpstream = "core/table"
    const { ensureStandaloneGutenbergBootstrap, blockTypes } = await loadBootstrapModule({
      availableCoreBlockNames: coreBlocksToRegister.filter(
        (blockName) => blockName !== droppedUpstream,
      ),
    })

    ensureStandaloneGutenbergBootstrap()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(droppedUpstream))
    expect(blockTypes.has(droppedUpstream)).toBe(false)
    expect(blockTypes.has("core/paragraph")).toBe(true)

    warn.mockRestore()
  })

  it("does not offer unsupported core blocks to editors without an allow list of their own", async () => {
    const { ensureStandaloneGutenbergBootstrap, getDefaultAllowedBlockTypes, blockTypes } =
      await loadBootstrapModule()

    ensureStandaloneGutenbergBootstrap()

    const allowedBlockTypes = getDefaultAllowedBlockTypes()
    expect(allowedBlockTypes).toEqual(supportedCoreBlocks)
    // An offered block type that nothing registered is an inserter entry that cannot be inserted.
    expect(allowedBlockTypes.filter((blockName) => !blockTypes.has(blockName))).toEqual([])
    for (const blockName of UNSUPPORTED_CORE_BLOCKS) {
      expect(allowedBlockTypes).not.toContain(blockName)
    }
  })

  it("leaves the registered block types unchanged when bootstrapped twice", async () => {
    const { ensureStandaloneGutenbergBootstrap, blockTypes, registerCoreBlocks } =
      await loadBootstrapModule({
        customBlocksForPages: CUSTOM_BLOCKS_FOR_PAGES,
        customBlocksForResearchConsentForm: CUSTOM_BLOCKS_FOR_RESEARCH_CONSENT_FORM,
      })

    ensureStandaloneGutenbergBootstrap({ customBlocks: CUSTOM_BLOCKS_FOR_PAGES })
    const afterFirstBootstrap = Array.from(blockTypes.keys()).toSorted()

    ensureStandaloneGutenbergBootstrap({ customBlocks: CUSTOM_BLOCKS_FOR_PAGES })

    expect(Array.from(blockTypes.keys()).toSorted()).toEqual(afterFirstBootstrap)
    expect(registerCoreBlocks).toHaveBeenCalledTimes(1)
  })
})
