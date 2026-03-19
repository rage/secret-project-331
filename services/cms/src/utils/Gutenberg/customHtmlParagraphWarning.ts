"use client"

const INLINE_ONLY_CUSTOM_HTML_TAGS = new Set([
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

const hasMeaningfulText = (element: HTMLElement): boolean =>
  Array.from(element.childNodes).some((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").trim().length > 0
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      return hasMeaningfulText(node as HTMLElement)
    }

    return false
  })

export const shouldWarnAboutMissingParagraphWrapperInCustomHtml = (html: string): boolean => {
  if (!html.trim() || typeof DOMParser === "undefined") {
    return false
  }

  const doc = new DOMParser().parseFromString(html, "text/html")
  const { body } = doc

  const topLevelMeaningfulNodes = Array.from(body.childNodes).filter((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").trim().length > 0
    }

    return node.nodeType === Node.ELEMENT_NODE
  })

  if (topLevelMeaningfulNodes.length === 0) {
    return false
  }

  if (
    topLevelMeaningfulNodes.length === 1 &&
    topLevelMeaningfulNodes[0].nodeType === Node.ELEMENT_NODE &&
    (topLevelMeaningfulNodes[0] as HTMLElement).tagName.toLowerCase() === "p"
  ) {
    return false
  }

  const elements = Array.from(body.querySelectorAll<HTMLElement>("*"))

  if (
    elements.some((element) => !INLINE_ONLY_CUSTOM_HTML_TAGS.has(element.tagName.toLowerCase()))
  ) {
    return false
  }

  return hasMeaningfulText(body)
}
