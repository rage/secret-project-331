"use client"

import { useEffect, useState } from "react"

import { primaryFont } from "../styles"

/**
 * Tracks whether `fontFamily` has finished loading, defaulting to the site's primary font.
 *
 * Useful for anything that measures text before drawing it -- measured against a fallback font,
 * the layout ends up computed for the wrong metrics and the real glyphs then arrive under it.
 *
 * Reports loaded on a failed load, or in a browser without the font loading API, so that the
 * caller draws with the fallback font rather than nothing at all.
 */
export const useFontLoaded = (fontFamily: string = primaryFont): boolean => {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLoaded(false)
    let cancelled = false
    const markLoaded = () => {
      if (!cancelled) {
        setLoaded(true)
      }
    }
    const fonts: FontFaceSet | undefined = document.fonts
    if (fonts) {
      fonts.load(`1rem ${fontFamily}`).then(markLoaded, markLoaded)
    } else {
      markLoaded()
    }
    return () => {
      cancelled = true
    }
  }, [fontFamily])
  return loaded
}
