import DOMPurify from "dompurify"

const INLINE_TAGS = new Set([
  "A",
  "STRONG",
  "B",
  "EM",
  "I",
  "CODE",
  "KBD",
  "S",
  "SUB",
  "SUP",
  "U",
  "BR",
  "SPAN",
  "MARK",
  "BDO",
])

const ALLOWED_LINK_ATTRS = new Set(["href", "target", "rel"])
const ALLOWED_DIR_VALUES = new Set(["ltr", "rtl", "auto"])
const ROOT_WRAPPER_TAGS = new Set(["p", "div", "span"])
const SAFE_COLOR_KEYWORDS = new Set(["currentcolor", "inherit", "initial", "transparent", "unset"])
const SAFE_INLINE_CLASS_PATTERNS = [
  /^has-[a-z0-9]+(?:-[a-z0-9]+)*-color$/,
  /^has-[a-z0-9]+(?:-[a-z0-9]+)*-font-size$/,
]
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_FUNCTION_PATTERN = /^(?:rgba?|hsla?)\(\s*[-\d.%\s,/]+\)$/i
const FONT_SIZE_PATTERN = /^(?:0|\d*\.?\d+(?:px|em|rem|%|pt|pc|mm|cm|in|vh|vw|vmin|vmax|ch|ex))$/i
const CSS_VARIABLE_PATTERN =
  /^var\(\s*--wp--preset--(?:color|font-size)--[a-z0-9]+(?:-[a-z0-9]+)*\s*\)$/i
const CSS_IDENTIFIER_PATTERN = /^[a-z]+$/i
const UNSAFE_CSS_VALUE_PATTERN = /(?:expression|url|javascript:|data:|@import|<|>|\\)/i
const LANGUAGE_TAG_VALUE_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/

const DANGEROUS_DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "SVG", "MATH", "TEMPLATE"])
const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "PRE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
])
const RECOGNIZED_HTML_TAGS = new Set(
  Array.from(INLINE_TAGS)
    .concat(Array.from(BLOCK_TAGS))
    .map((tagName) => tagName.toLowerCase()),
)
const HTML_TOKEN_REGEX = /<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s[^<>]*?)?>/g
const DANGEROUS_TAG_PAIR_REGEX = new RegExp(
  `<(${Array.from(DANGEROUS_DROP_TAGS)
    .map((tagName) => tagName.toLowerCase())
    .join("|")})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`,
  "gi",
)

const DOMPURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "a",
    "strong",
    "b",
    "em",
    "i",
    "code",
    "kbd",
    "s",
    "sub",
    "sup",
    "u",
    "br",
    "span",
    "mark",
    "bdo",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style", "lang", "dir"],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#|[^a-z]|[a-z+.]+(?:[^a-z+:]|$))/i,
}

export interface SanitizeParagraphHtmlOptions {
  allowedTagNames?: Iterable<string>
}

/**
 * Collects the safe HTML tag names already present in a paragraph, so suggestion
 * sanitization can preserve existing markup without treating new literal tag
 * examples as authored HTML.
 */
export const collectParagraphHtmlTagNames = (html: string): Set<string> => {
  const tagNames = new Set<string>()
  const tokenRegex = new RegExp(HTML_TOKEN_REGEX.source, HTML_TOKEN_REGEX.flags)
  let match: RegExpExecArray | null = tokenRegex.exec(html)

  while (match) {
    const parsedToken = parseHtmlToken(match[0])
    if (parsedToken && RECOGNIZED_HTML_TAGS.has(parsedToken.tagName)) {
      tagNames.add(parsedToken.tagName)
    }

    match = tokenRegex.exec(html)
  }

  return tagNames
}

/** Sanitizes and normalizes AI-generated HTML fragment for Gutenberg paragraphs. */
export const sanitizeParagraphHtml = (
  html: string,
  options: SanitizeParagraphHtmlOptions = {},
): string => {
  if (!html) {
    return ""
  }

  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    throw new Error("sanitizeParagraphHtml requires a browser environment with DOMParser")
  }

  const allowedTagNames = normalizeAllowedTagNames(options.allowedTagNames)
  const preparedHtml = prepareHtmlForParsing(stripDangerousTagPairs(html), allowedTagNames)
  const parser = new window.DOMParser()
  const doc = parser.parseFromString(preparedHtml, "text/html")
  const body = doc.body

  let root: HTMLElement | null = null

  if (body.children.length === 1 && body.firstElementChild) {
    const only = body.firstElementChild as HTMLElement
    if (only.tagName === "P") {
      root = only
    } else if ((only.tagName === "DIV" || only.tagName === "SPAN") && !only.attributes.length) {
      root = only
    }
  }

  const fragmentContainer = doc.createElement("div")

  if (root) {
    while (root.firstChild) {
      fragmentContainer.appendChild(root.firstChild)
    }
  } else {
    while (body.firstChild) {
      fragmentContainer.appendChild(body.firstChild)
    }
  }

  const sanitizedContainer = doc.createElement("div")
  appendSanitizedNodes(sanitizedContainer, Array.from(fragmentContainer.childNodes))
  normalizeBreaks(sanitizedContainer)

  const structuralHtml = sanitizedContainer.innerHTML
  return DOMPurify.sanitize(structuralHtml, DOMPURIFY_CONFIG)
}

