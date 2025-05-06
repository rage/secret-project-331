import dynamic from "next/dynamic"
import { ComponentType } from "react"

import Spinner from "../components/Spinner"

/**
 * A utility function for creating dynamically imported components with a loading state.
 * This is a wrapper around Next.js's dynamic import that provides a consistent loading UI
 * and disables server-side rendering.
 *
 * @param importFn - A function that returns a Promise resolving to a module with a default export
 * @returns A dynamically imported component
 *
 * @example
 * ```tsx
 * const MyComponent = dynamicImport(() => import('./MyComponent'))
 * ```
 */
const dynamicImport = <P extends object = Record<string, never>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
) =>
  dynamic(importFn, {
    ssr: false,
    loading: () => <Spinner />,
  })

export default dynamicImport
