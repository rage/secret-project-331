"use client"

import { useEffect, useState } from "react"

/** Width divided by height of the image at `url` once it has loaded; null before that or on error. */
export function useImageAspectRatio(url: string | undefined): number | null {
  const [loaded, setLoaded] = useState<{ url: string; ratio: number } | null>(null)

  useEffect(() => {
    if (!url) {
      return
    }
    let isCurrent = true
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
    return () => {
      isCurrent = false
    }
  }, [url])

  return loaded !== null && loaded.url === url ? loaded.ratio : null
}
