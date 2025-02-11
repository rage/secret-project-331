// Disables server-side rendering for the wrapped component.

import { useEffect, useState } from "react"

const DEFAULT_DISPLAY_NAME = "Component"

function withNoSsr<T>(WrappedComponent: React.ComponentType<T>) {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || DEFAULT_DISPLAY_NAME

  const InnerComponent = (props: T) => {
    const [rendered, setRendered] = useState(false)
    useEffect(() => {
      setRendered(true)
    }, [])
    if (!rendered) {
      return null
    }
    // @ts-expect-error: no intrisic attributes
    return <WrappedComponent {...(props as T)} />
  }

  InnerComponent.displayName = `withNoSsr(${displayName})`

  return InnerComponent
}

export default withNoSsr
