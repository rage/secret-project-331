"use client"

// Disables server-side rendering for the wrapped component. The component is only rendered
// after the first client-side effect runs, which guarantees the markup matches between the
// server (nothing) and the client.

import { useEffect, useState } from "react"

const DEFAULT_DISPLAY_NAME = "Component"

function withNoSsr<T>(WrappedComponent: React.ComponentType<T>) {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || DEFAULT_DISPLAY_NAME

  const InnerComponent = (props: T) => {
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
      setMounted(true)
    }, [])

    if (!mounted) {
      return null
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Shared module might have a different react version
    return <WrappedComponent {...(props as T)} />
  }

  InnerComponent.displayName = `withNoSsr(${displayName})`

  return InnerComponent
}

export default withNoSsr
