import { __experimentalGetCoreBlocks, registerCoreBlocks } from "@wordpress/block-library"
import {
  getBlockType,
  registerBlockType,
  registerBlockVariation,
  setCategories,
  unregisterBlockVariation,
} from "@wordpress/blocks"
import { addFilter } from "@wordpress/hooks"

import type { BlockConfiguration, BlockVariation } from "@/utils/Gutenberg/types"

import {
  blockTypeMapForFrontPages,
  blockTypeMapForPages,
  blockTypeMapForResearchConsentForm,
  blockTypeMapForTopLevelPages,
} from "../../blocks"
import {
  allowedBlockVariants,
  coreBlocksToRegister,
  supportedCoreBlocks,
} from "../../blocks/supportedGutenbergBlocks"
import { registerEditorAiAbilities } from "../../utils/Gutenberg/ai/abilities"
import {
  modifyCodeBlockAttributes,
  modifyEmbedBlockAttributes,
  modifyImageBlockAttributes,
} from "../../utils/Gutenberg/modifyBlockAttributes"
import { modifyBlockButton } from "../../utils/Gutenberg/modifyBlockButton"
import { modifyGutenbergCategories } from "../../utils/Gutenberg/modifyGutenbergCategories"
import { registerBlockVariations } from "../../utils/Gutenberg/registerBlockVariations"
import withCodeLanguageControls from "../../utils/Gutenberg/withCodeLanguageControls"
import withMentimeterInspector from "../../utils/Gutenberg/withMentimeterInspector"
import withParagraphAiToolbarAction from "../../utils/Gutenberg/withParagraphAiToolbarAction"

// oxlint-disable-next-line typescript/no-explicit-any
type CustomBlockDefinition = [string, BlockConfiguration<Record<string, any>>]

interface StandaloneGutenbergBootstrapOptions {
  customBlocks?: CustomBlockDefinition[] | undefined
  allowedBlockVariations?: Record<string, string[]> | undefined
}

const customBlockRegistry = new Map<string, CustomBlockDefinition[1]>(
  [
    ...blockTypeMapForPages,
    ...blockTypeMapForFrontPages,
    ...blockTypeMapForTopLevelPages,
    ...blockTypeMapForResearchConsentForm,
  ].map(([blockName, blockSettings]) => [blockName, blockSettings]),
)

let hasBootstrappedStandaloneGutenberg = false
const defaultAllowedBlockVariations = new Map<string, BlockVariation[]>()

/**
 * Registers every known custom block, plus any an editor brings along itself.
 *
 * Additive on purpose: the block registry is a single global store shared by every editor on the
 * page, so restricting what one editor may insert is the job of its `allowedBlockTypes` setting,
 * not of unregistering block types other editors and stored content still need.
 */
const registerCustomBlocks = (customBlocks?: CustomBlockDefinition[]): void => {
  customBlocks?.forEach(([blockName, blockSettings]) => {
    customBlockRegistry.set(blockName, blockSettings)
  })

  customBlockRegistry.forEach((blockSettings, blockName) => {
    if (!getBlockType(blockName)) {
      registerBlockType(blockName, blockSettings as Parameters<typeof registerBlockType>[1])
    }
  })
}

const registerSupportedCoreBlocks = (): void => {
  const wantedBlockNames = new Set(coreBlocksToRegister)
  const availableCoreBlocks: { name: string }[] = __experimentalGetCoreBlocks()
  const blocksToRegister = availableCoreBlocks.filter((block) => wantedBlockNames.has(block.name))

  const unavailableBlockNames = coreBlocksToRegister.filter(
    (blockName) => !blocksToRegister.some((block) => block.name === blockName),
  )
  if (unavailableBlockNames.length > 0) {
    console.warn(
      `@wordpress/block-library no longer ships these configured core blocks: ${unavailableBlockNames.join(", ")}`,
    )
  }

  registerCoreBlocks(blocksToRegister)
}

const captureDefaultBlockVariations = (): void => {
  for (const blockName of Object.keys(allowedBlockVariants)) {
    defaultAllowedBlockVariations.set(blockName, [...(getBlockType(blockName)?.variations ?? [])])
  }
}

const syncAllowedBlockVariations = (allowedBlockVariations?: Record<string, string[]>): void => {
  defaultAllowedBlockVariations.forEach((defaultVariations, blockName) => {
    const currentVariations = [...(getBlockType(blockName)?.variations ?? [])]
    const currentVariationNames = new Set(currentVariations.map((variation) => variation.name))

    defaultVariations.forEach((variation) => {
      if (!currentVariationNames.has(variation.name)) {
        registerBlockVariation(blockName, variation)
      }
    })

    const allowedVariations = allowedBlockVariations?.[blockName]
    if (!allowedVariations) {
      return
    }

    const syncedVariations = [...(getBlockType(blockName)?.variations ?? [])]

    syncedVariations.forEach((variation) => {
      if (!allowedVariations.includes(variation.name)) {
        unregisterBlockVariation(blockName, variation.name)
      }
    })
  })
}

export const ensureStandaloneGutenbergBootstrap = (
  options: StandaloneGutenbergBootstrapOptions = {},
): void => {
  if (typeof window === "undefined") {
    return
  }

  if (!hasBootstrappedStandaloneGutenberg) {
    // core/image expects a wp global to exist, and null satisfies its existing checks.
    // @ts-expect-error: setting a global used by Gutenberg internals
    window.wp = null

    addFilter(
      "blocks.registerBlockType",
      "moocfi/modifyImageAttributes",
      modifyImageBlockAttributes,
    )
    addFilter(
      "blocks.registerBlockType",
      "moocfi/modifyEmbedAttributes",
      modifyEmbedBlockAttributes,
    )
    addFilter("blocks.registerBlockType", "moocfi/modifyCodeAttributes", modifyCodeBlockAttributes)
    addFilter("editor.BlockEdit", "moocfi/cms/mentiMeterInspector", withMentimeterInspector)
    addFilter("editor.BlockEdit", "moocfi/cms/codeLanguageControls", withCodeLanguageControls)
    addFilter("editor.BlockEdit", "moocfi/cms/paragraphAiToolbar", withParagraphAiToolbarAction)

    registerEditorAiAbilities()
    registerSupportedCoreBlocks()

    setCategories(modifyGutenbergCategories())
    registerBlockVariations()
    captureDefaultBlockVariations()
    modifyBlockButton()

    hasBootstrappedStandaloneGutenberg = true
  }

  syncAllowedBlockVariations(options.allowedBlockVariations)
  registerCustomBlocks(options.customBlocks)
}

/** Block types an editor may insert when it does not specify an allow list of its own. */
export const getDefaultAllowedBlockTypes = (): string[] => {
  return [...supportedCoreBlocks]
}
