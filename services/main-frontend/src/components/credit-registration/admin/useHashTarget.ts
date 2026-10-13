"use client"

import { useEffect, useState } from "react"

const readHash = (): string =>
  typeof window === "undefined" ? "" : decodeURIComponent(window.location.hash.slice(1))

/**
 * The id the URL's hash points at, kept current across hash changes, and scrolled to once
 * `isReady` turns true: a section rendered after its data arrives misses the browser's own jump.
 */
export const useHashTarget = (isReady: boolean): string => {
  const [hash, setHash] = useState(readHash)

  useEffect(() => {
    const onHashChange = () => setHash(readHash())
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  useEffect(() => {
    if (isReady && hash !== "") {
      document.querySelector(`#${CSS.escape(hash)}`)?.scrollIntoView()
    }
  }, [isReady, hash])

  return hash
}

/** A collapsed section's open state, opened whenever a link lands on it. */
export const useOpenedByLink = (isLinkedTo: boolean) => {
  const [isExpanded, setIsExpanded] = useState(isLinkedTo)
  useEffect(() => {
    if (isLinkedTo) {
      setIsExpanded(true)
    }
  }, [isLinkedTo])
  return { expanded: isExpanded, onExpandedChange: setIsExpanded }
}
