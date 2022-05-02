import { BlockInstance } from "@wordpress/blocks"

/** This migrates deprecated block attributes to the current format.  */
export default function runMigrationsAndValidations(content: BlockInstance[]): BlockInstance[] {
  // Gutenberg validates blocks and runs migrations only when it parses the block from their HTML form.

  // TODO: Implement

  return content
}
