import { useEffect } from "react"

export interface UseFaviconOptions {
  favicon: string
  defaultFavicon?: string
}

/**
 * Swaps the document favicon while mounted, restoring `defaultFavicon` on unmount.
 *
 * This hook intentionally does NOT touch `document.title`: the page title is owned solely by
 * `PageTitleManager` (via `usePageTitle`). Register a tab title with `usePageTitle` instead.
 */
export const useFavicon = ({ favicon, defaultFavicon }: UseFaviconOptions) => {
  useEffect(() => {
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    if (!faviconLink) {
      faviconLink = document.createElement("link")

      faviconLink.rel = "icon"
      document.head.append(faviconLink)
    }
    faviconLink.href = favicon

    return () => {
      if (faviconLink && defaultFavicon) {
        faviconLink.href = defaultFavicon
      }
    }
  }, [favicon, defaultFavicon])
}
