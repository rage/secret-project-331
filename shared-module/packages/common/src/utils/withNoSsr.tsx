"use client"

// Disables server-side rendering for the wrapped component.

import { useIsSSR } from "react-aria"

const DEFAULT_DISPLAY_NAME = "Component"

function withNoSsr<T>(WrappedComponent: React.ComponentType<T>) {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || DEFAULT_DISPLAY_NAME

  const InnerComponent = (props: T) => {
    const isSSR = useIsSSR()
    if (isSSR) {
      return null
    }

    // @ts-expect-error: no intrisic attributes
    return <WrappedComponent {...(props as T)} />
  }

  InnerComponent.displayName = `withNoSsr(${displayName})`

  return InnerComponent
}

export default withNoSsr
