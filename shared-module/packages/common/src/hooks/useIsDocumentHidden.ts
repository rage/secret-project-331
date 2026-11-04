"use client"

import { useSyncExternalStore } from "react"

const subscribe = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

/** Whether the browser tab is hidden right now (another tab in front, or the window minimised). */
export function useIsDocumentHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.hidden,
    () => false,
  )
}
