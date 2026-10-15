import { readFileSync } from "fs"
import path from "path"

const currentDir = import.meta.dirname

/**
 * `@wordpress/block-editor`'s `content.css` makes `::selection` transparent, guarded to Safari only
 * via a selector list containing an invalid compound (`_::-webkit-full-page-media, _:future, ...`),
 * which per spec voids the whole rule everywhere else. Our build strips the invalid compound instead
 * of voiding the rule, so the transparent background applies in every browser; Chromium (unlike
 * Firefox) then propagates it to descendant text, leaving selected text with no visible highlight.
 *
 * These tests pin the two halves of that fix in place: the vendor rule this guards against, and our
 * counter-rule that restores the highlight. If either disappears, the fix is either stale or broken.
 */
describe("Gutenberg editor text-selection highlight", () => {
  const vendorContentCss = readFileSync(
    path.join(
      currentDir,
      "../../../../node_modules/@wordpress/block-editor/build-style/content.css",
    ),
    "utf-8",
  )
  const ourEditorStylesScss = readFileSync(path.join(currentDir, "../editor-styles.scss"), "utf-8")

  it("still finds the Safari-only guard on @wordpress/block-editor's transparent ::selection rule", () => {
    // If this hack is gone (or no longer Safari-scoped) in a future @wordpress/block-editor release,
    // our counter-rule may no longer be needed, or may need to change to match.
    expect(vendorContentCss).toMatch(
      /_::-webkit-full-page-media,\s*_:future,[^{]*\.block-editor-block-list__layout::selection/,
    )
  })

  it("restores a non-transparent ::selection background on the block list", () => {
    const rule =
      /\.block-editor-block-list__layout::selection,\s*\n\s*\.block-editor-block-list__layout ::selection\s*\{([^}]*)\}/
    const match = ourEditorStylesScss.match(rule)
    expect(match).not.toBeNull()

    const declarations = match?.[1] ?? ""
    expect(declarations).toMatch(/background-color:\s*Highlight\s*;/)
    // Must not itself rely on the same kind of guarded selector that the build strips: a plain,
    // always-valid selector is what makes this fix immune to the underlying stripping bug.
    expect(match?.[0]).not.toMatch(/webkit-full-page-media|:future/)
  })
})