const normalizeBreaks = (container: HTMLElement): void => {
  while (container.firstChild && isTrimmableBreak(container.firstChild)) {
    container.removeChild(container.firstChild)
  }
  while (container.lastChild && isTrimmableBreak(container.lastChild)) {
    container.removeChild(container.lastChild)
  }
}

const isTrimmableBreak = (node: Node): boolean => {
  if (node.nodeType === Node.TEXT_NODE) {
    return !node.textContent || node.textContent.trim() === ""
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement
    return el.tagName === "BR"
  }
  return false
}

const appendSanitizedNodes = (target: HTMLElement, nodes: Node[]): void => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]

    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(target.ownerDocument.createTextNode(node.textContent ?? ""))
      continue
    }

    const renderKind = getRenderableKind(node)
    if (renderKind === "skip") {
      continue
    }

    const element = node as HTMLElement
    const tagName = element.tagName

    if (INLINE_TAGS.has(tagName)) {
      const clone = cloneAllowedInlineElement(target.ownerDocument, element)
      appendSanitizedNodes(clone, Array.from(element.childNodes))
      target.appendChild(clone)
      continue
    }

    const breakCount = tagName === "LI" ? 1 : 2
    ensureLeadingBreaks(target, breakCount)

    if (tagName === "UL" || tagName === "OL") {
      appendListItems(target, element, tagName === "OL")
    } else if (tagName === "LI") {
      appendListItem(target, element, null)
    } else {
      appendSanitizedNodes(target, Array.from(element.childNodes))
    }

    const nextRenderableKind = findNextRenderableKind(nodes, index + 1)
    if (renderKind === "block" && nextRenderableKind === "inline") {
      ensureLeadingBreaks(target, breakCount)
    }
  }
}

const appendListItems = (target: HTMLElement, listElement: HTMLElement, ordered: boolean): void => {
  let listIndex = 1

  for (const child of Array.from(listElement.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName === "LI") {
      appendListItem(target, child as HTMLElement, ordered ? listIndex : null)
      listIndex += 1
      continue
    }

    appendSanitizedNodes(target, [child])
  }
}

const appendListItem = (
  target: HTMLElement,
  listItemElement: HTMLElement,
  orderedIndex: number | null,
): void => {
  ensureLeadingBreaks(target, 1)

  const marker = orderedIndex === null ? "- " : `${orderedIndex}. `
  target.appendChild(target.ownerDocument.createTextNode(marker))
  appendSanitizedNodes(target, Array.from(listItemElement.childNodes))
}

const cloneAllowedInlineElement = (doc: Document, element: HTMLElement): HTMLElement => {
  const clone = doc.createElement(element.tagName.toLowerCase())

  if (element.tagName === "A") {
    for (const attr of Array.from(element.attributes)) {
      if (ALLOWED_LINK_ATTRS.has(attr.name)) {
        clone.setAttribute(attr.name, attr.value)
      }
    }
    return clone
  }

  if (element.tagName === "SPAN" || element.tagName === "MARK") {
    copySafeInlineFormattingAttributes(clone, element)
    return clone
  }

  if (element.tagName === "BDO") {
    copySafeLanguageAttributes(clone, element)
    return clone
  }

  return clone
}

const copySafeInlineFormattingAttributes = (clone: HTMLElement, element: HTMLElement): void => {
  const className = sanitizeAllowedInlineClassNames(element.getAttribute("class") ?? "")
  if (className) {
    clone.setAttribute("class", className)
  }

  const style = sanitizeAllowedInlineStyle(element.getAttribute("style") ?? "")
  if (style) {
    clone.setAttribute("style", style)
  }
}

const copySafeLanguageAttributes = (clone: HTMLElement, element: HTMLElement): void => {
  const lang = element.getAttribute("lang")?.trim()
  if (lang && LANGUAGE_TAG_VALUE_PATTERN.test(lang)) {
    clone.setAttribute("lang", lang)
  }

  const dir = element.getAttribute("dir")?.trim().toLowerCase()
  if (dir && ALLOWED_DIR_VALUES.has(dir)) {
    clone.setAttribute("dir", dir)
  }
}

