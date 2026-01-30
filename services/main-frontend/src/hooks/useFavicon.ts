import { useEffect, useRef } from "react"

export interface UseFaviconOptions {
  favicon: string
  title?: string
  defaultFavicon?: string
  defaultTitle?: string
}

export const useFavicon = ({ favicon, title, defaultFavicon, defaultTitle }: UseFaviconOptions) => {
  const originalTitleRef = useRef<string>(document.title)

  useEffect(() => {
    const originalTitle = originalTitleRef.current
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    if (!faviconLink) {
      faviconLink = document.createElement("link")

      faviconLink.rel = "icon"
      document.head.appendChild(faviconLink)
    }
    faviconLink.href = favicon

    if (title) {
      document.title = title
    }

    return () => {
      if (defaultTitle) {
        document.title = defaultTitle
      } else {
        document.title = originalTitle
      }
      if (faviconLink && defaultFavicon) {
        faviconLink.href = defaultFavicon
      }
    }
  }, [favicon, title, defaultFavicon, defaultTitle])
}
