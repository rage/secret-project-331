"use client"

import { useEffect, useState } from "react"

/**
 * Width divided by height of the image at `url` once it has loaded; null before that or on error.
 * With `mediaQuery` (e.g. `(min-width: 48rem)`), the image is fetched only once the query matches,
 * so screens that never show it don't download it.
 */
export function useImageAspectRatio(url: string | undefined, mediaQuery?: string): number | null {
  const [loaded, setLoaded] = useState<{ url: string; ratio: number } | null>(null)

  useEffect(() => {
    if (!url) {
      return
    }
    let isCurrent = true
    const load = () => {
      const image = new Image()
      image.addEventListener(
        "load",
        () => {
          if (isCurrent && image.naturalWidth > 0 && image.naturalHeight > 0) {
            setLoaded({ url, ratio: image.naturalWidth / image.naturalHeight })
          }
        },
        { once: true },
      )
      image.src = url
    }
    const media = mediaQuery ? window.matchMedia(mediaQuery) : null
    if (media === null || media.matches) {
      load()
      return () => {
        isCurrent = false
      }
    }
    const onChange = () => {
      if (media.matches) {
        media.removeEventListener("change", onChange)
        load()
      }
    }
    media.addEventListener("change", onChange)
    return () => {
      isCurrent = false
      media.removeEventListener("change", onChange)
    }
  }, [url, mediaQuery])

  return loaded !== null && loaded.url === url ? loaded.ratio : null
}
