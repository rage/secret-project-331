import type { Block } from "@/types/courseMaterialBlock"

/** Containers that show nothing but their children. */
const CHILD_ONLY_CONTAINERS = new Set([
  "moocfi/aside",
  "moocfi/infobox",
  "core/quote",
  "core/group",
])

const hasVisibleText = (html: unknown): boolean => {
  if (typeof html !== "string") {
    return false
  }
  // Inline media counts as content even without text.
  if (/<(img|iframe|svg|video|audio)\b/i.test(html)) {
    return true
  }
  const text = html
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll(/&nbsp;|&#160;/g, "")
    .trim()
  return text.length > 0
}

/**
 * Whether a block would render nothing a student can see, such as an empty paragraph or an image
 * without a file. The renderer skips these so they don't leave gaps.
 */
export function isEmptyBlock(block: Block<unknown>): boolean {
  const attributes = (block.attributes ?? {}) as Record<string, unknown>
  // Links can point at an anchor even when its block is empty.
  if (typeof attributes.anchor === "string" && attributes.anchor !== "") {
    return false
  }
  switch (block.name) {
    case "core/paragraph":
    case "core/heading":
      return !hasVisibleText(attributes.content)
    case "core/image":
      return typeof attributes.url !== "string" || attributes.url.trim() === ""
    case "moocfi/latex":
      return typeof attributes.text !== "string" || attributes.text.trim() === ""
    case "core/code":
    case "core/preformatted":
      return typeof attributes.content !== "string" || attributes.content.trim() === ""
    case "core/list":
      return block.innerBlocks.length === 0 && !hasVisibleText(attributes.values)
    default:
      if (CHILD_ONLY_CONTAINERS.has(block.name)) {
        // A quote can carry its text in `value` instead of children, and shows its citation too.
        return (
          block.innerBlocks.every(isEmptyBlock) &&
          !hasVisibleText(attributes.value) &&
          !hasVisibleText(attributes.citation)
        )
      }
      return false
  }
}
