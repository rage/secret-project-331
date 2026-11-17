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

function adjacentTabbable(from: Element, backwards: boolean): HTMLElement | undefined {
  const all = [...from.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) =>
    isTabbable(el),
  )
  const follows = (el: Element) =>
    Boolean(from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
  const nested = (el: Element) => el.contains(from) || from.contains(el)
  if (backwards) {
    return all.findLast((el) => !follows(el) && !nested(el) && !isEmptyStop(el))
  }
  return all.find((el) => follows(el) && !nested(el) && !isEmptyStop(el))
}

/**
 * Keeps Gutenberg's WritingFlow from sending Tab and Shift+Tab past the exercise iframe: when the
 * iframe is the next or previous tabbable, focus moves to it explicitly. Other Tab presses from
 * non-fields are kept from bubbling out; fields keep Gutenberg's own handling. Returns a ref callback.
 */
export function useTabKeyContainment(): (element: HTMLElement | null) => void {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element) {
      return
    }
    const focusIframeIfAdjacent = (event: KeyboardEvent, from: Element): boolean => {
      const iframe = element.querySelector("iframe")
      if (!iframe || adjacentTabbable(from, event.shiftKey) !== iframe) {
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
