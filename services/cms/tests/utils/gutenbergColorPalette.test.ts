import { SETTINGS_DEFAULTS } from "@wordpress/block-editor"

import { GUTENBERG_COLOR_PALETTE } from "@/shared-module/common/styles/gutenbergColorPalette"

describe("GUTENBERG_COLOR_PALETTE", () => {
  // The validator accepts the editor's palette classes, and the renderer colours them from this.
  it("matches the palette the editor offers", () => {
    const editorPalette = Object.fromEntries(
      (SETTINGS_DEFAULTS.colors ?? []).map(({ slug, color }: { slug: string; color: string }) => [
        slug,
        color.toLowerCase(),
      ]),
    )
    const sharedPalette = Object.fromEntries(
      Object.entries(GUTENBERG_COLOR_PALETTE).map(([slug, color]) => [slug, color.toLowerCase()]),
    )
    expect(sharedPalette).toEqual(editorPalette)
  })
})
