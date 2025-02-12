import { Category, getCategories } from "@wordpress/blocks"

export const MOOCFI_CATEGORY_SLUG = "moocfi"

export function modifyGutenbergCategories(): readonly Category[] {
  const categories: Category[] = getCategories()

  categories.push({ slug: MOOCFI_CATEGORY_SLUG, title: "Mooc.fi Custom Blocks" })
  return categories
}
