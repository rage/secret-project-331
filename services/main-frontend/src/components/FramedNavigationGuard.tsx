"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

// Must match the `/chatbot-embed/:id` header rule in next.config.js, the only route allowed to be framed.
const EMBEDDABLE_PATH_PREFIX = "/chatbot-embed/"

/**
 * Stops client-side navigation from showing non-embeddable pages inside an embedded iframe.
 *
 * Router navigations skip the `frame-ancestors` check, so when a framed page lands outside the
 * embed route this reloads it, and the browser then blocks the load with that page's own headers.
 */
const FramedNavigationGuard = () => {
  const pathname = usePathname()

  useEffect(() => {
    if (window.self !== window.top && !pathname.startsWith(EMBEDDABLE_PATH_PREFIX)) {
      window.location.reload()
    }
  }, [pathname])

  return null
}

export default FramedNavigationGuard
