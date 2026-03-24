"use client"

const INLINE_ONLY_PARAGRAPH_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
])

const MAX_HEADING_LIKE_TEXT_LENGTH = 120
const MAX_HEADING_LIKE_WORD_COUNT = 12
const SHOW_TEXT = typeof NodeFilter === "undefined" ? 4 : NodeFilter.SHOW_TEXT

const getMeaningfulTextNodes = (element: HTMLElement): Text[] => {
  const walker = element.ownerDocument.createTreeWalker(element, SHOW_TEXT)
  const textNodes: Text[] = []
  let currentNode = walker.nextNode()

  while (currentNode) {
    const textNode = currentNode as Text
    if ((textNode.textContent ?? "").trim().length > 0) {
      textNodes.push(textNode)
    }
    currentNode = walker.nextNode()
  }

  return textNodes
}

const hasBoldAncestor = (node: Node, boundary: HTMLElement): boolean => {
  let current: Node | null = node.parentNode

  while (current && current !== boundary) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      ["b", "strong"].includes((current as HTMLElement).tagName.toLowerCase())
    ) {
      return true
    }
    current = current.parentNode
  }

  return false
}

export const shouldWarnAboutParagraphLookingLikeHeading = (html: string): boolean => {
  if (!html.trim() || typeof DOMParser === "undefined") {
    return false
  }

  const doc = new DOMParser().parseFromString(html, "text/html")
  const { body } = doc

  const elements = Array.from(body.querySelectorAll<HTMLElement>("*"))
  if (elements.some((element) => !INLINE_ONLY_PARAGRAPH_TAGS.has(element.tagName.toLowerCase()))) {
    return false
  }

  if (body.querySelector("br")) {
    return false
  }

  const meaningfulTextNodes = getMeaningfulTextNodes(body)
  if (meaningfulTextNodes.length === 0) {
    return false
  }

  if (!elements.some((element) => ["b", "strong"].includes(element.tagName.toLowerCase()))) {
    return false
  }

  if (meaningfulTextNodes.some((textNode) => !hasBoldAncestor(textNode, body))) {
    return false
  }

  const normalizedText = (body.textContent ?? "").replace(/\s+/g, " ").trim()
  if (!normalizedText) {
    return false
  }

  const wordCount = normalizedText.split(/\s+/).length

  // Keep the heuristic conservative so bolded emphasis sentences do not warn too eagerly.
  if (
    normalizedText.length > MAX_HEADING_LIKE_TEXT_LENGTH ||
    wordCount > MAX_HEADING_LIKE_WORD_COUNT ||
    normalizedText.endsWith(".")
  ) {
    return false
  }

  return true
}
