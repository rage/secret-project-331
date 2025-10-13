// During initial render query parameters are undedined in Next.js due to optimization
// reasons. This HOC allows one to delay rendering a subtree until required query
// parameters are ready. This way parts outside the subtree can still be
// prerendered and optimized by Next.js.

import { useSearchParams } from "next/navigation"

import withSuspenseBoundary from "./withSuspenseBoundary"

const DEFAULT_DISPLAY_NAME = "Component"

interface ProvidedExtraProps<T> {
  query: SimplifiedUrlQuery<T>
}

// Like query but string[] -> string. Arrays can appear in the original implementation
// when multiple query parameters are supplied with the same name.
// We default to the first provided value.
export type SimplifiedUrlQuery<T = unknown> = T extends string
  ? Record<T, string>
  : NodeJS.Dict<string>

export function dontRenderUntilQueryParametersReady<T, P = unknown>(
  WrappedComponent: React.ComponentType<React.PropsWithChildren<T & ProvidedExtraProps<P>>>,
  allowNoQueryParameters = false,
) {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || DEFAULT_DISPLAY_NAME

  const InnerComponent = (props: T) => {
    const queryParameters: NodeJS.Dict<string> = {}
    const searchParams = useSearchParams()

    // No query parameters, don't render anything
    if (!allowNoQueryParameters && searchParams.toString().length === 0) {
      return null
    }

    // Convert search params to object
    const queryObject: Record<string, string> = {}
    if (searchParams.toString()) {
      searchParams.forEach((value, key) => {
        queryObject[key] = value
      })
    }

    for (const [key, value] of Object.entries(queryObject)) {
      if (value === undefined) {
        return null
      }
      queryParameters[key] = value
    }

    return <WrappedComponent {...(props as T)} query={queryParameters as SimplifiedUrlQuery<P>} />
  }

  InnerComponent.displayName = `dontRenderUntilQueryParameterReady(${displayName})`

  return InnerComponent
}

export default withSuspenseBoundary(dontRenderUntilQueryParametersReady)
