import { getCategories } from "@wordpress/blocks"

import type { Category } from "@/utils/Gutenberg/types"

export const MOOCFI_CATEGORY_SLUG = "moocfi"

/**
 * Returns the Gutenberg block categories with our own category appended, for handing to
 * `setCategories`.
 *
 * `getCategories` hands out the store's own array, so this builds a new one: mutating and
 * re-dispatching the same array identity leaves `useSelect` subscribers seeing no change.
 */
export function modifyGutenbergCategories(): Category[] {
  const categories: Category[] = getCategories().filter(
    (category) => category.slug !== MOOCFI_CATEGORY_SLUG,
  )

  return [...categories, { slug: MOOCFI_CATEGORY_SLUG, title: "Mooc.fi Custom Blocks" }]
}
