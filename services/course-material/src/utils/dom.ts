export function tryToScrollToSelector(selector: string): Element | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    // eslint-disable-next-line i18next/no-literal-string
    const element = document.querySelector(`[id='${selector}']`)
    if (!element) {
      // eslint-disable-next-line i18next/no-literal-string
      console.warn("Could not find the element to scroll to.")
      return null
    }
    element.scrollIntoView()
    return element
  } catch (e) {
    // eslint-disable-next-line i18next/no-literal-string
    console.warn("Could not scroll element into view", e)
    return null
  }
}
