/**
 * Helpers for detecting whether editor text contains a *complete* formatting
 * tag block, e.g. `[markdown]…[/markdown]` or `[latex]…[/latex]`.
 *
 * A block counts as complete only when an opening tag is followed (anywhere
 * later in the string, across newlines) by its matching closing tag. This is
 * deliberately stricter than checking that both substrings merely appear:
 * `[/markdown]…[markdown]` (closing before opening) is NOT a complete block.
 *
 * The quiz editor uses this to decide whether a field should be a single-line
 * input (the default) or a multiline textarea (once a markdown block exists, so
 * the author can add line breaks inside it).
 */

// Non-global regexes so `.test()` is stateless (no `lastIndex` carry-over).
// `[\s\S]*?` lazily spans any characters, including newlines, so an empty block
// like `[markdown][/markdown]` still matches.
const MARKDOWN_BLOCK_REGEX = /\[markdown\][\s\S]*?\[\/markdown\]/
const LATEX_BLOCK_REGEX = /\[latex\][\s\S]*?\[\/latex\]/

/**
 * Whether `text` contains a complete `[markdown]…[/markdown]` block.
 *
 * Returns `false` for `null`/`undefined`/empty input and for an opening or
 * closing tag on its own.
 */
export const containsMarkdownBlock = (text: string | null | undefined): boolean => {
  if (!text) {
    return false
  }
  return MARKDOWN_BLOCK_REGEX.test(text)
}

/**
 * Whether `text` contains a complete `[latex]…[/latex]` block.
 *
 * Returns `false` for `null`/`undefined`/empty input and for an opening or
 * closing tag on its own.
 */
export const containsLatexBlock = (text: string | null | undefined): boolean => {
  if (!text) {
    return false
  }
  return LATEX_BLOCK_REGEX.test(text)
}
