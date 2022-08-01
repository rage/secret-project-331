// Disables server-side rendering for the wrapped component.

import { useEffect, useState } from "react"

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function withNoSsr<T>(
  WrappedComponent: React.ComponentType<React.PropsWithChildren<React.PropsWithChildren<T>>>,
) {
  // Name to display in React Dev tools
  // eslint-disable-next-line i18next/no-literal-string
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"

  const InnerComponent = (props: T) => {
    const [rendered, setRendered] = useState(false)
    useEffect(() => {
      setRendered(true)
    }, [])
    if (!rendered) {
      return null
    }
    return <WrappedComponent {...(props as T)} />
  }

  // eslint-disable-next-line i18next/no-literal-string
  InnerComponent.displayName = `withNoSsr(${displayName})`

  return InnerComponent
}

export default withNoSsr
