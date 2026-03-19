import { BlockInstance, getBlockType } from "@wordpress/blocks"
import { produce } from "immer"

const ENABLED_BLOCKS = ["moocfi/aside", "moocfi/infobox"]
type MutableBlockInstance = {
  -readonly [Key in keyof BlockInstance]: BlockInstance[Key]
}

/** This migrates deprecated block attributes to the current format.  */
export default function runMigrationsAndValidations(
  content: BlockInstance[],
): [BlockInstance[], number] {
  let numberOfBlocksMigrated = 0
  // Gutenberg validates blocks and runs migrations only when it parses the block from their HTML form.

  // TODO: For now only implemented for our own custom blocks that need it, further testing required before enabling for other blocks.
  // Also, gutenberg will also run migrations on blocks that are not valid, should figure out how to handle that.
  const newContent = produce(content, (draftContent) => {
    const migrateBlockRecursively = (block: BlockInstance): void => {
      let blockMigrated = false
      const innerBlocks = block.innerBlocks ?? []

      if (ENABLED_BLOCKS.indexOf(block.name) === -1) {
        innerBlocks.forEach(migrateBlockRecursively)
        return
      }

      const blockDefinition = getBlockType(block.name)
      if (blockDefinition?.deprecated) {
        for (const blockDeprecation of blockDefinition.deprecated) {
          if (
            !blockDeprecation.migrate ||
            !blockDeprecation.isEligible ||
            !blockDeprecation.isEligible(block.attributes, innerBlocks)
          ) {
            continue
          }

          console.info(`Migrating deprecated block ${block.name}`)
          const migrationResult = blockDeprecation.migrate(block.attributes, innerBlocks)
          const mutableBlock = block as MutableBlockInstance
          blockMigrated = true

          if (Array.isArray(migrationResult)) {
            // migrationResult is of form [newAttributes, newInnerBlocks]
            mutableBlock.attributes = migrationResult[0]
            mutableBlock.innerBlocks = migrationResult[1]
          } else {
            // migrationResult is of form newAttributes
            mutableBlock.attributes = migrationResult
          }
        }
      }

      if (blockMigrated) {
        numberOfBlocksMigrated = numberOfBlocksMigrated + 1
      }

      const nestedInnerBlocks = block.innerBlocks ?? []
      nestedInnerBlocks.forEach(migrateBlockRecursively)
    }

    for (const block of draftContent) {
      migrateBlockRecursively(block)
    }
  })
  return [newContent, numberOfBlocksMigrated]
}
