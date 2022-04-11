import { useEffect } from "react"

import { tryToScrollToSelector } from "../utils/dom"

/**
 * This hook will see if window.location contains an anchor.
 * If it does, it will try to scroll to the selector with timeouts.
 *
 * It will calculate the relative top offset to the document for the selector found
 * and if it changes, i.e. something is rendered above the selector, it will try to scroll to with help of timeouts..
 *
 * @param path The path of the page.
 */
export default function useScrollToSelector(path: string): void {
  useEffect(() => {
    if (typeof window != "undefined" && window.location.hash) {
      const selector = window.location.hash.substring(1)
      let elementToScrollTo: Element | null = null
      let lastOffsetRelativeToDocument = 0
      const setScrollTimeout = (timeout: number) => {
        setTimeout(() => {
          if (!elementToScrollTo) {
            // We try to scroll to element
            elementToScrollTo = tryToScrollToSelector(selector)
            // If element exists, we get the offset relative to the document
            if (elementToScrollTo) {
              lastOffsetRelativeToDocument =
                elementToScrollTo.getBoundingClientRect().top + document.documentElement.scrollTop
            }
          } else {
            // Element exists, get current offset relative to the document
            const offsetRelativeToDocument =
              elementToScrollTo.getBoundingClientRect().top + document.documentElement.scrollTop
            if (offsetRelativeToDocument !== lastOffsetRelativeToDocument) {
              // If they do not match, scroll to the element and update the offset
              elementToScrollTo.scrollIntoView()
              lastOffsetRelativeToDocument =
                elementToScrollTo.getBoundingClientRect().top + document.documentElement.scrollTop
            }
          }
        }, timeout)
      }
      setScrollTimeout(100)
      setScrollTimeout(500)
      setScrollTimeout(1000)
      setScrollTimeout(2000)
    }
  }, [path])
}