const sanitizeAllowedInlineClassNames = (className: string): string =>
  className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      if (token === "has-inline-color" || token === "has-custom-font-size") {
        return true
      }

      return SAFE_INLINE_CLASS_PATTERNS.some((pattern) => pattern.test(token))
    })
    .join(" ")

const sanitizeAllowedInlineStyle = (style: string): string =>
  style
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .flatMap((rule) => {
      const separatorIndex = rule.indexOf(":")
      if (separatorIndex < 0) {
        return []
      }

      const property = rule.slice(0, separatorIndex).trim().toLowerCase()
      const value = rule.slice(separatorIndex + 1).trim()

      if (!value || !isSafeInlineStyleValue(property, value)) {
        return []
      }

      return [`${property}:${value}`]
    })
    .join(";")

const isSafeInlineStyleValue = (property: string, value: string): boolean => {
  switch (property) {
    case "background-color":
    case "color":
      return isSafeColorValue(value)
    case "font-size":
      return isSafeFontSizeValue(value)
    case "text-decoration":
      return value.trim().replace(/\s+/g, " ").toLowerCase() === "underline"
    default:
      return false
  }
}

const isSafeColorValue = (value: string): boolean => {
  const normalizedValue = value.trim()
  if (!normalizedValue || UNSAFE_CSS_VALUE_PATTERN.test(normalizedValue)) {
    return false
  }

  return (
    HEX_COLOR_PATTERN.test(normalizedValue) ||
    COLOR_FUNCTION_PATTERN.test(normalizedValue) ||
    CSS_VARIABLE_PATTERN.test(normalizedValue) ||
    SAFE_COLOR_KEYWORDS.has(normalizedValue.toLowerCase()) ||
    CSS_IDENTIFIER_PATTERN.test(normalizedValue)
  )
}

const isSafeFontSizeValue = (value: string): boolean => {
  const normalizedValue = value.trim()
  if (!normalizedValue || UNSAFE_CSS_VALUE_PATTERN.test(normalizedValue)) {
    return false
  }

  return FONT_SIZE_PATTERN.test(normalizedValue) || CSS_VARIABLE_PATTERN.test(normalizedValue)
}

const ensureLeadingBreaks = (target: HTMLElement, requiredBreaks: number): void => {
  if (!hasMeaningfulContent(target)) {
    return
  }

  const trailingBreakCount = countTrailingBreaks(target)
  for (let index = trailingBreakCount; index < requiredBreaks; index += 1) {
    target.appendChild(target.ownerDocument.createElement("br"))
  }
}

const hasMeaningfulContent = (container: HTMLElement): boolean => {
  for (const child of Array.from(container.childNodes)) {
    if (getRenderableKind(child) !== "skip") {
      return true
    }
  }

  return false
}

const countTrailingBreaks = (container: HTMLElement): number => {
  let breakCount = 0
  let currentNode = container.lastChild

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE && !currentNode.textContent?.trim()) {
      currentNode = currentNode.previousSibling
      continue
    }

    if (
      currentNode.nodeType === Node.ELEMENT_NODE &&
      (currentNode as HTMLElement).tagName === "BR"
    ) {
      breakCount += 1
      currentNode = currentNode.previousSibling
      continue
    }

    break
  }

  return breakCount
}

const findNextRenderableKind = (nodes: Node[], startIndex: number): "skip" | "inline" | "block" => {
  for (let index = startIndex; index < nodes.length; index += 1) {
    const renderKind = getRenderableKind(nodes[index])
    if (renderKind !== "skip") {
      return renderKind
    }
  }

  return "skip"
}

const getRenderableKind = (node: Node): "skip" | "inline" | "block" => {
  if (node.nodeType === Node.COMMENT_NODE) {
    return "skip"
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() ? "inline" : "skip"
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "skip"
  }

  const element = node as HTMLElement
  if (DANGEROUS_DROP_TAGS.has(element.tagName)) {
    return "skip"
  }

  if (INLINE_TAGS.has(element.tagName)) {
    return "inline"
  }

  return BLOCK_TAGS.has(element.tagName) ? "block" : "inline"
}

const prepareHtmlForParsing = (html: string, allowedTagNames: Set<string> | null): string => {
  let preparedHtml = ""
  let lastIndex = 0
  const openTagCounts = new Map<string, number>()
  const tokenRegex = new RegExp(HTML_TOKEN_REGEX.source, HTML_TOKEN_REGEX.flags)
  let match: RegExpExecArray | null = tokenRegex.exec(html)

  while (match) {
    const token = match[0]
    const matchIndex = match.index ?? 0

    preparedHtml += escapeHtmlText(html.slice(lastIndex, matchIndex))

    if (token.startsWith("<!--")) {
      preparedHtml += token
      lastIndex = matchIndex + token.length
      match = tokenRegex.exec(html)
      continue
    }

    if (shouldPreserveHtmlToken(html, token, matchIndex, openTagCounts, allowedTagNames)) {
      preparedHtml += token
    } else {
      preparedHtml += escapeHtmlText(token)
    }

    lastIndex = matchIndex + token.length

    match = tokenRegex.exec(html)
  }

  preparedHtml += escapeHtmlText(html.slice(lastIndex))
  return preparedHtml
}

