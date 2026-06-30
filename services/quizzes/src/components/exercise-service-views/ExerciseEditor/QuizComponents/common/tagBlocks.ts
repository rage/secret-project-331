/**
 * Detects the `[markdown]…[/markdown]` and `[latex]…[/latex]` tags the feedback editor renders.
 * Presence checks (either tag, not a complete pair) so the field stays multiline while a block is
 * being composed or edited, rather than collapsing newlines the moment a tag is incomplete.
 */

// Non-global regexes so `.test()` is stateless (no `lastIndex` carry-over).
const MARKDOWN_TAG_REGEX = /\[\/?markdown\]/
const LATEX_TAG_REGEX = /\[\/?latex\]/

/** Whether `text` contains a `[markdown]` or `[/markdown]` tag. */
export const containsMarkdownTag = (text: string | null | undefined): boolean =>
  !!text && MARKDOWN_TAG_REGEX.test(text)

/** Whether `text` contains a `[latex]` or `[/latex]` tag. */
export const containsLatexTag = (text: string | null | undefined): boolean =>
  !!text && LATEX_TAG_REGEX.test(text)

/** Whether `text` contains any renderable tag (markdown or latex). */
export const containsRenderableTag = (text: string | null | undefined): boolean =>
  containsMarkdownTag(text) || containsLatexTag(text)
