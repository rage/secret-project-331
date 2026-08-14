/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"

interface MockCategory {
  slug: string
  title: string
}

const loadModifyGutenbergCategories = async (storeCategories: MockCategory[]) => {
  await jest.unstable_mockModule("@wordpress/blocks", () => ({
    // The real selector hands out the store's own array, which is what makes mutation a bug.
    getCategories: jest.fn(() => storeCategories),
  }))

  return import("../../src/utils/Gutenberg/modifyGutenbergCategories")
}

describe("modifyGutenbergCategories", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it("appends our category into a new array without touching the store's", async () => {
    const storeCategories: MockCategory[] = [
      { slug: "text", title: "Text" },
      { slug: "media", title: "Media" },
    ]
    const { modifyGutenbergCategories, MOOCFI_CATEGORY_SLUG } =
      await loadModifyGutenbergCategories(storeCategories)

    const categories = modifyGutenbergCategories()

    expect(categories).not.toBe(storeCategories)
    expect(storeCategories.map((category) => category.slug)).toEqual(["text", "media"])
    expect(categories.map((category) => category.slug)).toEqual([
      "text",
      "media",
      MOOCFI_CATEGORY_SLUG,
    ])
  })

  it("does not duplicate our category when the store already carries it", async () => {
    const storeCategories: MockCategory[] = [
      { slug: "text", title: "Text" },
      { slug: "moocfi", title: "Mooc.fi Custom Blocks" },
    ]
    const { modifyGutenbergCategories, MOOCFI_CATEGORY_SLUG } =
      await loadModifyGutenbergCategories(storeCategories)

    const categories = modifyGutenbergCategories()

    expect(categories).not.toBe(storeCategories)
    expect(categories.map((category) => category.slug)).toEqual(["text", MOOCFI_CATEGORY_SLUG])
  })
})
