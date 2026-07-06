"use client"

// SPA replacement for `next/dynamic`. This service is 100% client-rendered (TanStack Start SPA
// mode), so the Next-specific `ssr` option is a no-op and lazy loading is done with React.lazy +
// Suspense. Two consumers resolve to this module:
//   - code this service owns (src/utils/dynamicWithIframeReload.tsx) imports it directly, and
//   - the vendored shared-module code (common/utils/dynamicImport) still imports "next/dynamic",
//     which rsbuild `resolve.alias` maps here at build time (the shared source is unchanged so the
//     Next-based apps that vendor it keep using the real next/dynamic).
import { type ComponentType, createElement, lazy, type ReactNode, Suspense } from "react"

type LoaderModule<P> = ComponentType<P> | { default: ComponentType<P> }

export type Loader<P = Record<string, unknown>> = () => Promise<LoaderModule<P>>

export interface DynamicOptions {
  /** Ignored: this app has no SSR. Kept for source-compatibility with next/dynamic call sites. */
  ssr?: boolean
  loading?: ComponentType<{ error?: Error | null; isLoading?: boolean; pastDelay?: boolean }>
}

function normalizeModule<P>(mod: LoaderModule<P>): { default: ComponentType<P> } {
  return mod && typeof mod === "object" && "default" in mod
    ? (mod as { default: ComponentType<P> })
    : { default: mod as ComponentType<P> }
}

export default function dynamic<P extends object = Record<string, never>>(
  loader: Loader<P>,
  options?: DynamicOptions,
): ComponentType<P> {
  const LazyComponent = lazy(() => loader().then(normalizeModule))
  const Loading = options?.loading
  const fallback: ReactNode = Loading ? createElement(Loading) : null

  function DynamicComponent(props: P) {
    return createElement(Suspense, { fallback }, createElement(LazyComponent, props))
  }
  DynamicComponent.displayName = "Dynamic"
  return DynamicComponent
}
