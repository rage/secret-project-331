import type { BlockInstance } from "@/utils/Gutenberg/types"

// Gutenberg's link inputs prepend a protocol to anything that does not look like a URL, which turns
// `{{LINK}}` into `https://{{LINK}}` and the sent link into `https://https://...`.
const PREPENDED_PROTOCOL_BEFORE_PLACEHOLDER = /^https?:\/\/(?=\{\{\w+\}\})/
const PREPENDED_PROTOCOL_IN_HREF = /(<a\s[^>]*?href=")https?:\/\/(?=\{\{\w+\}\})/g

function normalizeValue(value: unknown, isPlainUrl: boolean): unknown {
  if (typeof value === "string") {
    const withoutHrefPrefix = value.replace(PREPENDED_PROTOCOL_IN_HREF, "$1")
    return isPlainUrl
      ? withoutHrefPrefix.replace(PREPENDED_PROTOCOL_BEFORE_PLACEHOLDER, "")
      : withoutHrefPrefix
  }
  if (Array.isArray(value)) {
    return value.map((element) => normalizeValue(element, false))
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, normalizeValue(field, false)]),
    )
  }
  return value
}

/**
 * Undoes the protocol Gutenberg prepends to a link whose whole target is a placeholder, in `url`
 * and `href` attributes and in links inside rich text, so `https://{{LINK}}` is saved as `{{LINK}}`.
 */
export function stripProtocolBeforePlaceholderLinks(blocks: BlockInstance[]): BlockInstance[] {
  return blocks.map((block) => ({
    ...block,
    attributes: Object.fromEntries(
      Object.entries(block.attributes ?? {}).map(([key, value]) => [
        key,
        normalizeValue(value, key === "url" || key === "href"),
      ]),
    ),
    innerBlocks: stripProtocolBeforePlaceholderLinks(block.innerBlocks ?? []),
  }))
}
