import type { HighlightResult, HLJSApi } from "highlight.js"

const LINE_BREAK = Symbol("LINE_BREAK")
type Segment = Node | typeof LINE_BREAK

function splitTree(node: Node): Segment[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ""
    const parts = text.split("\n")
    if (parts.length === 1) {
      return [node]
    }
    const result: Segment[] = []
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        result.push(LINE_BREAK)
      }
      result.push(document.createTextNode(parts[i]))
    }
    return result
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const childSegments: Segment[] = []
    for (const child of Array.from(node.childNodes)) {
      childSegments.push(...splitTree(child))
    }
    if (!childSegments.some((s) => s === LINE_BREAK)) {
      return [node]
    }
    const groups: Node[][] = [[]]
    for (const seg of childSegments) {
      if (seg === LINE_BREAK) {
        groups.push([])
      } else {
        groups[groups.length - 1].push(seg as Node)
      }
    }
    const result: Segment[] = []
    for (let i = 0; i < groups.length; i++) {
      if (i > 0) {
        result.push(LINE_BREAK)
      }
      const clone = (node as Element).cloneNode(false) as Element
      for (const n of groups[i]) {
        clone.appendChild(n)
      }
      result.push(clone)
    }
    return result
  }

  return [node]
}

function groupSegmentsIntoLines(segments: Segment[]): Node[][] {
  const lines: Node[][] = [[]]
  for (const seg of segments) {
    if (seg === LINE_BREAK) {
      lines.push([])
    } else {
      lines[lines.length - 1].push(seg as Node)
    }
  }
  return lines
}

function wrapSingleLine(el: HTMLElement, highlightedLines: Set<number>): void {
  const span = document.createElement("span")
  span.setAttribute("data-line", "1")
  span.className = highlightedLines.has(1) ? "code-line highlighted-line" : "code-line"
  while (el.firstChild) {
    span.appendChild(el.firstChild)
  }
  el.appendChild(span)
}

/** Called by the plugin after highlight.js runs; exported for unit tests only. */
export function applyLineWrapping(el: HTMLElement): void {
  const raw = el.dataset.highlightLines
  if (!raw) {
    return
  }
  if (el.dataset.hljsLineWrapped === "true") {
    return
  }

  const highlightedLines = new Set(
    raw
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0),
  )
  if (highlightedLines.size === 0) {
    return
  }

  if (!el.textContent?.includes("\n")) {
    wrapSingleLine(el, highlightedLines)
    el.dataset.hljsLineWrapped = "true"
    return
  }

  const allSegments: Segment[] = []
  for (const child of Array.from(el.childNodes)) {
    allSegments.push(...splitTree(child))
  }
  const lines = groupSegmentsIntoLines(allSegments)

  const fragment = document.createDocumentFragment()
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const span = document.createElement("span")
    span.className = highlightedLines.has(lineNum) ? "code-line highlighted-line" : "code-line"
    span.setAttribute("data-line", String(lineNum))
    for (const node of lines[i]) {
      span.appendChild(node)
    }
    fragment.appendChild(span)
  }
  el.innerHTML = ""
  el.appendChild(fragment)
  el.dataset.hljsLineWrapped = "true"
}

class LineHighlightPlugin {
  "after:highlightElement"({ el }: { el: Element; result: HighlightResult; text: string }): void {
    applyLineWrapping(el as HTMLElement)
  }
}

let registered = false

/** Registers the line-highlight plugin with highlight.js once. */
export function ensureLineHighlightPluginRegistered(hljs: HLJSApi): void {
  if (registered) {
    return
  }
  hljs.addPlugin(new LineHighlightPlugin())
  registered = true
}
