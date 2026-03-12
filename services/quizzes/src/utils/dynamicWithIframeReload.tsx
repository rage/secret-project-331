"use client"

import dynamic, { type DynamicOptions, type Loader } from "next/dynamic"
import type { ComponentType } from "react"

/**
 * Wraps next/dynamic so that any loader failure first asks the parent iframe
 * to reload this exercise (when running inside an exercise-service iframe),
 * and then rethrows the original error.
 */
/**
 * Requests an iframe reload from the parent page when available.
 */
export function requestIframeReloadFromParent(): void {
  if (typeof window === "undefined") {
    return
  }
  const browserWindow = window as typeof window & {
    __exerciseServiceRequestReload?: () => void
  }
  if (typeof browserWindow.__exerciseServiceRequestReload === "function") {
    browserWindow.__exerciseServiceRequestReload()
  }
}

type DynamicLoader<Props extends object> = () => Promise<
  { default: ComponentType<Props> } | ComponentType<Props>
>

export interface DynamicWithIframeReloadDeps {
  dynamicFn?: typeof dynamic
}

function dynamicWithIframeReload<Props extends object = Record<string, never>>(
  loader: DynamicLoader<Props>,
  options?: DynamicOptions<Props>,
  deps: DynamicWithIframeReloadDeps = {},
): ComponentType<Props> {
  const { dynamicFn = dynamic } = deps
  const wrappedLoader: DynamicLoader<Props> = async () => {
    try {
      return await loader()
    } catch (error) {
      requestIframeReloadFromParent()
      throw error
    }
  }

  if (options) {
    return dynamicFn<Props>(wrappedLoader as Loader<Props>, { ...options })
  }
  return dynamicFn<Props>(wrappedLoader as Loader<Props>)
}

export default dynamicWithIframeReload
