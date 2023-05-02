/* eslint-disable i18next/no-literal-string */
import { BlockInstance, getBlockType } from "@wordpress/blocks"
import { produce } from "immer"

const ENABLED_BLOCKS = ["moocfi/aside", "moocfi/infobox"]

/** This migrates deprecated block attributes to the current format.  */
export default function runMigrationsAndValidations(
  content: BlockInstance[],
): [BlockInstance[], number] {
  let numberOfBlocksMigrated = 0
  // Gutenberg validates blocks and runs migrations only when it parses the block from their HTML form.

  // TODO: For now only implemented for our own custom blocks that need it, further testing required before enabling for other blocks.
  // Also, gutenberg will also run migrations on blocks that are not valid, should figure out how to handle that.
  // Should also migrate innerblocks in the future.
  const newContent = produce(content, (draftContent) => {
    for (const block of draftContent) {
      if (ENABLED_BLOCKS.indexOf(block.name) === -1) {
        continue
      }
      let blockMigrated = false
      const blockDefinition = getBlockType(block.name)
      if (!blockDefinition || !blockDefinition.deprecated) {
        continue
      }
      for (const blockDeprecation of blockDefinition.deprecated) {
        if (
          !blockDeprecation.migrate ||
          !blockDeprecation.isEligible ||
          !blockDeprecation.isEligible(block.attributes, block.innerBlocks)
        ) {
          continue
        }
        console.info(`Migrating deprecated block ${block.name}`)
        const migrationResult = blockDeprecation.migrate(block.attributes, block.innerBlocks)
        blockMigrated = true

        if (Array.isArray(migrationResult)) {
          // migrationResult is of form [newAttributes, newInnerBlocks]
          block.attributes = migrationResult[0]
          block.innerBlocks = migrationResult[1]
        } else {
          // migrationResult is of form newAttributes
          block.attributes = migrationResult
        }
        if (blockMigrated) {
          numberOfBlocksMigrated = numberOfBlocksMigrated + 1
        }
      }
    }
  })
  return [newContent, numberOfBlocksMigrated]
}
