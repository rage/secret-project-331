import { registerCoreBlocks } from "@wordpress/block-library"
import {
  type BlockConfiguration,
  type BlockVariation,
  getBlockType,
  getBlockTypes,
  registerBlockType,
  registerBlockVariation,
  setCategories,
  unregisterBlockType,
  unregisterBlockVariation,
} from "@wordpress/blocks"
import { addFilter } from "@wordpress/hooks"

import {
  blockTypeMapForFrontPages,
  blockTypeMapForPages,
  blockTypeMapForResearchConsentForm,
  blockTypeMapForTopLevelPages,
} from "../../blocks"
import { allowedBlockVariants } from "../../blocks/supportedGutenbergBlocks"
import { registerEditorAiAbilities } from "../../utils/Gutenberg/ai/abilities"
import {
  modifyEmbedBlockAttributes,
  modifyImageBlockAttributes,
} from "../../utils/Gutenberg/modifyBlockAttributes"
import { modifyBlockButton } from "../../utils/Gutenberg/modifyBlockButton"
import { modifyGutenbergCategories } from "../../utils/Gutenberg/modifyGutenbergCategories"
import { registerBlockVariations } from "../../utils/Gutenberg/registerBlockVariations"
import withMentimeterInspector from "../../utils/Gutenberg/withMentimeterInspector"
import withParagraphAiToolbarAction from "../../utils/Gutenberg/withParagraphAiToolbarAction"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CustomBlockDefinition = [string, BlockConfiguration<Record<string, any>>]

interface StandaloneGutenbergBootstrapOptions {
  customBlocks?: CustomBlockDefinition[]
  allowedBlockVariations?: Record<string, string[]>
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
let defaultAllowedBlockTypes: string[] = []
const defaultAllowedBlockVariations = new Map<string, BlockVariation[]>()

const syncStandaloneCustomBlocks = (customBlocks?: CustomBlockDefinition[]): void => {
  customBlocks?.forEach(([blockName, blockSettings]) => {
    customBlockRegistry.set(blockName, blockSettings)
  })

  const allowedCustomBlocks = new Set((customBlocks ?? []).map(([blockName]) => blockName))

  customBlockRegistry.forEach((blockSettings, blockName) => {
    if (!allowedCustomBlocks.has(blockName)) {
      if (getBlockType(blockName)) {
        unregisterBlockType(blockName)
      }
      return
    }

    if (!getBlockType(blockName)) {
      registerBlockType(blockName, blockSettings)
    }
  })
}

const captureDefaultBlockVariations = (): void => {
  for (const blockName of Object.keys(allowedBlockVariants)) {
    defaultAllowedBlockVariations.set(
      blockName,
      /* @ts-expect-error: type signature incorrect */
      [...(getBlockType(blockName)?.variations ?? [])],
    )
  }
}

const syncAllowedBlockVariations = (allowedBlockVariations?: Record<string, string[]>): void => {
  defaultAllowedBlockVariations.forEach((defaultVariations, blockName) => {
    const currentVariations =
      /* @ts-expect-error: type signature incorrect */
      [...(getBlockType(blockName)?.variations ?? [])]
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

    const syncedVariations =
      /* @ts-expect-error: type signature incorrect */
      [...(getBlockType(blockName)?.variations ?? [])]

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
    addFilter("editor.BlockEdit", "moocfi/cms/mentiMeterInspector", withMentimeterInspector)
    addFilter("editor.BlockEdit", "moocfi/cms/paragraphAiToolbar", withParagraphAiToolbarAction)

    registerEditorAiAbilities()
    registerCoreBlocks()

    defaultAllowedBlockTypes = getBlockTypes().map((block) => block.name)

    setCategories(modifyGutenbergCategories())
    registerBlockVariations()
    captureDefaultBlockVariations()
    modifyBlockButton()

    hasBootstrappedStandaloneGutenberg = true
  }

  syncAllowedBlockVariations(options.allowedBlockVariations)
  syncStandaloneCustomBlocks(options.customBlocks)
}

export const getDefaultAllowedBlockTypes = (): string[] => {
  return [...defaultAllowedBlockTypes]
}
