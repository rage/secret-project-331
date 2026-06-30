/**
 * Helpers for detecting the formatting tag pairs (`[markdown]…[/markdown]`,
 * `[latex]…[/latex]`) that the quiz feedback editor understands.
 *
 * Both predicates are deliberately *presence* checks: they return true as soon as either the
 * opening or the closing tag of a pair is present, without requiring a complete, correctly
 * ordered pair. Two consumers in `ParsedTextField` rely on this:
 *
 *  - the multiline decision — the field must already behave like a textarea while the author is
 *    still *building* a block (after typing `[markdown]` but before `[/markdown]`), otherwise
 *    Enter is suppressed and the block can never be composed top-down; and
 *  - the newline-preservation decision — while *editing* an existing block (e.g. retyping the
 *    closing tag) one tag is transiently incomplete, but the other remains, so newlines must not
 *    be collapsed.
 *
 * Requiring a complete ordered pair (the stricter check this module used to expose) broke both:
 * it dropped the field back to single-line mid-edit and silently flattened the author's line
 * breaks. Keeping the two checks as one shared, equally-lenient predicate also avoids the
 * preview button and the multiline state disagreeing about the same text.
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
