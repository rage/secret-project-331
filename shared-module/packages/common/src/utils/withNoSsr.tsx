// Disables server-side rendering for the wrapped component.

import { useEffect, useState } from "react"

function withNoSsr<T>(WrappedComponent: React.ComponentType<T>) {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"

  const InnerComponent = (props: T) => {
    const [rendered, setRendered] = useState(false)
    useEffect(() => {
      setRendered(true)
    }, [])
    if (!rendered) {
      return null
    }
    // @ts-ignore: no intrisic attributes
    return <WrappedComponent {...(props as T)} />
  }

  InnerComponent.displayName = `withNoSsr(${displayName})`

  return InnerComponent
}

export default withNoSsr
