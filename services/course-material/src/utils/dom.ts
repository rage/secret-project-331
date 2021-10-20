export function tryToScrollToSelector(selector: string): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    const element = document.querySelector(selector)
    if (!element) {
      // eslint-disable-next-line i18next/no-literal-string
      console.warn("Could not find the element to scroll to.")
      return
    }
    element.scrollIntoView()
  } catch (e) {
    // eslint-disable-next-line i18next/no-literal-string
    console.warn("Could not scroll element into view", e)
  }
}
