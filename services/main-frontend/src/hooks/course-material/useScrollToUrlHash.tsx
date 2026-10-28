"use client"

import { useEffect } from "react"

import { headingAnchorIdPart } from "@/shared-module/common/utils/headingAnchors"

/** Ids that are not plain ASCII reach us percent-encoded, but the element carries the decoded id. */
function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash)
  } catch {
    return hash
  }
}

/**
 * Finds the element the url hash points at. The hash is tried as written before decoding it, like
 * the browser does, so an id containing "%" still matches.
 *
 * With `matchHeadingIdPrefix`, an element whose id starts with the hash's heading anchor id part is
 * accepted when no id matches, so a link still resolves after its heading was reworded. That id
 * part is hex, so interpolating it into a selector is safe.
 */
function findHashTarget(hash: string, matchHeadingIdPrefix: boolean): Element | null {
  const decodedHash = decodeHash(hash)
  // oxlint-disable-next-line unicorn/prefer-query-selector -- ids from a url fragment need no escaping with getElementById
  const idMatch = document.getElementById(hash) ?? document.getElementById(decodedHash)
  if (idMatch || !matchHeadingIdPrefix) {
    return idMatch
  }
  const idPart = headingAnchorIdPart(decodedHash)
  return idPart === undefined ? null : document.querySelector(`[id^="${idPart}-"]`)
}

/**
 * This hook will see if window.location contains an anchor.
 * If it does, it will try to scroll to the selector with timeouts.
 *
 * It will calculate the relative top offset to the document for the selector found
 * and if it changes, i.e. something is rendered above the selector, it will try to scroll to with help of timeouts..
 *
 * @param path The path of the page.
 * @param options.matchHeadingIdPrefix When no id matches, fall back to the element whose id starts
 * with the hash's heading anchor id part, so links survive a reworded heading.
 */
export default function useScrollToUrlHash(
  path: string,
  { matchHeadingIdPrefix = false }: { matchHeadingIdPrefix?: boolean } = {},
): void {
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.slice(1)
      let elementToScrollTo: Element | null = null
      let lastOffsetRelativeToDocument = 0
      const setScrollTimeout = (timeout: number) => {
        setTimeout(() => {
          if (!elementToScrollTo) {
            elementToScrollTo = findHashTarget(hash, matchHeadingIdPrefix)
            // If element exists, we scroll to it and get the offset relative to the document
            if (elementToScrollTo) {
              elementToScrollTo.scrollIntoView()
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
  }, [path, matchHeadingIdPrefix])
}
