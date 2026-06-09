"use client"

// Disables server-side rendering for the wrapped component. Useful for components that depend on
// browser-only APIs (e.g. the iframe message port).
import { useIsSSR } from "react-aria"

const DEFAULT_DISPLAY_NAME = "Component"

function withNoSsr<T extends object>(WrappedComponent: React.ComponentType<T>) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || DEFAULT_DISPLAY_NAME

  const InnerComponent = (props: T) => {
    const isSSR = useIsSSR()
    if (isSSR) {
      return null
    }
    return <WrappedComponent {...props} />
  }

  InnerComponent.displayName = `withNoSsr(${displayName})`

  return InnerComponent
}

export default withNoSsr
