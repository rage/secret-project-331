"use client"

import dynamic, { type DynamicOptions, type Loader } from "next/dynamic"
import type { ComponentType } from "react"

const RELOAD_BRIDGE_RETRY_INTERVAL_MS = 500
const RELOAD_BRIDGE_MAX_WAIT_MS = 10_000

/**
 * Wraps next/dynamic so that any loader failure first asks the parent iframe
 * to reload this exercise (when running inside an exercise-service iframe),
 * and then rethrows the original error.
 */
/**
 * Requests an iframe reload from the parent page when available.
 */
export async function requestIframeReloadFromParent(): Promise<void> {
  if (typeof window === "undefined") {
    return
  }

  const browserWindow = window as typeof window & {
    __exerciseServiceRequestReload?: () => void
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt <= RELOAD_BRIDGE_MAX_WAIT_MS) {
    if (typeof browserWindow.__exerciseServiceRequestReload === "function") {
      try {
        browserWindow.__exerciseServiceRequestReload()
      } catch (error) {
        console.warn(
          "[dynamicWithIframeReload] window.__exerciseServiceRequestReload() failed",
          error,
        )
      }
      return
    }

    const elapsed = Date.now() - startedAt
    const remainingMs = RELOAD_BRIDGE_MAX_WAIT_MS - elapsed
    if (remainingMs <= 0) {
      break
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, Math.min(RELOAD_BRIDGE_RETRY_INTERVAL_MS, remainingMs))
    })
  }

  console.warn(
    `[dynamicWithIframeReload] window.__exerciseServiceRequestReload() was not available within ${RELOAD_BRIDGE_MAX_WAIT_MS}ms`,
  )
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
      await requestIframeReloadFromParent()
      throw error
    }
  }

  if (options) {
    return dynamicFn<Props>(wrappedLoader as Loader<Props>, { ...options })
  }
  return dynamicFn<Props>(wrappedLoader as Loader<Props>)
}

export default dynamicWithIframeReload