const shouldPreserveHtmlToken = (
  html: string,
  token: string,
  tokenIndex: number,
  openTagCounts: Map<string, number>,
  allowedTagNames: Set<string> | null,
): boolean => {
  const parsedToken = parseHtmlToken(token)

  if (!parsedToken || !RECOGNIZED_HTML_TAGS.has(parsedToken.tagName)) {
    return false
  }

  if (parsedToken.isClosing) {
    const currentCount = openTagCounts.get(parsedToken.tagName) ?? 0
    if (currentCount <= 0) {
      return false
    }
    openTagCounts.set(parsedToken.tagName, currentCount - 1)
    return true
  }

  if (!canPreserveOpeningTag(html, tokenIndex, parsedToken.tagName, allowedTagNames)) {
    return false
  }

  if (parsedToken.isSelfClosing) {
    return parsedToken.tagName !== "br" || shouldPreserveStandaloneBreakTag(html, tokenIndex, token)
  }

  if (hasMatchingClosingTag(html, parsedToken.tagName, tokenIndex + token.length)) {
    openTagCounts.set(parsedToken.tagName, (openTagCounts.get(parsedToken.tagName) ?? 0) + 1)
    return true
  }

  if (
    isStartOfTrimmedContent(html, tokenIndex) &&
    hasNonWhitespaceCharacterAfterToken(html, tokenIndex + token.length)
  ) {
    openTagCounts.set(parsedToken.tagName, (openTagCounts.get(parsedToken.tagName) ?? 0) + 1)
    return true
  }

  return false
}

const canPreserveOpeningTag = (
  html: string,
  tokenIndex: number,
  tagName: string,
  allowedTagNames: Set<string> | null,
): boolean => {
  if (!allowedTagNames) {
    return true
  }

  if (allowedTagNames.has(tagName)) {
    return true
  }

  return ROOT_WRAPPER_TAGS.has(tagName) && isStartOfTrimmedContent(html, tokenIndex)
}

const normalizeAllowedTagNames = (allowedTagNames?: Iterable<string>): Set<string> | null => {
  if (!allowedTagNames) {
    return null
  }

  const normalizedTagNames = new Set<string>()
  for (const tagName of Array.from(allowedTagNames)) {
    const normalizedTagName = tagName.toLowerCase()
    if (RECOGNIZED_HTML_TAGS.has(normalizedTagName)) {
      normalizedTagNames.add(normalizedTagName)
    }
  }

  return normalizedTagNames
}

const parseHtmlToken = (
  token: string,
): { tagName: string; isClosing: boolean; isSelfClosing: boolean } | null => {
  const match = token.match(/^<\s*(\/)?\s*([A-Za-z][A-Za-z0-9:-]*)[\s\S]*?(\s*\/)?\s*>$/)
  if (!match) {
    return null
  }

  return {
    tagName: match[2]?.toLowerCase() ?? "",
    isClosing: match[1] === "/",
    isSelfClosing: Boolean(match[3]) || match[2]?.toLowerCase() === "br",
  }
}

const hasMatchingClosingTag = (html: string, tagName: string, searchFrom: number): boolean => {
  const closingTagPattern = new RegExp(`</\\s*${tagName}\\s*>`, "i")
  return closingTagPattern.test(html.slice(searchFrom))
}

const isStartOfTrimmedContent = (html: string, tokenIndex: number): boolean =>
  html.slice(0, tokenIndex).trim().length === 0

const hasNonWhitespaceCharacterAfterToken = (html: string, nextIndex: number): boolean =>
  Boolean(html.slice(nextIndex).match(/\S/))

const shouldPreserveStandaloneBreakTag = (
  html: string,
  tokenIndex: number,
  token: string,
): boolean => {
  const previousChar = tokenIndex > 0 ? html[tokenIndex - 1] : ""
  const nextChar = html[tokenIndex + token.length] ?? ""
  return (
    !/\s/.test(previousChar) || !/\s/.test(nextChar) || isStartOfTrimmedContent(html, tokenIndex)
  )
}

const escapeHtmlText = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const stripDangerousTagPairs = (html: string): string => html.replace(DANGEROUS_TAG_PAIR_REGEX, "")
