import { headingAnchorIdPart } from "@/shared-module/common/utils/headingAnchors"

/**
 * Falls back to the client id fragment an anchor starts with, so a link still resolves after its
 * heading was reworded. That fragment is hex, so interpolating it into a selector is safe.
 */
function findByIdPart(anchor: string): Element | null {
  const idPart = headingAnchorIdPart(anchor)
  return idPart === undefined ? null : document.querySelector(`[id^="${idPart}-"]`)
}

export function tryToScrollToSelector(
  elementId: string,
  matchHeadingIdPrefix = false,
): Element | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    // oxlint-disable-next-line unicorn/prefer-query-selector -- ids from a url fragment need no escaping with getElementById
    const element =
      document.querySelector(`#${elementId}`) ??
      (matchHeadingIdPrefix ? findByIdPart(elementId) : null)
    if (!element) {
      console.warn("Could not find the element to scroll to.")
      return null
    }
    element.scrollIntoView()
    return element
  } catch (e) {
    console.warn("Could not scroll element into view", e)
    return null
  }
}
