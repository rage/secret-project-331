// During initial render query parameters are undedined in Next.js due to optimization
// reasons. This HOC allows one to delay rendering a subtree until required query
// parameters are ready. This way parts outside the subtree can still be
// prerendered and optimized by Next.js.

import { useRouter } from "next/router"

interface ProvidedExtraProps<T> {
  query: SimplifiedUrlQuery<T>
}

// Like query but string[] -> string. Arrays can appear in the original implementation
// when multiple query parameters are supplied with the same name.
// We default to the first provided value.
export type SimplifiedUrlQuery<T = unknown> = T extends string
  ? Record<T, string>
  : NodeJS.Dict<string>

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function dontRenderUntilQueryParametersReady<T, P = unknown>(
  WrappedComponent: React.ComponentType<T & ProvidedExtraProps<P>>,
) {
  // Name to display in React Dev tools
  // eslint-disable-next-line i18next/no-literal-string
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"

  const InnerComponent = (props: T) => {
    const queryParameters: NodeJS.Dict<string> = {}
    const router = useRouter()
    // We're a bit defensive with the null checks because the type definitions
    // around query seem to be unreliable.
    if (!router || !router.isReady || !router.query) {
      return null
    }

    // No query parameters, don't render anything
    if (Object.keys(router.query).length === 0) {
      return null
    }

    for (const [key, value] of Object.entries(router.query)) {
      if (value === undefined) {
        return null
      }
      let queryValue = value
      if (Array.isArray(queryValue)) {
        queryValue = queryValue[0]
      }
      queryParameters[key] = value?.toString()
    }

    return <WrappedComponent {...(props as T)} query={queryParameters as SimplifiedUrlQuery<P>} />
  }

  // eslint-disable-next-line i18next/no-literal-string
  InnerComponent.displayName = `dontRenderUntilQueryParameterReady(${displayName})`

  return InnerComponent
}

export default dontRenderUntilQueryParametersReady
