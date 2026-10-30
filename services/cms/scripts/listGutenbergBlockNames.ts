// Must run before the @wordpress requires below, which read `window` while loading.
import "../src/utils/Gutenberg/headlessDom"
import type { BlockType } from "@/utils/Gutenberg/types"

// oxlint-disable-next-line typescript/no-require-imports
const blockLibrary = require("@wordpress/block-library")
// oxlint-disable-next-line typescript/no-require-imports
const blocks = require("@wordpress/blocks")

function main() {
  blockLibrary.registerCoreBlocks()
  const allBlockInstances: BlockType<Record<string, unknown>>[] = blocks.getBlockTypes()
  const coreBlocks = allBlockInstances.map((block) => block.name)
  console.log("Gutenberg all Core block names:")
  console.log(coreBlocks)
  const embedBlocks = blocks
    .getBlockType("core/embed")
    .variations.map((block: BlockType<Record<string, unknown>>) => block.name)
  console.log("Gutenberg all core/embed names:")
  console.log(embedBlocks)
}
main()
