export function tryToScrollToSelector(selector: string): Element | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const element = document.querySelector(`[id='${selector}']`)
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
