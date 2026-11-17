import { useEffect, useState } from "react"

const NATIVE_FIELD = "input, textarea, select, [contenteditable]:not([contenteditable=false])"
const TABBABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]'

function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.closest("[hidden], [inert]")) {
    return false
  }
  if ((element as HTMLButtonElement).disabled) {
    return false
  }
  return element.checkVisibility?.() ?? true
}

// A bare tabindex div with no content, like Gutenberg's focus capture stops.
function isEmptyStop(element: HTMLElement): boolean {
  return (
    element.tagName === "DIV" &&
    !element.hasChildNodes() &&
    !element.hasAttribute("role") &&
    !element.hasAttribute("contenteditable")
  )
}

const follows = (from: Element, el: Element) =>
  Boolean(from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)

function adjacentTabbable(from: Element, backwards: boolean): HTMLElement | undefined {
  const all = [...from.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE)]
  // isTabbable last: it forces style and layout.
  const isNext = (el: HTMLElement) =>
    follows(from, el) !== backwards &&
    !el.contains(from) &&
    !from.contains(el) &&
    !isEmptyStop(el) &&
    isTabbable(el)
  return backwards ? all.findLast((el) => isNext(el)) : all.find((el) => isNext(el))
}

/** Ref callback that stops Gutenberg's WritingFlow from tabbing past the exercise iframe.
 * Moves focus into the iframe when it is next; fields keep Gutenberg's own Tab handling. */
export function useTabKeyContainment(): (element: HTMLElement | null) => void {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element) {
      return
    }
    const focusIframeIfAdjacent = (event: KeyboardEvent, from: Element): boolean => {
      const iframe = element.querySelector("iframe")
      // Skip the document scan when the iframe lies on the other side of `from`.
      if (!iframe || follows(from, iframe) === event.shiftKey) {
        return false
      }
      if (adjacentTabbable(from, event.shiftKey) !== iframe) {
        return false
      }
      event.preventDefault()
      event.stopPropagation()
      iframe.focus()
      return true
    }

    const onBlockKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented || !(event.target instanceof Element)) {
        return
      }
      if (focusIframeIfAdjacent(event, event.target)) {
        return
      }
      if (event.target.closest(NATIVE_FIELD)) {
        return
      }
      event.stopPropagation()
    }

    // Shift+Tab from outside the block (the element after it) back into the iframe.
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        !event.shiftKey ||
        event.defaultPrevented ||
        !(event.target instanceof Element) ||
        element.contains(event.target)
      ) {
        return
      }
      focusIframeIfAdjacent(event, event.target)
    }

    element.addEventListener("keydown", onBlockKeyDown)
    const doc = element.ownerDocument
    doc.addEventListener("keydown", onDocumentKeyDown, true)
    return () => {
      element.removeEventListener("keydown", onBlockKeyDown)
      doc.removeEventListener("keydown", onDocumentKeyDown, true)
    }
  }, [element])

  return setElement
}
