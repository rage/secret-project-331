export function tryToScrollToSelector(selector: string): boolean {
  if (typeof window === "undefined") {
    return false
  }
  try {
    // eslint-disable-next-line i18next/no-literal-string
    const element = document.querySelector(`[id='${selector}']`)
    if (!element) {
      // eslint-disable-next-line i18next/no-literal-string
      console.warn("Could not find the element to scroll to.")
      return false
    }
    element.scrollIntoView()
    return true
  } catch (e) {
    // eslint-disable-next-line i18next/no-literal-string
    console.warn("Could not scroll element into view", e)
    return false
  }
}
