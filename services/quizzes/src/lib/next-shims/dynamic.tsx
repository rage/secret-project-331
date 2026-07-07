// SPA replacement for `next/dynamic`: lazy loading via React.lazy + Suspense, `ssr` a no-op (this
// app is fully client-rendered). Consumed directly by dynamicWithIframeReload.tsx and, via rsbuild
// `resolve.alias`, by vendored shared code that imports "next/dynamic".
import { type ComponentType, createElement, lazy, type ReactNode, Suspense } from "react"

type LoaderModule<P> = ComponentType<P> | { default: ComponentType<P> }

export type Loader<P = Record<string, unknown>> = () => Promise<LoaderModule<P>>

export interface DynamicOptions {
  /** Ignored: this app has no SSR. */
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
