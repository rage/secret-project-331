"use client"

import { useEffect, useState } from "react"

const DEFAULT_DISPLAY_NAME = "Component"

// Disables server-side rendering for the wrapped component. Useful for components that depend on
// browser-only APIs (e.g. the iframe message port). The component renders nothing on the server and
// during the first client render, then mounts after hydration so server and client agree.
function withNoSsr<T extends object>(WrappedComponent: React.ComponentType<T>) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || DEFAULT_DISPLAY_NAME

  const InnerComponent = (props: T) => {
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
      setMounted(true)
    }, [])
    if (!mounted) {
      return null
    }
    return <WrappedComponent {...props} />
  }

  InnerComponent.displayName = `withNoSsr(${displayName})`

  return InnerComponent
}

export default withNoSsr
