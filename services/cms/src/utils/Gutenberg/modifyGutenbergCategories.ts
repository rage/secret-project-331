import { getCategories } from "@wordpress/blocks"

import type { Category } from "@/utils/Gutenberg/types"

export const MOOCFI_CATEGORY_SLUG = "moocfi"

export function modifyGutenbergCategories(): Category[] {
  const categories: Category[] = getCategories()

  categories.push({ slug: MOOCFI_CATEGORY_SLUG, title: "Mooc.fi Custom Blocks" })
  return categories
}
